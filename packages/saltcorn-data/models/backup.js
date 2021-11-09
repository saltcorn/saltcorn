/**
 * @category saltcorn-data
 * @module models/backup
 * @subcategory models
 */
const { contract, is } = require("contractis");
const { getState } = require("../db/state");
const db = require("../db");
const Table = require("./table");
const View = require("./view");
const File = require("./file");
const Plugin = require("./plugin");
const User = require("./user");
const Role = require("./role");
const Page = require("./page");
const Zip = require("adm-zip");
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
const { is_plugin } = require("../contracts");

const { asyncMap } = require("../utils");
const Trigger = require("./trigger");
const Library = require("./library");

/**
 * @function
 * @param {string} dirpath
 * @returns {Promise<void>}
 */
const create_pack = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (dirpath) => {
    const tables = await asyncMap(
      await Table.find({}),
      async (t) => await table_pack(t.name)
    );
    const views = await asyncMap(
      await View.find({}),
      async (v) => await view_pack(v.name)
    );
    const plugins = await asyncMap(
      await Plugin.find({}),
      async (v) => await plugin_pack(v.name)
    );
    const pages = await asyncMap(
      await Page.find({}),
      async (v) => await page_pack(v.name)
    );
    const triggers = (await Trigger.find({})).map((tr) => tr.toJson);
    const roles = await Role.find({});
    const library = (await Library.find({})).map((l) => l.toJson);
    const pack = { tables, views, plugins, pages, triggers, roles, library };

    await fs.writeFile(path.join(dirpath, "pack.json"), JSON.stringify(pack));
  }
);

/**
 * @function
 * @param {object[]} rows
 * @param {string} fnm
 * @returns {Promise<void>}
 */
const create_csv_from_rows = contract(
  is.fun([is.array(is.obj()), is.str], is.promise(is.undefined)),
  async (rows, fnm) => {
    if (rows.length === 0) return;

    const s = stringify(rows, {
      header: true,
      cast: {
        date: (value) => value.toISOString(),
      },
    });

    await fs.writeFile(fnm, s);
  }
);

/**
 * @function
 * @param {Table} table
 * @param {string} dirpath
 * @returns {Promise<void>} 
 */
const create_table_json = contract(
  is.fun([is.class("Table"), is.str], is.promise(is.undefined)),
  async (table, dirpath) => {
    const rows = await table.getRows();
    await fs.writeFile(
      path.join(dirpath, table.name + ".json"),
      JSON.stringify(rows)
    );
  }
);

/**
 * @function
 * @param {string} root_dirpath
 * @return {Promise<void>}
 */
const create_table_jsons = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (root_dirpath) => {
    const dirpath = path.join(root_dirpath, "tables");
    await fs.mkdir(dirpath, { recursive: true });
    const tables = await Table.find({});
    for (const t of tables) {
      await create_table_json(t, dirpath);
    }
  }
);

/**
 * @function
 * @param {string} root_dirpath
 * @returns {Promise<void>}
 */
const backup_files = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (root_dirpath) => {
    const dirpath = path.join(root_dirpath, "files");
    await fs.mkdir(dirpath);

    const files = await db.select("_sc_files");
    for (const f of files) {
      const basename = path.basename(f.location);
      await fs.copyFile(f.location, path.join(dirpath, basename));
      f.location = basename;
    }
    await create_csv_from_rows(files, path.join(root_dirpath, "files.csv"));
  }
);

/**
 * @function
 * @param {string} root_dirpath
 * @returns {Promise<void>}
 */
const backup_config = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (root_dirpath) => {
    const dirpath = path.join(root_dirpath, "config");
    await fs.mkdir(dirpath);

    const cfgs = await db.select("_sc_config");

    for (const cfg of cfgs) {
      await fs.writeFile(
        path.join(dirpath, cfg.key),
        JSON.stringify(db.isSQLite ? JSON.parse(cfg.value) : cfg.value)
      );
    }
  }
);

/**
 * @function
 * @param {string} [fnm]
 * @returns {Promise<string>}
 */
const create_backup = contract(
  is.fun([is.maybe(is.str)], is.promise(is.str)),
  async (fnm) => {
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
  }
);

/**
 * @function
 * @param {string} fnm
 * @param {string} dir
 * @returns {Promise<void>}
 */
const extract = contract(
  is.fun([is.str, is.str], is.promise(is.undefined)),
  async (fnm, dir) => {
    return new Promise(function (resolve, reject) {
      var zip = new Zip(fnm);
      zip.extractAllToAsync(dir, true, function (err) {
        if (err) reject(new Error("Error opening zip file: " + err));
        else resolve();
      });
    });
  }
);

/**
 * @function
 * @param {string} dirpath
 * @returns {Promise<object>}
 */
const restore_files = contract(
  is.fun(is.str, is.promise(is.obj({}))),
  async (dirpath) => {
    const fnm = path.join(dirpath, "files.csv");
    const file_users = {};
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
        const id = await db.insert("_sc_files", file_row);
        file_users[id] = user_id;
      }
    }
    return file_users;
  }
);

/**
 * @function
 * @param {object} file_users
 * @returns {Promise<void>}
 */
const restore_file_users = contract(
  is.fun(is.obj({}), is.promise(is.undefined)),
  async (file_users) => {
    for (const [id, user_id] of Object.entries(file_users)) {
      if (user_id) await db.update("_sc_files", { user_id }, id);
    }
  }
);

/**
 * @function
 * @param {string} file_users
 * @param {boolean} [restore_first_user]
 * @returns {Promise<string|undefined>}
 */
const restore_tables = contract(
  is.fun([is.str, is.maybe(is.bool)], is.promise(is.maybe(is.str))),
  async (dirpath, restore_first_user) => {
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
        if (res.error) err = (err || "") + res.error;
      }
    }
    for (const table of tables) {
      try {
        await table.enable_fkey_constraints();
      } catch (e) {
        err = (err || "") + e.message;
      }
    }
    return err;
  }
);

/**
 * @function
 * @param {string} dirpath
 * @returns {Promise<void>}
 */
const restore_config = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (dirpath) => {
    const cfgs = readdirSync(path.join(dirpath, "config"));
    const state = getState();

    for (const cfg of cfgs) {
      const s = await fs.readFile(path.join(dirpath, "config", cfg));
      await state.setConfig(cfg, JSON.parse(s).v);
    }
  }
);

/**
 * @function
 * @param {string} fnm
 * @param {function} loadAndSaveNewPlugin
 * @param {boolean} [restore_first_user]
 * @returns {Promise<void>}
 */
const restore = contract(
  is.fun(
    [is.str, is.fun(is_plugin, is.undefined), is.maybe(is.bool)],
    is.promise(is.or(is.undefined, is.str))
  ),
  async (fnm, loadAndSaveNewPlugin, restore_first_user) => {
    const dir = await tmp.dir({ unsafeCleanup: true });
    //unzip
    await extract(fnm, dir.path);
    var err;
    //install pack
    const pack = JSON.parse(
      await fs.readFile(path.join(dir.path, "pack.json"))
    );

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
  }
);

module.exports = { create_backup, restore, create_csv_from_rows };
