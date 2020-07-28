const { contract, is } = require("contractis");
const { getState } = require("../db/state");
const db = require("../db");
const Table = require("./table");
const View = require("./view");
const Field = require("./field");
const Plugin = require("./plugin");
const Page = require("./page");
const Zip = require("adm-zip");
const tmp = require("tmp-promise");
const fs = require("fs").promises;
const path = require("path");
const dateFormat = require("dateformat");
const stringify = require("csv-stringify/lib/sync");

const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  install_pack
} = require("./pack");

const { asyncMap } = require("../utils");

const create_pack = async dirpath => {
  const tables = await asyncMap(
    await Table.find({}),
    async t => await table_pack(t.name)
  );
  const views = await asyncMap(
    await View.find({}),
    async v => await view_pack(v.name)
  );
  const plugins = await asyncMap(
    await Plugin.find({}),
    async v => await plugin_pack(v.name)
  );
  const pages = await asyncMap(
    await Page.find({}),
    async v => await page_pack(v.name)
  );
  var pack = { tables, views, plugins, pages };

  await fs.writeFile(path.join(dirpath, "pack.json"), JSON.stringify(pack));
};

const create_csv = async (table, dirpath) => {
  const rows = await table.getRows();
  const fnm = path.join(dirpath, table.name + ".csv");
  const s = stringify(rows, {
    header: true,
    cast: {
      date: value => value.toISOString()
    }
  });

  await fs.writeFile(fnm, s);
};

const create_csvs = async root_dirpath => {
  const dirpath = path.join(root_dirpath, "tables");
  await fs.mkdir(dirpath);
  const tables = await Table.find({});
  for (const t of tables) {
    await create_csv(t, dirpath);
  }
};

const create_backup = async () => {
  const dir = await tmp.dir({ unsafeCleanup: true });

  await create_pack(dir.path);
  await create_csvs(dir.path);

  var day = dateFormat(new Date(), "yyyy-mm-dd-hh-MM");

  const ten = db.getTenantSchema();
  const tens = ten === "public" ? "" : "-" + ten;
  const zipFileName = `sc-backup${tens}-${day}.zip`;

  var zip = new Zip();
  zip.addLocalFolder(dir.path);
  zip.writeZip(zipFileName);
  await dir.cleanup();
  return zipFileName;
};

module.exports = { create_backup };
