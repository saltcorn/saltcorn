const Router = require("express-promise-router");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const { mkTable, renderForm, link, post_btn,post_delete_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const Plugin = require("@saltcorn/data/models/plugin");
const { fetch_available_packs } = require("@saltcorn/data/models/pack");
const { getConfig, setConfig } = require("@saltcorn/data/models/config");
const db = require("@saltcorn/data/db");

const load_plugins = require("../load_plugins");
const { h5, nbsp,a } = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

const pluginForm = plugin => {
  const schema = db.getTenantSchema();
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
      ...(schema === "public"
        ? [new Field({ label: "Version", name: "version", input_type: "text" })]
        : [])
    ],
    submitLabel: plugin ? "Save" : "Create"
  });
  if (plugin) {
    if (plugin.id) form.hidden("id");
    form.values = plugin;
  }
  return form;
};
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const rows = await Plugin.find({});
    const instore = await Plugin.store_plugins_available();
    const packs_available = await fetch_available_packs();
    const packs_installed = getState().getConfig("installed_packs", []);
    const schema = db.getTenantSchema();

    const cfg_link = row => {
      const plugin = getState().plugins[row.name];
      if (!plugin) return "";
      if (plugin.configuration_workflow)
        return a({class: "btn btn-secondary btn-sm", role: "button", href: `/plugins/configure/${row.id}`}, '<i class="fas fa-cog"></i>');
      else return "";
    };

    res.sendWrap("Plugins", {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: "Settings" }, { text: "Plugins" }]
        },
        {
          type: "card",
          title: "Installed plugins",
          contents: mkTable(
            [
              { label: "Name", key: "name" },
              { label: "Source", key: "source" },
              { label: "Location", key: "location" },
              { label: "Edit", key: r => a({class: "btn btn-outline-secondary btn-sm", role: "button", href: `/plugins/${r.id}`},'<i class="fas fa-edit"></i>') },
              { label: "Configure", key: r => cfg_link(r) },
              {
                label: "Reload",
                key: r =>
                  post_btn(`/plugins/reload/${r.id}`, '<i class="fas fa-sync"></i>', req.csrfToken(),{btnClass: "secondary", small: true})
              },
              {
                label: "Delete", 
                key: r =>
                post_delete_btn(`/plugins/delete/${r.id}`, req.csrfToken())
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
                          "Install",
                          req.csrfToken(),
                          {klass: "store-install", onClick:"press_store_button(this)"}
                        )
                    }
                  ],
                  instore
                ),
                schema === "public"
                  ? link(`/plugins/new`, "Add another plugin")
                  : ""
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
                              "Install",
                              req.csrfToken(),
                              {klass: "store-install",onClick: "press_store_button(this)"} 
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
  })
);

router.get(
  "/configure/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const plugin = await Plugin.findOne({ id });
    const module = getState().plugins[plugin.name];
    const flow = module.configuration_workflow();
    flow.action = `/plugins/configure/${plugin.id}`;
    const wfres = await flow.run(plugin.configuration || {});

    res.sendWrap(
      `Configure ${plugin.name} Plugin`,
      renderForm(wfres.renderForm, req.csrfToken())
    );
  })
);
router.post(
  "/configure/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const plugin = await Plugin.findOne({ id });
    const module = getState().plugins[plugin.name];
    const flow = module.configuration_workflow();
    flow.action = `/plugins/configure/${plugin.id}`;
    const wfres = await flow.run(req.body);
    if (wfres.renderForm)
      res.sendWrap(
        `Configure ${plugin.name} Plugin`,
        renderForm(wfres.renderForm, req.csrfToken())
      );
    else {
      plugin.configuration = wfres;
      await plugin.upsert();
      await load_plugins.loadPlugin(plugin);
      res.redirect("/plugins");
    }
  })
);
router.get(
  "/new/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(`New Plugin`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: "Settings" },
            { text: "Plugins", href: "/plugins" },
            { text: "New" }
          ]
        },
        {
          type: "card",
          title: `Add plugin`,
          contents: renderForm(pluginForm(), req.csrfToken())
        }
      ]
    });
  })
);

router.get(
  "/:id/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const plugin = await Plugin.findOne({ id });

    res.sendWrap(`Edit Plugin`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: "Settings" },
            { text: "Plugins", href: "/plugins" },
            { text: plugin.name }
          ]
        },
        {
          type: "card",
          title: `Edit ${plugin.name} plugin`,
          contents: renderForm(pluginForm(plugin), req.csrfToken())
        }
      ]
    });
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const plugin = new Plugin(req.body);
    const schema = db.getTenantSchema();
    if (schema !== "public") {
      req.flash(
        "error",
        `Only store plugins can be installed on tenant instances`
      );
      res.redirect(`/plugins`);
    } else {
      try {
        await load_plugins.loadAndSaveNewPlugin(
          plugin,
          schema === "public" || plugin.source === "github"
        );
        req.flash("success", `Plugin ${plugin.name} installed`);
        res.redirect(`/plugins`);
      } catch (e) {
        req.flash("error", `${e.message}`);
        const form = pluginForm(plugin);
        res.sendWrap(`Edit Plugin`, renderForm(form, req.csrfToken()));
      }
    }
  })
);

router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;

    const plugin = await Plugin.findOne({ id });
    const depviews = await plugin.dependant_views();
    if (depviews.length === 0) {
      await plugin.delete();
      req.flash("success", `Plugin ${plugin.name} removed.`);
    } else {
      req.flash(
        "error",
        `Cannot remove plugin: views ${depviews.join()} depend on it`
      );
    }
    res.redirect(`/plugins`);
  })
);

router.post(
  "/reload/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;

    const plugin = await Plugin.findOne({ id });
    await load_plugins.loadPlugin(plugin);

    res.redirect(`/plugins`);
  })
);

router.post(
  "/install/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const plugin = await Plugin.store_by_name(name);
    await load_plugins.loadAndSaveNewPlugin(plugin);
    const plugin_module = getState().plugins[name];
    if (plugin_module && plugin_module.configuration_workflow) {
      const plugin_db = await Plugin.findOne({ name });
      req.flash(
        "success",
        `Plugin ${plugin_db.name} installed, please complete configuration.`
      );
      res.redirect(`/plugins/configure/${plugin_db.id}`);
    } else {
      req.flash("success", `Plugin ${plugin.name} installed`);
      res.redirect(`/plugins`);
    }
  })
);
