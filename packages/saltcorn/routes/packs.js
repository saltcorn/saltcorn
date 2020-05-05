const Router = require("express-promise-router");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Field = require("saltcorn-data/models/field");
const Plugin = require("saltcorn-data/models/plugin");
const load_plugins = require("../load_plugins");

const { is_pack } = require("saltcorn-data/contracts");
const { contract, is } = require("contractis");
const {
  table_pack,
  view_pack,
  plugin_pack,
  fetch_pack_by_name
} = require("saltcorn-data/models/pack");
const { h5, pre, code } = require("saltcorn-markup/tags");

const router = new Router();
module.exports = router;

const install_pack = contract(
  is.fun(is_pack, is.promise(is.undefined)),
  async pack => {
    const existingPlugins = await Plugin.find({});
    for (const plugin of pack.plugins) {
      if (!existingPlugins.some(ep => ep.name === plugin.name)) {
        const p = new Plugin(plugin);
        await load_plugins.loadPlugin(p);
        await p.upsert();
      }
    }
    for (const tableSpec of pack.tables) {
      await Table.create(tableSpec.name, tableSpec);
    }
    for (const tableSpec of pack.tables) {
      const table = await Table.findOne({ name: tableSpec.name });
      for (const field of tableSpec.fields)
        await Field.create({ table, ...field });
    }
    for (const viewSpec of pack.views) {
      const { table, ...viewNoTable } = viewSpec;
      const vtable = await Table.findOne({ name: table });
      await View.create({ ...viewNoTable, table_id: vtable.id });
    }
  }
);

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

router.post("/create", isAdmin, async (req, res) => {
  var pack = { tables: [], views: [], plugins: [] };
  for (const k of Object.keys(req.body)) {
    const [type, name] = k.split(".");
    switch (type) {
      case "table":
        pack.tables.push(await table_pack(name));
        break;
      case "view":
        pack.views.push(await view_pack(name));
        break;
      case "plugin":
        pack.plugins.push(await plugin_pack(name));
        break;

      default:
        break;
    }
  }
  res.sendWrap(`Pack`, pre({ class: "wsprewrap" }, code(JSON.stringify(pack))));
});

router.get("/install", isAdmin, async (req, res) => {
  res.sendWrap(
    `Install Pack`,
    renderForm(
      new Form({
        action: "/packs/install",
        fields: [
          {
            name: "pack",
            type: "String",
            fieldview: "textarea"
          }
        ]
      })
    )
  );
});

router.post("/install", isAdmin, async (req, res) => {
  const pack = JSON.parse(req.body.pack);
  //console.log(pack)
  await install_pack(pack);

  res.redirect(`/plugins`);
});

router.post("/install-named/:name", isAdmin, async (req, res) => {
  const { name } = req.params;

  const pack = await fetch_pack_by_name(name);
  //console.log(pack)
  await install_pack(pack.pack);

  res.redirect(`/plugins`);
});
