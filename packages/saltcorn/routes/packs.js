const Router = require("express-promise-router");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Plugin = require("saltcorn-data/models/plugin");
const load_plugins = require("../load_plugins");
const { h5, pre } = require("saltcorn-markup/tags");

const router = new Router();
module.exports = router;

router.get("/create/", isAdmin, async (req, res) => {
  const tables = await Table.find({});
  const tableFields = tables.map(t => ({
    label: `${t.name} table`,
    name: `table.${t.name}`,
    type: "Bool"
  }));
  const views = await View.find({});
  const viewFields = views.map(t => ({
    label: `${t.name} view`,
    name: `view.${t.name}`,
    type: "Bool"
  }));
  const plugins = await Plugin.find({});
  const pluginFields = plugins.map(t => ({
    label: `${t.name} plugin`,
    name: `plugin.${t.name}`,
    type: "Bool"
  }));
  res.sendWrap(
    `Create Pack`,
    renderForm(
      new Form({
        action: "/packs/create",
        fields: [...tableFields, ...viewFields, ...pluginFields]
      })
    )
  );
});

const table_pack = async name => {
  const table = await Table.findOne({ name });
  const fields = await table.getFields();
  return {
    name: table.name,
    expose_api_read: table.expose_api_read,
    expose_api_write: table.expose_api_write,
    min_role_read: table.min_role_read,
    min_role_write: table.min_role_write,
    fields: fields.map(f => f.toJson)
  };
};

router.post("/create", isAdmin, async (req, res) => {
  console.log(req.body);
  var pack = { tables: [], views: [], plugins: [] };
  for (const k of Object.keys(req.body)) {
    const [type, name] = k.split(".");
    switch (type) {
      case "table":
        pack.tables.push(await table_pack(name));
        break;

      default:
        break;
    }
  }
  res.sendWrap(`Pack`, pre(JSON.stringify(pack, null, 2)));
});
