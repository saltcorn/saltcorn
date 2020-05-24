const Table = require("./table");
const View = require("./view");
const Field = require("./field");
const Plugin = require("./plugin");

const fetch = require("node-fetch");

const table_pack = async name => {
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
};
const view_pack = async name => {
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
};

const plugin_pack = async name => {
  const plugin = await Plugin.findOne({ name });

  return {
    name: plugin.name,
    source: plugin.source,
    location: plugin.location
  };
};

const fetch_available_packs = async () => {
  const response = await fetch("http://store.saltcorn.com/api/packs");
  const json = await response.json();
  return json.success;
};

const fetch_pack_by_name = async name => {
  const response = await fetch(
    "http://store.saltcorn.com/api/packs?name=" + encodeURIComponent(name)
  );
  const json = await response.json();
  if (json.success.length == 1) return json.success[0];
  else return null;
};

module.exports = {
  table_pack,
  view_pack,
  plugin_pack,
  fetch_available_packs,
  fetch_pack_by_name
};
