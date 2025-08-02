const js = async () => {
  const Table = require("../models/table");
  const Field = require("../models/field");
  const File = require("../models/file");
  const Page = require("../models/page");
  const View = require("../models/view");
  const Plugin = require("../models/plugin");
  const { traverseSync } = require("../models/layout");

  const db = require("../db");
  const tables = await Table.find({});
  const fsp = require("fs").promises;
  const fs = require("fs");
  const path = require("path");
  const { getState } = require("../db/state");

  await File.ensure_file_store(db.getTenantSchema());

  const state = getState();
  await state?.refresh_tables(false);
  await state?.refresh_views(false);
  await state?.refresh_triggers(false);
  await state?.refresh_pages(false);
  await state?.refresh_config(false);
  await state?.refresh_npmpkgs(false);
  await require("../standard-menu")();
};

module.exports = { js };
