const js = async () => {
  const Table = require("@saltcorn/data/models/table");
  const Field = require("@saltcorn/data/models/field");
  const File = require("@saltcorn/data/models/file");
  const Page = require("@saltcorn/data/models/page");
  const View = require("@saltcorn/data/models/view");
  const Plugin = require("@saltcorn/data/models/plugin");
  const { traverseSync } = require("@saltcorn/data/models/layout");

  const db = require("@saltcorn/data/db");
  const tables = await Table.find({});
  const fsp = require("fs").promises;
  const fs = require("fs");
  const path = require("path");
  const { getState } = require("@saltcorn/data/db/state");

  await File.ensure_file_store(db.getTenantSchema());

  const state = getState();
  await state?.refresh_tables(false);
  await state?.refresh_views(false);
  await state?.refresh_triggers(false);
  await state?.refresh_pages(false);
  await state?.refresh_config(false);
  await state?.refresh_npmpkgs(false);
  await require("@saltcorn/data/standard-menu")();
};

module.exports = { js };
