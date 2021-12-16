/**
 * @category saltcorn-data
 * @module models/backup
 * @subcategory models
 */
const { contract, is } = require("contractis");
const { getState } = require("../db/state");
import db = require("../db");
import Table from "./table";
import { instanceOfErrorMsg } from "../common_types";
const View = require("./view");
const File = require("./file");
const Plugin = require("./plugin");
const User = require("./user");
import Role from "./role";
const Page = require("./page");
import Zip from "adm-zip";
const tmp = require("tmp-promise");
const fs = require("fs").promises;
const { existsSync, readdirSync } = require("fs");
const path = require("path");
const dateFormat = require("dateformat");
const stringify = require("csv-stringify/lib/sync");
const csvtojson = require("csvtojson");
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  install_pack,
  can_install_pack,
} = require("./pack");

const { asyncMap } = require("../utils");
import Trigger from "./trigger";
import Library from "./library";

/**
 * @function
 * @param {string} dirpath
 * @returns {Promise<void>}
 */
const create_pack = async (dirpath: string): Promise<void> => {
  const tables = await asyncMap(
    await Table.find({}),
    async (t: any) => await table_pack(t.name)
  );
  const views = await asyncMap(
    await View.find({}),
    async (v: any) => await view_pack(v.name)
  );
  const plugins = await asyncMap(
    await Plugin.find({}),
    async (v: any) => await plugin_pack(v.name)
  );
  const pages = await asyncMap(
    await Page.find({}),
    async (v: any) => await page_pack(v.name)
  );
  const triggers = (await Trigger.find({})).map((tr: Trigger) => tr.toJson);
  const roles = await Role.find({});
  const library = (await Library.find({})).map((l: Library) => l.toJson);
  const pack = { tables, views, plugins, pages, triggers, roles, library };

  await fs.writeFile(path.join(dirpath, "pack.json"), JSON.stringify(pack));
};

/**
 * @function
 * @param {object[]} rows
 * @param {string} fnm
 * @returns {Promise<void>}
 */
const create_csv_from_rows = async (
  rows: any[],
  fnm: string
): Promise<void> => {
  if (rows.length === 0) return;

  const s = stringify(rows, {
    header: true,
    cast: {
      date: (value: Date) => value.toISOString(),
    },
  });

  await fs.writeFile(fnm, s);
};

/**
 * @function
 * @param {Table} table
 * @param {string} dirpath
 * @returns {Promise<void>}
 */
const create_table_json = async (
  table: Table,
  dirpath: string
): Promise<void> => {
  const rows = await table.getRows();
  await fs.writeFile(
    path.join(dirpath, table.name + ".json"),
    JSON.stringify(rows)
  );
};

/**
 * @function
 * @param {string} root_dirpath
 * @return {Promise<void>}
 */
const create_table_jsons = async (root_dirpath: string): Promise<void> => {
  const dirpath = path.join(root_dirpath, "tables");
  await fs.mkdir(dirpath, { recursive: true });
  const tables = await Table.find({});
  for (const t of tables) {
    await create_table_json(t, dirpath);
  }
};

/**
 * @function
 * @param {string} root_dirpath
 * @returns {Promise<void>}
 */
const backup_files = async (root_dirpath: string): Promise<void> => {
  const dirpath = path.join(root_dirpath, "files");
  await fs.mkdir(dirpath);

  const files = await db.select("_sc_files");
  for (const f of files) {
    const basename = path.basename(f.location);
    await fs.copyFile(f.location, path.join(dirpath, basename));
    f.location = basename;
  }
  await create_csv_from_rows(files, path.join(root_dirpath, "files.csv"));
};

/**
 * @function
 * @param {string} root_dirpath
 * @returns {Promise<void>}
 */
const backup_config = async (root_dirpath: string): Promise<void> => {
  const dirpath = path.join(root_dirpath, "config");
  await fs.mkdir(dirpath);

  const cfgs = await db.select("_sc_config");

  for (const cfg of cfgs) {
    await fs.writeFile(
      path.join(dirpath, cfg.key),
      JSON.stringify(db.isSQLite ? JSON.parse(cfg.value) : cfg.value)
    );
  }
};

/**
 * @function
 * @param {string} [fnm]
 * @returns {Promise<string>}
 */
const create_backup = async (fnm: string): Promise<string> => {
  const dir = await tmp.dir({ unsafeCleanup: true });

  await create_pack(dir.path);
  await create_table_jsons(dir.path);
  await backup_files(dir.path);
  await backup_config(dir.path);

  var day = dateFormat(new Date(), "yyyy-mm-dd-HH-MM");

  const ten = db.getTenantSchema();
  const tens =
    ten === db.connectObj.default_schema
      ? getState().getConfig("site_name", "Saltcorn")
      : ten;
  const zipFileName = fnm || `sc-backup-${tens}-${day}.zip`;

  var zip = new Zip();
  zip.addLocalFolder(dir.path);
  zip.writeZip(zipFileName);
  await dir.cleanup();
  return zipFileName;
};

/**
 * @function
 * @param {string} fnm
 * @param {string} dir
 * @returns {Promise<void>}
 */
const extract = async (fnm: string, dir: string): Promise<void> => {
  return new Promise(function (resolve, reject) {
    var zip = new Zip(fnm);
    zip.extractAllToAsync(dir, true, function (err) {
      if (err) reject(new Error("Error opening zip file: " + err));
      else resolve();
    });
  });
};

/**
 * @function
 * @param {string} dirpath
 * @returns {Promise<object>}
 */
const restore_files = async (dirpath: string): Promise<any> => {
  const fnm = path.join(dirpath, "files.csv");
  const file_users: any = {};
  if (existsSync(fnm)) {
    const file_rows = await csvtojson().fromFile(fnm);
    for (const file of file_rows) {
      const newPath = File.get_new_path(file.location);
      //copy file
      await fs.copyFile(path.join(dirpath, "files", file.location), newPath);
      //set location
      file.location = newPath;
      //insert in db
      const { user_id, ...file_row } = file;
      file_row.s3_store = !!file_row.s3_store;
      const id = await db.insert("_sc_files", file_row);
      file_users[id] = user_id;
    }
  }
  return file_users;
};

/**
 * @function
 * @param {object} file_users
 * @returns {Promise<void>}
 */
const restore_file_users = async (file_users: any): Promise<void> => {
  for (const [id, user_id] of Object.entries(file_users)) {
    if (user_id) await db.update("_sc_files", { user_id }, id);
  }
};

/**
 * @function
 * @param {string} file_users
 * @param {boolean} [restore_first_user]
 * @returns {Promise<string|undefined>}
 */
const restore_tables = async (
  dirpath: string,
  restore_first_user?: boolean
): Promise<string | void> => {
  var err;
  const tables = await Table.find();
  for (const table of tables) {
    const fnm_csv =
      table.name === "users"
        ? path.join(dirpath, "users.csv")
        : path.join(dirpath, "tables", table.name + ".csv");
    const fnm_json = path.join(dirpath, "tables", table.name + ".json");
    if (existsSync(fnm_json)) {
      const res = await table.import_json_file(
        fnm_json,
        table.name === "users" && !restore_first_user
      );
      if (res.error) err = (err || "") + res.error;
    } else if (existsSync(fnm_csv)) {
      const res = await table.import_csv_file(
        fnm_csv,
        false,
        table.name === "users" && !restore_first_user
      );
      if (instanceOfErrorMsg(res)) err = (err || "") + res.error;
    }
  }
  for (const table of tables) {
    try {
      await table.enable_fkey_constraints();
    } catch (e: any) {
      err = (err || "") + e.message;
    }
  }
  return err;
};

/**
 * @function
 * @param {string} dirpath
 * @returns {Promise<void>}
 */
const restore_config = async (dirpath: string): Promise<void> => {
  const cfgs = readdirSync(path.join(dirpath, "config"));
  const state = getState();

  for (const cfg of cfgs) {
    const s = await fs.readFile(path.join(dirpath, "config", cfg));
    await state.setConfig(cfg, JSON.parse(s).v);
  }
};

/**
 * @function
 * @param {string} fnm
 * @param {function} loadAndSaveNewPlugin
 * @param {boolean} [restore_first_user]
 * @returns {Promise<void>}
 TODO ch: is_plugin type like in contract.js
 */
const restore = async (
  fnm: string,
  loadAndSaveNewPlugin: (is_plugin: any) => void,
  restore_first_user?: boolean
): Promise<string | void> => {
  const dir = await tmp.dir({ unsafeCleanup: true });
  //unzip
  await extract(fnm, dir.path);
  var err;
  //install pack
  const pack = JSON.parse(await fs.readFile(path.join(dir.path, "pack.json")));

  const can_restore = await can_install_pack(pack);
  if (can_restore.error) {
    return `Cannot restore backup, clashing entities: 
    ${can_restore.error || ""}
    Delete these entities or restore to a pristine instance.
    `;
  }

  await install_pack(pack, undefined, loadAndSaveNewPlugin, true);

  // files
  const file_users = await restore_files(dir.path);

  //table csvs
  const tabres = await restore_tables(dir.path, restore_first_user);
  if (tabres) err = (err || "") + tabres;
  //config
  await restore_config(dir.path);
  await restore_file_users(file_users);

  await dir.cleanup();
  return err;
};

export = { create_backup, restore, create_csv_from_rows };
