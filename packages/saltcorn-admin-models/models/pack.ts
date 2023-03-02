/**
 * Packs
 * @category saltcorn-admin-models
 * @module pack
 */

import Table from "@saltcorn/data/models/table";
import db from "@saltcorn/data/db/index";
import View from "@saltcorn/data/models/view";
import Field from "@saltcorn/data/models/field";
import Trigger from "@saltcorn/data/models/trigger";
const { getState } = require("@saltcorn/data/db/state");
import fetch from "node-fetch";
import Page from "@saltcorn/data/models/page";
import TableConstraint from "@saltcorn/data/models/table_constraints";
import Role from "@saltcorn/data/models/role";
import Library from "@saltcorn/data/models/library";
import config from "@saltcorn/data/models/config";
import type { Pack } from "@saltcorn/types/base_types";
import type { PagePack } from "@saltcorn/types/model-abstracts/abstract_page";
const { save_menu_items } = config;
import type Plugin from "@saltcorn/data/models/plugin";
import type { ViewPack } from "@saltcorn/types/model-abstracts/abstract_view";
import type { TablePack } from "@saltcorn/types/model-abstracts/abstract_table";
import type { PluginPack } from "@saltcorn/types/model-abstracts/abstract_plugin";
import type { LibraryPack } from "@saltcorn/types/model-abstracts/abstract_library";
import type { TriggerPack } from "@saltcorn/types/model-abstracts/abstract_trigger";
import type { RolePack } from "@saltcorn/types/model-abstracts/abstract_role";
const { isStale } = require("@saltcorn/data/utils");

/**
 * Table Pack
 * @function
 * @param {string} nameOrTable
 * @returns {Promise<object>}
 */
const table_pack = async (nameOrTable: string | Table): Promise<TablePack> => {
  // todo check this change
  const table =
    typeof nameOrTable === "string"
      ? await Table.findOne({ name: nameOrTable })
      : nameOrTable;
  if (!table) throw new Error(`Unable to find table '${nameOrTable}'`);

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
 * View Pack
 * @function
 * @param name
 */
const view_pack = async (name: string): Promise<ViewPack> => {
  const view = await View.findOne({ name });
  if (!view) throw new Error(`Unable to find view '${name}'`);
  const table = await Table.findOne({ id: view.table_id });
  //if (!table)
  //  throw new Error(`Unable to find table with id '${view.table_id}'`);
  return {
    name: view.name,
    viewtemplate: view.viewtemplate,
    configuration: view.configuration,
    min_role: view.min_role,
    table: table ? table.name : null,
    menu_label: view.menu_label,
    slug: view.slug,
    attributes: view.attributes,
    default_render_page: view.default_render_page,
    exttable_name: view.exttable_name,
  };
};

/**
 * Plugin pack
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const plugin_pack = async (name: string): Promise<PluginPack> => {
  const Plugin = (await import("@saltcorn/data/models/plugin")).default;
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
 * Page Pack
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const page_pack = async (name: string): Promise<PagePack> => {
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
 * Library pack
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const library_pack = async (name: string): Promise<LibraryPack> => {
  const lib = await Library.findOne({ name });
  return lib.toJson;
};

/**
 * Trigger pack
 * @function
 * @param {string} name
 * @returns {Promise<object>}
 */
const trigger_pack = async (name: string): Promise<TriggerPack> => {
  const trig = await Trigger.findOne({ name });
  return trig.toJson;
};

/**
 * Role pack
 * @function
 * @param {string} role
 * @returns {Promise<object>}
 */
const role_pack = async (role: string): Promise<RolePack> => {
  return await Role.findOne({ role });
};

/**
 * Can install pock
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
 * Uninstall pack
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
      const triggers = Trigger.find({ table_id: table.id });
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
  const existing = current_menu.findIndex((m: any) => m.label === item.label);
  if (existing >= 0) current_menu[existing] = item;
  else current_menu.push(item);
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
  const Plugin = (await import("@saltcorn/data/models/plugin")).default;
  for (const plugin of pack.plugins) {
    const existingPlugins = await Plugin.find({});
    if (!existingPlugins.some((ep) => ep.name === plugin.name)) {
      // local plugins can crash
      try {
        const p = new Plugin(plugin);
        await loadAndSaveNewPlugin(p);
      } catch (e) {
        console.error("install pack plugin error:", e);
      }
    }
  }
  for (const role of pack.roles || []) {
    const existing = await Role.findOne({ id: role.id });
    if (existing) await existing.update(role);
    else await Role.create(role);
  }
  for (const lib of pack.library || []) {
    const exisiting = await Library.findOne({ name: lib.name });
    if (exisiting) await exisiting.update(lib);
    else await Library.create(lib);
  }
  // create tables (users skipped because created by other ways)
  for (const tableSpec of pack.tables) {
    if (tableSpec.name !== "users") {
      let tbl_pk;
      const existing = Table.findOne({ name: tableSpec.name });
      getState().log(
        5,
        `Restoring table pack name=${
          tableSpec.name
        } existing=${!!existing} tenant=${db.getTenantSchema()}`
      );
      if (existing) {
        tbl_pk = await existing.getField(existing.pk_name);
      } else {
        const table = await Table.create(tableSpec.name, tableSpec);
        [tbl_pk] = await table.getFields();
      } //set pk
      const pack_pk = tableSpec.fields.find((f) => f.primary_key);
      if (pack_pk && tbl_pk) {
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
    const existing = View.findOne({ name: viewNoTable.name });
    if (existing?.id) {
      await View.update(viewNoTable, existing.id);
    } else {
      await View.create({
        ...viewNoTable,
        table_id: vtable ? vtable.id : null,
      });
    }
    if (menu_label)
      await add_to_menu({
        label: menu_label,
        type: "View",
        viewname: viewSpec.name,
        min_role: viewSpec.min_role || 10,
      });
  }
  for (const triggerSpec of pack.triggers || []) {
    const existing = await Trigger.findOne({ name: triggerSpec.name });
    if (existing) {
      const { table_name, ...tsNoTableName } = triggerSpec;
      if (table_name)
        tsNoTableName.table_id = Table.findOne({ name: table_name })?.id;
      await Trigger.update(existing.id, tsNoTableName);
    } else await Trigger.create(triggerSpec);
  }

  for (const pageFullSpec of pack.pages || []) {
    const { root_page_for_roles, menu_label, ...pageSpec } = pageFullSpec;
    const existing = Page.findOne({ name: pageSpec.name });
    if (existing?.id) await Page.update(existing.id, pageSpec);
    else await Page.create(pageSpec as PagePack);
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
 * @returns {object[]}
 */
const fetch_available_packs = async (): Promise<Array<{ name: string }>> => {
  const stored = getState().getConfigCopy("available_packs", false);
  const stored_at = getState().getConfigCopy(
    "available_packs_fetched_at",
    false
  );
  //console.log("in fetch", stored_at, stored)
  if (!stored || !stored_at || isStale(stored_at)) {
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
 * @returns {object[]}
 */
const get_cached_packs = async (): Promise<Array<{ name: string }>> => {
  const stored = getState().getConfigCopy("available_packs", false);
  return stored || [];
};

/**
 * Fetch available packs from store
 * @function
 * @returns {Promise<object[]>}
 */
const fetch_available_packs_from_store = async (): Promise<
  Array<{ name: string }>
> => {
  //console.log("fetch packs");
  //const { getState } = require("../db/state");
  const packs_store_endpoint = getState().getConfig(
    "packs_store_endpoint",
    false
  );
  //console.log(`[fetch_available_packs_from_store] packs_store_endpoint:%s`, packs_store_endpoint);

  const response = await fetch(
    //"http://store.saltcorn.com/api/packs?fields=name,description"
    packs_store_endpoint + "?fields=name,description"
  );

  const json = await response.json();
  return json.success;
};

/**
 * Fetch pack by name
 * @function
 * @param {string} name
 * @returns {Promise<object|null>}
 */
const fetch_pack_by_name = async (
  name: string
): Promise<{ name: string; pack: any } | null> => {
  //const { getState } = require("../db/state");
  const packs_store_endpoint = getState().getConfig(
    "packs_store_endpoint",
    false
  );
  //console.log(`[fetch_pack_by_name] packs_store_endpoint:%s`, packs_store_endpoint);

  const response = await fetch(
    //"http://store.saltcorn.com/api/packs?name=" + encodeURIComponent(name)
    packs_store_endpoint + "?name=" + encodeURIComponent(name)
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
  get_cached_packs,
  fetch_pack_by_name,
  can_install_pack,
  uninstall_pack,
  add_to_menu,
};
