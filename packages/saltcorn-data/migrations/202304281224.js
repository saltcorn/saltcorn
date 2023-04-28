const sql = `
insert into _sc_roles (id, role) select id*10, role from _sc_roles where id >1;
update users set role_id = role_id*10 where role_id>1;
update _sc_tables set min_role_read = min_role_read*10 where min_role_read>1;
update _sc_tables set min_role_write = min_role_write*10 where min_role_write>1;
update _sc_views set min_role = min_role*10 where min_role>1;
update _sc_pages set min_role = min_role*10 where min_role>1;
update _sc_triggers set min_role = min_role*10 where min_role>1;
update _sc_files set min_role_read = min_role_read*10 where min_role_read>1;

delete from _sc_roles where id > 1 and id <11`;

const old_to_new_role = (old_roleS) => {
  if (!old_roleS) return old_roleS;
  const old_role = +old_roleS;
  if (!old_role || isNaN(old_role)) return old_roleS;

  if (old_role === 1) return 1;
  else return old_role * 10;
};

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

  await state?.refresh(false);
  const xform_simple_cfg = (k) =>
    state.setConfig(k, old_to_new_role(state.getConfig(k)));

  await xform_simple_cfg("elevate_verified");
  await xform_simple_cfg("min_role_upload");
  await xform_simple_cfg("min_role_apikeygen");
  await xform_simple_cfg("role_to_create_tenant");
  await xform_simple_cfg("min_role_search");
};
module.exports = { sql, js };
