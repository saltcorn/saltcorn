const Table = require("./table");
const View = require("./view");
const Field = require("./field");
const { getState } = require("../db/state");
const fetch = require("node-fetch");
const { contract, is } = require("contractis");

const pack_fun = is.fun(is.str, is.promise(is.obj()));

const table_pack = contract(pack_fun, async name => {
  const table = await Table.findOne({ name });
  const fields = await table.getFields();
  const strip_ids = o => {
    delete o.id;
    delete o.table_id;
    return o;
  };
  return {
    name: table.name,
    expose_api_read: table.expose_api_read,
    expose_api_write: table.expose_api_write,
    min_role_read: table.min_role_read,
    min_role_write: table.min_role_write,
    fields: fields.map(f => strip_ids(f.toJson))
  };
});

const view_pack = contract(pack_fun, async name => {
  const view = await View.findOne({ name });
  const table = await Table.findOne({ id: view.table_id });

  return {
    name: view.name,
    viewtemplate: view.viewtemplate,
    configuration: view.configuration,
    is_public: view.is_public,
    on_root_page: view.on_root_page,
    on_menu: view.on_menu,
    table: table.name
  };
});

const plugin_pack = contract(pack_fun, async name => {
  const Plugin = require("./plugin");
  const plugin = await Plugin.findOne({ name });

  return {
    name: plugin.name,
    source: plugin.source,
    location: plugin.location
  };
});

const is_stale = contract(is.fun(is.or(is.class("Date"), is.str), is.bool), date => {
  const oneday = 60 * 60 * 24 * 1000;
  const now = new Date();
  return new Date(date) < now - oneday;
});

const fetch_available_packs = contract(
  is.fun([], is.promise(is.array(is.obj({ name: is.str })))),
  async () => {
    const stored = getState().getConfig("available_packs", false);
    const stored_at = getState().getConfig("available_packs_fetched_at", false);
    //console.log(stored_at, typeof(stored_at))
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
      "http://store.saltcorn.com/api/packs?fields=name"
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
  async name => {
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
  fetch_available_packs,
  fetch_pack_by_name,
  is_stale
};
