const Router = require("express-promise-router");
const { setTenant, isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const Plugin = require("@saltcorn/data/models/plugin");
const { fetch_available_packs } = require("@saltcorn/data/models/pack");
const { getConfig, setConfig } = require("@saltcorn/data/models/config");

const load_plugins = require("../load_plugins");
const { h5, nbsp } = require("@saltcorn/markup/tags");

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
        type: getState().types.String,
        required: true,
        attributes: { options: "npm,local,github" }
      }),
      new Field({ label: "Location", name: "location", input_type: "text" }),
      new Field({ label: "Version", name: "version", input_type: "text" })
    ],
    submitLabel: plugin ? "Save" : "Create"
  });
  if (plugin) {
    if (plugin.id) form.hidden("id");
    form.values = plugin;
  } else {
    form.values.version = "latest";
  }
  return form;
};
router.get("/", setTenant, isAdmin, async (req, res) => {
  const rows = await Plugin.find({});
  const instore = await Plugin.store_plugins_available();
  const packs_available = await fetch_available_packs();
  const packs_installed = getState().getConfig("installed_packs", []);
  res.sendWrap("Plugins", {
    above: [
      {
        type: "card",
        title: "Installed plugins",
        contents: mkTable(
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
        )
      },
      {
        besides: [
          {
            type: "card",
            title: "Available plugins",
            contents: [
              mkTable(
                [
                  { label: "Name", key: "name" },
                  {
                    label: "Install",
                    key: r =>
                      post_btn(
                        `/plugins/install/${encodeURIComponent(r.name)}`,
                        "Install"
                      )
                  }
                ],
                instore
              ),
              link(`/plugins/new`, "Add another plugin")
            ]
          },
          {
            type: "card",
            title: "Available packs",
            contents: [
              mkTable(
                [
                  { label: "Name", key: "name" },
                  {
                    label: "Install",
                    key: r =>
                      packs_installed.includes(r.name)
                        ? "Installed"
                        : post_btn(
                            `/packs/install-named/${encodeURIComponent(
                              r.name
                            )}`,
                            "Install"
                          )
                  }
                ],
                packs_available
              ),
              link(`/packs/install`, "Install another pack"),
              nbsp,
              "|",
              nbsp,
              link(`/packs/create`, "Create pack")
            ]
          }
        ]
      }
    ]
  });
});

router.get("/new/", setTenant, isAdmin, async (req, res) => {
  res.sendWrap(`New Plugin`, renderForm(pluginForm()));
});

router.get("/:id/", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;
  const plugin = await Plugin.findOne({ id });

  res.sendWrap(`Edit Plugin`, renderForm(pluginForm(plugin)));
});

router.post("/", setTenant, isAdmin, async (req, res) => {
  const plugin = new Plugin(req.body);
  try {
    await load_plugins.loadPlugin(plugin);
    await plugin.upsert();
    req.flash("success", `Plugin ${plugin.name} installed`);

    res.redirect(`/plugins`);
  } catch (e) {
    req.flash("error", `${e}`);
    const form = pluginForm(plugin);
    res.sendWrap(`Edit Plugin`, renderForm(form));
  }
});

router.post("/delete/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;

  const plugin = await Plugin.findOne({ id });
  const depviews = await plugin.dependant_views();
  if (depviews.length === 0) {
    await plugin.delete();
    req.flash(
      "success",
      "Plugin removed. You may need to restart the server (Settings » Admin) for changes to take effect."
    );
  } else {
    req.flash(
      "error",
      `Cannot remove plugin: views ${depviews.join()} depend on it`
    );
  }
  res.redirect(`/plugins`);
});

router.post("/reload/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;

  const plugin = await Plugin.findOne({ id });
  await load_plugins.loadPlugin(plugin);

  res.redirect(`/plugins`);
});

router.post("/install/:name", setTenant, isAdmin, async (req, res) => {
  const { name } = req.params;

  const plugin = await Plugin.store_by_name(name);
  await load_plugins.loadPlugin(plugin);
  await plugin.upsert();
  req.flash("success", `Plugin ${plugin.name} installed`);
  res.redirect(`/plugins`);
});
