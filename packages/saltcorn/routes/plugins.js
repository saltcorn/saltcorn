const Router = require("express-promise-router");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");
const Form = require("saltcorn-data/models/form");
const Field = require("saltcorn-data/models/field");
const Plugin = require("saltcorn-data/models/plugin");
const load_plugins = require("../load_plugins");
const { h5 } = require("saltcorn-markup/tags");

const router = new Router();
module.exports = router;

const pluginForm = plugin => {
  const form = new Form({
    action: "/plugins",
    fields: [
      new Field({ label: "Name", name: "name", input_type: "text" }),
      new Field({
        label: "Source",
        name: "source",
        type: State.types.String,
        required: true,
        attributes: { options: "npm,local,github" }
      }),
      new Field({ label: "Location", name: "location", input_type: "text" })
    ],
    submitLabel: plugin ? "Save" : "Create"
  });
  if (plugin) {
    if (plugin.id) form.hidden("id");
    form.values = plugin;
  }
  return form;
};
router.get("/", isAdmin, async (req, res) => {
  const rows = await Plugin.find({});
  const instore = await Plugin.store_plugins_available();
  res.sendWrap(
    "Plugins",
    h5("Installed"),
    mkTable(
      [
        { label: "Name", key: "name" },
        { label: "Source", key: "source" },
        { label: "Location", key: "location" },
        { label: "View", key: r => link(`/plugins/${r.id}`, "Edit") },
        {
          label: "Reload",
          key: r => post_btn(`/plugins/reload/${r.id}`, "Reload")
        },
        {
          label: "Delete",
          key: r => post_btn(`/plugins/delete/${r.id}`, "Remove")
        }
      ],
      rows
    ),
    h5("Available"),
    mkTable(
      [
        { label: "Name", key: "name" },
        {
          label: "Install",
          key: r => post_btn(`/plugins/install/${r.name}`, "Install")
        }
      ],
      instore
    ),
    link(`/plugins/new`, "Add plugin")
  );
});

router.get("/new/", isAdmin, async (req, res) => {
  res.sendWrap(`New Plugin`, renderForm(pluginForm()));
});

router.get("/:id/", isAdmin, async (req, res) => {
  const { id } = req.params;
  const plugin = await Plugin.findOne({ id });

  res.sendWrap(`Edit Plugin`, renderForm(pluginForm(plugin)));
});

router.post("/", isAdmin, async (req, res) => {
  const plugin = new Plugin(req.body);
  try {
    await load_plugins.loadPlugin(plugin);
    await plugin.upsert();
    req.flash("success", "Plugin installed");

    res.redirect(`/plugins`);
  } catch (e) {
    req.flash("error", `${e}`);
    const form = pluginForm(plugin);
    res.sendWrap(`Edit Plugin`, renderForm(form));
  }
});

router.post("/delete/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  await Plugin.deleteWhere({ id });
  req.flash("success", "Plugin removed");

  res.redirect(`/plugins`);
});

router.post("/reload/:id", isAdmin, async (req, res) => {
  const { id } = req.params;

  const plugin = await Plugin.findOne({ id });
  await load_plugins.loadPlugin(plugin);

  res.redirect(`/plugins`);
});

router.post("/install/:name", isAdmin, async (req, res) => {
  const { name } = req.params;

  const plugin = await Plugin.store_by_name(name);
  await load_plugins.loadPlugin(plugin);
  await plugin.upsert();
  req.flash("success", "Plugin installed");
  res.redirect(`/plugins`);
});
