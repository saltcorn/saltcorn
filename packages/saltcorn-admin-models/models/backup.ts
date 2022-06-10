const { getState } = require("@saltcorn/data/db/state");
import db from "@saltcorn/data/db/index";
import Table from "@saltcorn/data/models/table";
import { instanceOfErrorMsg } from "@saltcorn/types/common_types";
import View from "@saltcorn/data/models/view";
import File from "@saltcorn/data/models/file";
import Role from "@saltcorn/data/models/role";
import Page from "@saltcorn/data/models/page";
import Plugin from "@saltcorn/data/models/plugin";
import Zip from "adm-zip";
import { dir } from "tmp-promise";
import {
  writeFile,
  mkdir,
  copyFile,
  readFile,
  unlink,
  readdir,
  stat,
} from "fs/promises";
import { existsSync, fstat, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import dateFormat from "dateformat";
import stringify from "csv-stringify/lib/sync";
import csvtojson from "csvtojson";
import pack from "./pack";
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  install_pack,
  can_install_pack,
} = pack;

const { asyncMap } = require("@saltcorn/data/utils");
import Trigger from "@saltcorn/data/models/trigger";
import Library from "@saltcorn/data/models/library";
import User from "@saltcorn/data/models/user";
import path from "path";

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

  await writeFile(join(dirpath, "pack.json"), JSON.stringify(pack));
};

/**
 *
 * @param rows
 * @param fnm
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

  await writeFile(fnm, s);
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
  await writeFile(join(dirpath, table.name + ".json"), JSON.stringify(rows));
};

/**
 * @function
 * @param {string} root_dirpath
 * @return {Promise<void>}
 */
const create_table_jsons = async (root_dirpath: string): Promise<void> => {
  const dirpath = join(root_dirpath, "tables");
  await mkdir(dirpath, { recursive: true });
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
  const dirpath = join(root_dirpath, "files");
  await mkdir(dirpath);

  const files = await db.select("_sc_files");
  for (const f of files) {
    const base = basename(f.location);
    //exclude auto backups
    if (
      base.startsWith(
        `sc-backup-${getState().getConfig("site_name", "Saltcorn")}`
      ) &&
      f.mime_sub === "zip" &&
      !f.user_id
    )
      continue;
    await copyFile(f.location, join(dirpath, base));
    f.location = base;
  }
  await create_csv_from_rows(files, join(root_dirpath, "files.csv"));
};

/**
 * @function
 * @param {string} root_dirpath
 * @returns {Promise<void>}
 */
const backup_config = async (root_dirpath: string): Promise<void> => {
  const dirpath = join(root_dirpath, "config");
  await mkdir(dirpath);

  const cfgs = await db.select("_sc_config");

  for (const cfg of cfgs) {
    await writeFile(
      join(dirpath, cfg.key),
      JSON.stringify(db.isSQLite ? JSON.parse(cfg.value) : cfg.value)
    );
  }
};

/**
 *
 * @param fnm
 */
const create_backup = async (fnm?: string): Promise<string> => {
  const tmpDir = await dir({ unsafeCleanup: true });

  await create_pack(tmpDir.path);
  await create_table_jsons(tmpDir.path);
  await backup_files(tmpDir.path);
  await backup_config(tmpDir.path);

  var day = dateFormat(new Date(), "yyyy-mm-dd-HH-MM");

  const ten = db.getTenantSchema();
  const tens =
    ten === db.connectObj.default_schema
      ? getState().getConfig("site_name", "Saltcorn")
      : ten;
  const zipFileName = fnm || `sc-backup-${tens}-${day}.zip`;

  var zip = new Zip();
  zip.addLocalFolder(tmpDir.path);
  zip.writeZip(zipFileName);
  await tmpDir.cleanup();
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
  const fnm = join(dirpath, "files.csv");
  const file_users: any = {};
  if (existsSync(fnm)) {
    const file_rows = await csvtojson().fromFile(fnm);
    for (const file of file_rows) {
      const newPath = File.get_new_path(file.location);
      //copy file
      await copyFile(join(dirpath, "files", file.location), newPath);
      //set location
      file.location = newPath;
      //insert in db
      const { user_id, ...file_row } = file;
      file_row.s3_store = !!file_row.s3_store;
      const id = await db.insert("_sc_files", file_row);
      file_users[id] = user_id;
    }
    if (db.reset_sequence) await db.reset_sequence("_sc_files");
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
        ? join(dirpath, "users.csv")
        : join(dirpath, "tables", table.name + ".csv");
    const fnm_json = join(dirpath, "tables", table.name + ".json");
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
  const cfgs = readdirSync(join(dirpath, "config"));
  const state = getState();

  for (const cfg of cfgs) {
    const s = await readFile(join(dirpath, "config", cfg));
    await state.setConfig(cfg, JSON.parse(s.toString()).v);
  }
};

/**
 * @param fnm
 * @param loadAndSaveNewPlugin
 * @param restore_first_user
 */
const restore = async (
  fnm: string,
  loadAndSaveNewPlugin: (plugin: Plugin) => void,
  restore_first_user?: boolean
): Promise<string | void> => {
  const tmpDir = await dir({ unsafeCleanup: true });
  //unzip
  await extract(fnm, tmpDir.path);
  var err;
  //install pack
  const pack = JSON.parse(
    await (await readFile(join(tmpDir.path, "pack.json"))).toString()
  );

  const can_restore = await can_install_pack(pack);
  if (typeof can_restore !== "boolean" && can_restore.error) {
    return `Cannot restore backup, clashing entities: 
    ${can_restore.error || ""}
    Delete these entities or restore to a pristine instance.
    `;
  }

  await install_pack(pack, undefined, loadAndSaveNewPlugin, true);

  // files
  const file_users = await restore_files(tmpDir.path);

  //table csvs
  const tabres = await restore_tables(tmpDir.path, restore_first_user);
  if (tabres) err = (err || "") + tabres;
  //config
  await restore_config(tmpDir.path);
  await restore_file_users(file_users);

  await tmpDir.cleanup();
  return err;
};

const delete_old_backups = async () => {
  const directory = getState().getConfig("auto_backup_directory");
  const expire_days = getState().getConfig("auto_backup_expire_days");
  if (!expire_days || expire_days < 0) return;
  const files = await readdir(directory);
  for (const file of files) {
    if (!file.startsWith("sc-backup-")) continue;
    const stats = await stat(path.join(directory, file));
    const ageDays =
      (new Date().getTime() - stats.birthtime.getTime()) / (1000 * 3600 * 24);
    if (ageDays > expire_days) await unlink(path.join(directory, file));
  }
};

const auto_backup_now = async () => {
  const fileName = await create_backup();
  const destination = getState().getConfig("auto_backup_destination");
  switch (destination) {
    case "Saltcorn files":
      const newPath = File.get_new_path(fileName);
      const stats = statSync(fileName);
      await copyFile(fileName, newPath);
      await File.create({
        filename: fileName,
        location: newPath,
        uploaded_at: new Date(),
        size_kb: Math.round(stats.size / 1024),
        mime_super: "application",
        mime_sub: "zip",
        min_role_read: 1,
      });
      await unlink(fileName);
      break;
    case "Local directory":
      const directory = getState().getConfig("auto_backup_directory");
      await copyFile(fileName, join(directory, fileName));
      await unlink(fileName);
      await delete_old_backups();
      break;

    default:
      throw new Error("Unknown destination: " + destination);
      break;
  }
};

export = { create_backup, restore, create_csv_from_rows, auto_backup_now };
