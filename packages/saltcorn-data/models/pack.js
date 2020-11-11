const Table = require("./table");
const db = require("../db");
const View = require("./view");
const User = require("./user");
const Field = require("./field");
const Trigger = require("./trigger");
const { getState } = require("../db/state");
const fetch = require("node-fetch");
const { contract, is } = require("contractis");
const Page = require("./page");
const { is_pack, is_plugin } = require("../contracts");
const TableConstraint = require("./table_constraints");

const pack_fun = is.fun(is.str, is.promise(is.obj()));

const table_pack = contract(pack_fun, async (name) => {
  const table = await Table.findOne({ name });
  const fields = await table.getFields();
  const strip_ids = (o) => {
    delete o.id;
    delete o.table_id;
    return o;
  };
  const triggers = await Trigger.find({ table_id: table.id });
  const constraints = await TableConstraint.find({ table_id: table.id });
  return {
    name: table.name,
    min_role_read: table.min_role_read,
    min_role_write: table.min_role_write,
    versioned: table.versioned,
    fields: fields.map((f) => strip_ids(f.toJson)),
    triggers: triggers.map((tr) => tr.toJson),
    constraints: constraints.map((c) => c.toJson),
  };
});

const view_pack = contract(pack_fun, async (name) => {
  const view = await View.findOne({ name });
  const table = await Table.findOne({ id: view.table_id });

  return {
    name: view.name,
    viewtemplate: view.viewtemplate,
    configuration: view.configuration,
    min_role: view.min_role,
    on_root_page: view.on_root_page,
    table: table.name,
    menu_label: view.menu_label,
  };
});

const plugin_pack = contract(pack_fun, async (name) => {
  const Plugin = require("./plugin");
  const plugin = await Plugin.findOne({ name });

  return {
    name: plugin.name,
    source: plugin.source,
    location: plugin.location,
  };
});
const page_pack = contract(pack_fun, async (name) => {
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
});

const can_install_pack = contract(
  is.fun(
    is_pack,
    is.promise(
      is.or(
        is.eq(true),
        is.obj({ error: is.maybe(is.str), warning: is.maybe(is.str) })
      )
    )
  ),
  async (pack) => {
    const warns = [];
    const allTables = (await Table.find()).map((t) =>
      db.sqlsanitize(t.name.toLowerCase())
    );
    const allViews = (await View.find()).map((t) => t.name);
    const allPages = (await Page.find()).map((t) => t.name);
    const packTables = (pack.tables || []).map((t) =>
      db.sqlsanitize(t.name.toLowerCase())
    );
    const matchTables = allTables.filter((dbt) =>
      packTables.some((pt) => pt === dbt && pt !== "users")
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

    matchViews.forEach((v) => {
      warns.push(`Clashing view ${v}.`);
    });
    matchPages.forEach((p) => {
      warns.push(`Clashing page ${p}.`);
    });
    if (warns.length > 0) return { warning: warns.join(" ") };
    else return true;
  }
);

const uninstall_pack = contract(
  is.fun([is_pack, is.str], is.promise(is.undefined)),
  async (pack, name) => {
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
      if (table) {
        const fields = await table.getFields();
        for (const field of fields) {
          await field.delete();
        }
      }
    }
    for (const tableSpec of pack.tables) {
      const table = await Table.findOne({ name: tableSpec.name });
      if (table) await table.delete();
    }

    if (name) {
      const existPacks = getState().getConfig("installed_packs", []);

      await getState().setConfig(
        "installed_packs",
        existPacks.filter((p) => p !== name)
      );
    }
  }
);

const add_to_menu = contract(
  is.fun(
    is.obj({ label: is.str, type: is.one_of(["View", "Page"]) }),
    is.promise(is.undefined)
  ),
  async (item) => {
    const current_menu = getState().getConfig("menu_items", []);
    current_menu.push(item);
    await getState().setConfig("menu_items", current_menu);
  }
);

const install_pack = contract(
  is.fun(
    [is_pack, is.maybe(is.str), is.fun(is_plugin, is.undefined)],
    is.promise(is.undefined)
  ),
  async (pack, name, loadAndSaveNewPlugin, bare_tables = false) => {
    const Plugin = require("./plugin");
    const existingPlugins = await Plugin.find({});
    for (const plugin of pack.plugins) {
      if (!existingPlugins.some((ep) => ep.name === plugin.name)) {
        const p = new Plugin(plugin);
        await loadAndSaveNewPlugin(p);
      }
    }
    for (const tableSpec of pack.tables) {
      if (tableSpec.name !== "users")
        await Table.create(tableSpec.name, tableSpec);
    }
    for (const tableSpec of pack.tables) {
      const table = await Table.findOne({ name: tableSpec.name });
      for (const field of tableSpec.fields)
        if (!(table.name === "users" && field.name === "email"))
          await Field.create({ table, ...field }, bare_tables);
      for (const trigger of tableSpec.triggers || [])
        await Trigger.create({ table, ...trigger });
      for (const constraint of tableSpec.constraints || [])
        await TableConstraint.create({ table, ...constraint });
    }
    for (const viewSpec of pack.views) {
      const { table, on_menu, menu_label, ...viewNoTable } = viewSpec;
      const vtable = await Table.findOne({ name: table });
      await View.create({ ...viewNoTable, table_id: vtable.id });
      if (menu_label)
        await add_to_menu({
          label: menu_label,
          type: "View",
          viewname: viewSpec.name,
          min_role: viewSpec.min_role || 10,
        });
    }
    for (const pageFullSpec of pack.pages || []) {
      const { root_page_for_roles, menu_label, ...pageSpec } = pageFullSpec;
      await Page.create(pageSpec);
      for (const role of root_page_for_roles || []) {
        const current_root = getState().getConfig(role + "_home", "");
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
      const existPacks = getState().getConfig("installed_packs", []);
      await getState().setConfig("installed_packs", [...existPacks, name]);
    }
  }
);

const is_stale = contract(
  is.fun(is.or(is.class("Date"), is.str), is.bool),
  (date) => {
    const oneday = 60 * 60 * 24 * 1000;
    const now = new Date();
    return new Date(date) < now - oneday;
  }
);

const fetch_available_packs = contract(
  is.fun([], is.promise(is.array(is.obj({ name: is.str })))),
  async () => {
    const stored = getState().getConfig("available_packs", false);
    const stored_at = getState().getConfig("available_packs_fetched_at", false);
    //console.log("in fetch", stored_at, stored)
    if (!stored || !stored_at || is_stale(stored_at)) {
      const from_api = await fetch_available_packs_from_store();
      await getState().setConfig("available_packs", from_api);
      await getState().setConfig("available_packs_fetched_at", new Date());
      return from_api;
    } else return stored;
  }
);

const fetch_available_packs_from_store = contract(
  is.fun([], is.promise(is.array(is.obj({ name: is.str })))),
  async () => {
    //console.log("fetch packs");
    const response = await fetch(
      "http://store.saltcorn.com/api/packs?fields=name,description"
    );

    const json = await response.json();
    return json.success;
  }
);

const fetch_pack_by_name = contract(
  is.fun(
    is.str,
    is.promise(is.maybe(is.obj({ name: is.str, pack: is.obj() })))
  ),
  async (name) => {
    const response = await fetch(
      "http://store.saltcorn.com/api/packs?name=" + encodeURIComponent(name)
    );
    const json = await response.json();
    if (json.success.length == 1) return json.success[0];
    else return null;
  }
);

module.exports = {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  install_pack,
  fetch_available_packs,
  fetch_pack_by_name,
  is_stale,
  can_install_pack,
  uninstall_pack,
  add_to_menu,
};
