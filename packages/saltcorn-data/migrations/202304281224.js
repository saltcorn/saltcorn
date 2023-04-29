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

  const xform_obj_cfg = async (cfg_k) => {
    const oldObj = state.getConfig(cfg_k, {});
    const newObj = {};
    Object.entries(oldObj).forEach(([k, v]) => {
      newObj[old_to_new_role(k)] = v;
    });
    await state.setConfig(cfg_k, newObj);
  };
  await xform_obj_cfg("exttables_min_role_read");
  await xform_obj_cfg("layout_by_role");
  await xform_obj_cfg("twofa_policy_by_role");

  const old_homepages = state.getConfig("home_page_by_role", []);
  if (old_homepages && !Array.isArray(old_homepages))
    await xform_obj_cfg("home_page_by_role");
  else {
    const new_homepages = {};
    // ix is role_id
    old_homepages.forEach((pageNm, role_id) => {
      new_homepages[old_to_new_role(role_id)] = pageNm;
    });
    await state.setConfig("home_page_by_role", new_homepages);
  }

  // pages etc, other layout items
  const xform_layout = (segment) => {
    if (segment.minRole) {
      segment.minRole = old_to_new_role(segment.minRole);
    }
    if (segment.showForRole) {
      const newShowForRole = {};
      Object.entries(segment.showForRole).forEach(([k, v]) => {
        newShowForRole[old_to_new_role(k)] = v;
      });
      segment.showForRole = newShowForRole;
    }
  };
  for (const page of await Page.find()) {
    const layout = page.layout;
    traverseSync(layout, xform_layout);
    await Page.update(page.id, { layout });
  }
  for (const view of await View.find()) {
    const layout = view.configuration.layout;
    if (!layout) continue;
    traverseSync(layout, xform_layout);
    await View.update(
      { configuration: { ...view.configuration, layout } },
      view.id
    );
  }

  //menu
  const iter_menu = (mi) => {
    if (mi.min_role) mi.min_role = old_to_new_role(mi.min_role);
    if (mi.subitems) {
      mi.subitems.forEach(iter_menu);
    }
  };
  if (state.getConfig("menu_items", false))
    await state.setConfig(
      "menu_items",
      iter_menu(state.getConfig("menu_items", []))
    );
  if (state.getConfig("unrolled_menu_items", false))
    await state.setConfig(
      "unrolled_menu_items",
      iter_menu(state.getConfig("unrolled_menu_items", []))
    );

  for (const folderFile of await File.allDirectories())
    for (const file of await File.find({ folder: folderFile.path_to_serve }))
      if (file.min_role_read && file.min_role_read > 1)
        await file.set_role(old_to_new_role(file.min_role_read));
};
module.exports = { sql, js };
