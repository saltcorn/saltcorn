const { contract, is } = require("contractis");
const { getState } = require("../db/state");
const db = require("../db");
const Table = require("./table");
const View = require("./view");
const File = require("./file");
const Plugin = require("./plugin");
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
    var pack = { tables, views, plugins, pages };

    await fs.writeFile(path.join(dirpath, "pack.json"), JSON.stringify(pack));
  }
);

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

const create_table_csv = contract(
  is.fun([is.class("Table"), is.str], is.promise(is.undefined)),
  async (table, dirpath) => {
    const rows = await table.getRows();
    await create_csv_from_rows(rows, path.join(dirpath, table.name + ".csv"));
  }
);

const create_table_csvs = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (root_dirpath) => {
    const dirpath = path.join(root_dirpath, "tables");
    await fs.mkdir(dirpath);
    const tables = await Table.find({});
    for (const t of tables) {
      await create_table_csv(t, dirpath);
    }
  }
);

const create_users_csv = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (root_dirpath) => {
    const users = await db.select("users");
    await create_csv_from_rows(users, path.join(root_dirpath, "users.csv"));
  }
);

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
const create_backup = contract(is.fun([], is.promise(is.str)), async () => {
  const dir = await tmp.dir({ unsafeCleanup: true });

  await create_pack(dir.path);
  await create_table_csvs(dir.path);
  await create_users_csv(dir.path);
  await backup_files(dir.path);
  await backup_config(dir.path);

  var day = dateFormat(new Date(), "yyyy-mm-dd-HH-MM");

  const ten = db.getTenantSchema();
  const tens =
    ten === "public" ? getState().getConfig("site_name", "") : "-" + ten;
  const zipFileName = `sc-backup-${tens}-${day}.zip`;

  var zip = new Zip();
  zip.addLocalFolder(dir.path);
  zip.writeZip(zipFileName);
  await dir.cleanup();
  return zipFileName;
});

const extract = contract(
  is.fun([is.str, is.str], is.promise(is.undefined)),
  async (fnm, dir) => {
    return new Promise(function (resolve, reject) {
      var zip = new Zip(fnm);
      zip.extractAllToAsync(dir, true, function (err) {
        if (err) reject(new Error("Error opening zip filr: " + err));
        else resolve();
      });
    });
  }
);
const restore_files = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (dirpath) => {
    const fnm = path.join(dirpath, "files.csv");
    if (existsSync(fnm)) {
      const file_rows = await csvtojson().fromFile(fnm);
      for (const file of file_rows) {
        const newPath = File.get_new_path(file.location);
        //copy file
        await fs.copyFile(path.join(dirpath, "files", file.location), newPath);
        //set location
        file.location = newPath;
        //insert in db
        await db.insert("_sc_files", file);
      }
    }
  }
);

const restore_users = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (dirpath) => {
    const user_rows = await csvtojson().fromFile(
      path.join(dirpath, "users.csv")
    );
    for (const user of user_rows) {
      if (user.id > 1) await db.insert("users", user);
    }
  }
);

const restore_tables = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (dirpath) => {
    const tables = await Table.find();
    for (const table of tables) {
      const fnm = path.join(dirpath, "tables", table.name + ".csv");
      if (existsSync(fnm)) await table.import_csv_file(fnm);
    }
  }
);

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

const restore = contract(
  is.fun(
    [is.str, is.fun(is_plugin, is.undefined)],
    is.promise(is.or(is.undefined, is.str))
  ),
  async (fnm, loadAndSaveNewPlugin) => {
    const dir = await tmp.dir({ unsafeCleanup: true });
    //unzip
    await extract(fnm, dir.path);

    //install pack
    const pack = JSON.parse(
      await fs.readFile(path.join(dir.path, "pack.json"))
    );

    const can_restore = await can_install_pack(pack);
    if (can_restore.error || can_restore.warning) {
      return `Cannot restore backup, clashing entities: 
      ${can_restore.error || ""} ${can_restore.warning || ""}
      Delete these entities or restore to a pristine instance.
      `;
    }

    await install_pack(pack, undefined, loadAndSaveNewPlugin);

    //users
    await restore_users(dir.path);

    // files
    await restore_files(dir.path);

    //table csvs
    await restore_tables(dir.path);

    //config
    await restore_config(dir.path);

    await dir.cleanup();
  }
);

module.exports = { create_backup, restore };
