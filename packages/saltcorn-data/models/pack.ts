/**
 * @category saltcorn-data
 * @module models/pack
 * @subcategory models
 */

import Table from "./table";
import db from "../db";
import View from "./view";
import Field from "./field";
import Trigger from "./trigger";
const { getState } = require("../db/state");
import fetch from "node-fetch";
import Page from "./page";
import TableConstraint from "./table_constraints";
import Role from "./role";
import Library from "./library";
import config from "./config";
import type { Pack } from "@saltcorn/types/base_types";
import type { PackPage } from "@saltcorn/types/model-abstracts/abstract_page";
const { save_menu_items } = config;
import type Plugin from "./plugin";
import type { PackView } from "@saltcorn/types/model-abstracts/abstract_view";
import type { PackTable } from "@saltcorn/types/model-abstracts/abstract_table";
import type { PackPlugin } from "@saltcorn/types/model-abstracts/abstract_plugin";
import type { LibraryPack } from "@saltcorn/types/model-abstracts/abstract_library";
import type { TriggerPack } from "@saltcorn/types/model-abstracts/abstract_trigger";
import type { RolePack } from "@saltcorn/types/model-abstracts/abstract_role";

/**
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const table_pack = async (name: string): Promise<PackTable> => {
  const table = await Table.findOne({ name });
  if (!table) throw new Error(`Unable to find table '${name}'`);

  const fields = await table.getFields();
  const strip_ids = (o: any) => {
    delete o.id;
    delete o.table_id;
    return o;
  };
  //const triggers = await Trigger.find({ table_id: table.id });
  const constraints = await TableConstraint.find({ table_id: table.id });

  return {
    name: table.name,
    min_role_read: table.min_role_read,
    min_role_write: table.min_role_write,
    versioned: table.versioned,
    ownership_formula: table.ownership_formula,
    fields: fields.map((f) => strip_ids(f.toJson)),
    //triggers: triggers.map((tr) => tr.toJson),
    constraints: constraints.map((c) => c.toJson),
    ownership_field_name: table.owner_fieldname_from_fields(fields),
  };
};

/**
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const view_pack = async (name: string): Promise<PackView> => {
  const view = await View.findOne({ name });
  if (!view) throw new Error(`Unable to find view '${name}'`);
  const table = await Table.findOne({ id: view.table_id });
  if (!table)
    throw new Error(`Unable to find table with id '${view.table_id}'`);
  return {
    name: view.name,
    viewtemplate: view.viewtemplate,
    configuration: view.configuration,
    min_role: view.min_role,
    table: table ? table.name : null,
    menu_label: view.menu_label,
    default_render_page: view.default_render_page,
  };
};

/**
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const plugin_pack = async (name: string): Promise<PackPlugin> => {
  const Plugin = (await import("./plugin")).default;
  const plugin = await Plugin.findOne({ name });
  if (!plugin) throw new Error(`Unable to find plugin '${name}'`);
  return {
    name: plugin.name,
    source: plugin.source,
    location: plugin.location,
    configuration: plugin.configuration,
    deploy_private_key: plugin.deploy_private_key,
  };
};

/**
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const page_pack = async (name: string): Promise<PackPage> => {
  const page = await Page.findOne({ name });
  const root_page_for_roles = await page.is_root_page_for_roles();
  return {
    name: page.name,
    title: page.title,
    description: page.description,
    min_role: page.min_role,
    layout: page.layout,
    fixed_states: page.fixed_states,
    menu_label: page.menu_label,
    root_page_for_roles,
  };
};

/**
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const library_pack = async (name: string): Promise<LibraryPack> => {
  const lib = await Library.findOne({ name });
  return lib.toJson;
};

/**
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const trigger_pack = async (name: string): Promise<TriggerPack> => {
  const trig = await Trigger.findOne({ name });
  return trig.toJson;
};

/**
 * @function
 * @param {string} role
 * @returns {Promise<object>}
 */
const role_pack = async (role: string): Promise<RolePack> => {
  return await Role.findOne({ role });
};

/**
 * @function
 * @param {string} pack
 * @returns {Promise<boolean|object>}
 */
const can_install_pack = async (
  pack: Pack
): Promise<true | { error?: string; warning?: string }> => {
  const warns = new Array<string>();
  const allTables = (await Table.find()).map((t) =>
    db.sqlsanitize(t.name.toLowerCase())
  );
  const allViews = (await View.find()).map((t) => t.name);
  const allPages = (await Page.find()).map((t) => t.name);
  const packTables = (pack.tables || []).map((t) =>
    db.sqlsanitize(t.name.toLowerCase())
  );
  const matchTables = allTables.filter((dbt) =>
    packTables.some((pt: string) => pt === dbt && pt !== "users")
  );
  const matchViews = allViews.filter((dbt) =>
    (pack.views || []).some((pt) => pt.name === dbt)
  );
  const matchPages = allPages.filter((dbt) =>
    (pack.pages || []).some((pt) => pt.name === dbt)
  );

  if (matchTables.length > 0)
    return {
      error: "Tables already exist: " + matchTables.join(),
    };
  pack.tables.forEach((t) => {
    if (t.name === "users")
      t.fields.forEach((f) => {
        if (f.required) {
          warns.push(
            `User field '${f.name}' is required in pack, but there are existing users. You must set a value for each user and then change the field to be required. Got to <a href="/list/users">users table data</a>.`
          );
        }
      });
  });
  matchViews.forEach((v) => {
    warns.push(`Clashing view ${v}.`);
  });
  matchPages.forEach((p) => {
    warns.push(`Clashing page ${p}.`);
  });
  if (warns.length > 0) return { warning: warns.join(" ") };
  else return true;
};

/**
 * @function
 * @param {string} pack
 * @param {string} name
 * @returns {Promise<void>}
 */
const uninstall_pack = async (pack: Pack, name?: string): Promise<void> => {
  for (const pageSpec of pack.pages || []) {
    const page = await Page.findOne({ name: pageSpec.name });
    if (page) await page.delete();
  }
  for (const viewSpec of pack.views) {
    const view = await View.findOne({ name: viewSpec.name });
    if (view) await view.delete();
  }
  for (const tableSpec of pack.tables) {
    const table = await Table.findOne({ name: tableSpec.name });
    if (table && table.name === "users") continue;
    if (table) {
      const fields = await table.getFields();
      for (const field of fields) {
        if (field.is_fkey) await field.delete();
      }
      const triggers = await Trigger.find({ table_id: table.id });
      for (const trigger of triggers) {
        await trigger.delete();
      }
    }
  }
  for (const tableSpec of pack.tables) {
    const table = await Table.findOne({ name: tableSpec.name });
    if (table && table.name !== "users") await table.delete();
  }

  if (name) {
    const existPacks = getState().getConfigCopy("installed_packs", []);

    await getState().setConfig(
      "installed_packs",
      existPacks.filter((p: string) => p !== name)
    );
  }
};

/**
 * @function
 * @param {object} item
 * @returns {Promise<void>}
 */
const add_to_menu = async (item: {
  label: string;
  type: "View" | "Page";
  viewname?: string;
  pagename?: string;
  min_role: number;
}): Promise<void> => {
  const current_menu = getState().getConfigCopy("menu_items", []);
  current_menu.push(item);
  await save_menu_items(current_menu);
};

/**
 * @function
 * @param {string} pack
 * @param {string} [name]
 * @param {function} loadAndSaveNewPlugin
 * @param {boolean} [bare_tables = false]
 * @returns {Promise<void>}
 */
const install_pack = async (
  pack: Pack,
  name: string | undefined,
  loadAndSaveNewPlugin: (arg0: Plugin) => void,
  bare_tables = false
): Promise<void> => {
  const Plugin = (await import("./plugin")).default;
  const existingPlugins = await Plugin.find({});
  for (const plugin of pack.plugins) {
    if (!existingPlugins.some((ep) => ep.name === plugin.name)) {
      const p = new Plugin(plugin);
      await loadAndSaveNewPlugin(p);
    }
  }
  for (const role of pack.roles || []) {
    await Role.create(role);
  }
  for (const lib of pack.library || []) {
    await Library.create(lib);
  }
  for (const tableSpec of pack.tables) {
    if (tableSpec.name !== "users") {
      const table = await Table.create(tableSpec.name, tableSpec);
      const [tbl_pk] = await table.getFields();
      //set pk
      const pack_pk = tableSpec.fields.find((f) => f.primary_key);
      if (pack_pk) {
        await tbl_pk.update(pack_pk);
      }
    }
  }
  for (const tableSpec of pack.tables) {
    const _table = await Table.findOne({ name: tableSpec.name });
    if (!_table) throw new Error(`Unable to find table '${tableSpec.name}'`);

    const exfields = await _table.getFields();
    for (const field of tableSpec.fields) {
      const exfield = exfields.find((f) => f.name === field.name);
      if (!((_table.name === "users" && field.name === "email") || exfield)) {
        if (_table.name === "users" && field.required)
          await Field.create(
            { table: _table, ...field, required: false },
            bare_tables
          );
        else await Field.create({ table: _table, ...field }, bare_tables);
      }
    }
    for (const { table, ...trigger } of tableSpec.triggers || []) {
      await Trigger.create({ table: _table, ...trigger }); //legacy, not in new packs
    }
    for (const constraint of tableSpec.constraints || [])
      await TableConstraint.create({ table: _table, ...constraint });
    if (tableSpec.ownership_field_name) {
      const owner_field = await Field.findOne({
        table_id: _table.id,
        name: tableSpec.ownership_field_name,
      });
      await _table.update({ ownership_field_id: owner_field.id });
    }
  }
  for (const viewSpec of pack.views) {
    const { table, on_menu, menu_label, on_root_page, ...viewNoTable } =
      viewSpec;
    const vtable = await Table.findOne({ name: table });
    await View.create({
      ...viewNoTable,
      table_id: vtable ? vtable.id : null,
    });
    if (menu_label)
      await add_to_menu({
        label: menu_label,
        type: "View",
        viewname: viewSpec.name,
        min_role: viewSpec.min_role || 10,
      });
  }
  for (const triggerSpec of pack.triggers || []) {
    await Trigger.create(triggerSpec);
  }

  for (const pageFullSpec of pack.pages || []) {
    const { root_page_for_roles, menu_label, ...pageSpec } = pageFullSpec;
    await Page.create(pageSpec as PackPage);
    for (const role of root_page_for_roles || []) {
      const current_root = getState().getConfigCopy(role + "_home", "");
      if (!current_root || current_root === "")
        await getState().setConfig(role + "_home", pageSpec.name);
    }
    if (menu_label)
      await add_to_menu({
        label: menu_label,
        type: "Page",
        pagename: pageSpec.name,
        min_role: pageSpec.min_role,
      });
  }
  if (name) {
    const existPacks = getState().getConfigCopy("installed_packs", []);
    await getState().setConfig("installed_packs", [...existPacks, name]);
  }
};

/**
 * @function
 * @param {Date} date
 * @param {string} [hours = 24]
 * @returns {boolean}
 */
const is_stale = (date: Date | string, hours: number = 24): boolean => {
  const oneday = 60 * 60 * hours * 1000;
  let now = new Date();
  return new Date(date).valueOf() < now.valueOf() - oneday;
};

/**
 * @function
 * @returns {object[]}
 */
const fetch_available_packs = async (): Promise<Array<{ name: string }>> => {
  const stored = getState().getConfigCopy("available_packs", false);
  const stored_at = getState().getConfigCopy(
    "available_packs_fetched_at",
    false
  );
  //console.log("in fetch", stored_at, stored)
  if (!stored || !stored_at || is_stale(stored_at)) {
    try {
      const from_api = await fetch_available_packs_from_store();
      await getState().setConfig("available_packs", from_api);
      await getState().setConfig("available_packs_fetched_at", new Date());
      return from_api;
    } catch (e) {
      console.error("fetch store error", e);
      return [];
    }
  } else return stored;
};

/**
 * @function
 * @returns {Promise<object[]>}
 */
const fetch_available_packs_from_store = async (): Promise<
  Array<{ name: string }>
> => {
  //console.log("fetch packs");
  const response = await fetch(
    "http://store.saltcorn.com/api/packs?fields=name,description"
  );

  const json = await response.json();
  return json.success;
};

/**
 * @function
 * @param {string} name
 * @returns {Promise<object|null>}
 */
const fetch_pack_by_name = async (
  name: string
): Promise<{ name: string; pack: any } | null> => {
  const response = await fetch(
    "http://store.saltcorn.com/api/packs?name=" + encodeURIComponent(name)
  );
  const json = await response.json();
  if (json.success.length == 1) return json.success[0];
  else return null;
};

export = {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  role_pack,
  library_pack,
  trigger_pack,
  install_pack,
  fetch_available_packs,
  fetch_pack_by_name,
  is_stale,
  can_install_pack,
  uninstall_pack,
  add_to_menu,
};
