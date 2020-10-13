const Router = require("express-promise-router");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
} = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const Plugin = require("@saltcorn/data/models/plugin");
const { fetch_available_packs } = require("@saltcorn/data/models/pack");
const { getConfig, setConfig } = require("@saltcorn/data/models/config");
const db = require("@saltcorn/data/db");

const load_plugins = require("../load_plugins");
const {
  h5,
  nbsp,
  a,
  div,
  span,
  ul,
  li,
  button,
} = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

const pluginForm = (plugin) => {
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
        attributes: { options: "npm,local,github" },
      }),
      new Field({ label: "Location", name: "location", input_type: "text" }),
      ...(schema === "public"
        ? [new Field({ label: "Version", name: "version", input_type: "text" })]
        : []),
    ],
    submitLabel: plugin ? "Save" : "Create",
  });
  if (plugin) {
    if (plugin.id) form.hidden("id");
    form.values = plugin;
  }
  return form;
};
const local_has_theme = (name) => {
  const mod = getState().plugins[name];
  return mod ? mod.layout : false;
};
const get_store_items = async () => {
  const installed_plugins = await Plugin.find({});
  const instore = await Plugin.store_plugins_available();
  const packs_available = await fetch_available_packs();
  const packs_installed = getState().getConfig("installed_packs", []);
  const schema = db.getTenantSchema();
  const installed_plugin_names = installed_plugins.map((p) => p.name);
  const store_plugin_names = instore.map((p) => p.name);
  const plugins_item = instore.map((plugin) => ({
    name: plugin.name,
    installed: installed_plugin_names.includes(plugin.name),
    plugin: true,
    description: plugin.description,
    documentation_link: plugin.documentation_link,
    has_theme: plugin.has_theme,
  }));

  const local_logins = installed_plugins
    .filter((p) => !store_plugin_names.includes(p.name) && p.name !== "base")
    .map((plugin) => ({
      name: plugin.name,
      installed: true,
      plugin: true,
      description: plugin.description,
      has_theme: local_has_theme(plugin.name),
      github: plugin.source === "github",
      local: plugin.source === "local",
    }));

  const pack_items = packs_available.map((pack) => ({
    name: pack.name,
    installed: packs_installed.includes(pack.name),
    pack: true,
    description: pack.description,
  }));

  return [...plugins_item, ...local_logins, ...pack_items].sort((a, b) =>
    a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
  );
};

const cfg_link = (req, row) => {
  const plugin = getState().plugins[row.name];
  if (!plugin) return "";
  if (plugin.configuration_workflow)
    return a(
      {
        class: "btn btn-secondary btn-sm d-inline",
        role: "button",
        href: `/plugins/configure/${encodeURIComponent(row.name)}`,
        title: req.__("Configure plugin"),
      },
      '<i class="fas fa-cog"></i>'
    );
  else return "";
};

const badge = (title) =>
  span({ class: "badge badge-secondary plugin-store" }, title);

const store_item_html = (req) => (item) => ({
  type: "card",
  title: item.name,
  contents: div(
    div(
      item.plugin && badge(req.__("Plugin")),
      item.pack && badge(req.__("Pack")),
      item.has_theme && badge(req.__("Theme")),
      item.github && badge("GitHub"),
      item.local && badge(req.__("Local")),
      item.installed && badge(req.__("Installed"))
    ),
    div(item.description || ""),
    item.documentation_link
      ? div(link(item.documentation_link, "Documentation"))
      : ""
  ),
  footer: div(
    div(
      !item.installed &&
        item.plugin &&
        post_btn(
          `/plugins/install/${encodeURIComponent(item.name)}`,
          req.__("Install"),
          req.csrfToken(),
          {
            klass: "store-install",
            small: true,
            onClick: "press_store_button(this)",
          }
        ),
      !item.installed &&
        item.pack &&
        post_btn(
          `/packs/install-named/${encodeURIComponent(item.name)}`,
          req.__("Install"),
          req.csrfToken(),
          {
            klass: "store-install",
            small: true,
            onClick: "press_store_button(this)",
          }
        ),

      item.installed && item.plugin && cfg_link(req, item),
      item.installed &&
        item.pack &&
        post_btn(
          `/packs/uninstall/${encodeURIComponent(item.name)}`,
          req.__("Uninstall"),
          req.csrfToken(),
          {
            klass: "store-install",
            small: true,
            btnClass: "danger",
            formClass: "d-inline",
            onClick: "press_store_button(this)",
          }
        ),
      item.installed &&
        item.plugin &&
        item.name !== "base" &&
        post_btn(
          `/plugins/delete/${encodeURIComponent(item.name)}`,
          req.__("Remove"),
          req.csrfToken(),
          {
            klass: "store-install",
            small: true,
            btnClass: "danger",
            formClass: "d-inline",
            onClick: "press_store_button(this)",
          }
        )
    )
  ),
});
const storeNavPills = (req) => {
  const link = (txt) =>
    li(
      { class: "nav-item" },
      a(
        {
          href: `/plugins?set=${txt.toLowerCase()}`,
          class: [
            "nav-link",
            (req.query.set === txt.toLowerCase() ||
              (txt === "All" && !req.query.set)) &&
              "active",
          ],
        },
        txt
      )
    );
  return ul(
    { class: "nav nav-pills" },
    link(req.__("All")),
    link(req.__("Plugins")),
    link(req.__("Packs")),
    link(req.__("Themes")),
    link(req.__("Installed"))
  );
};

const filter_items = (items, query) => {
  switch (query.set) {
    case "plugins":
      return items.filter((item) => item.plugin);
    case "packs":
      return items.filter((item) => item.pack);
    case "themes":
      return items.filter((item) => item.has_theme);
    case "installed":
      return items.filter((item) => item.installed);
    default:
      return items;
  }
};

const store_actions_dropdown = (req) =>
  div(
    { class: "dropdown" },
    button(
      {
        class: "btn btn-outline-secondary",
        type: "button",
        id: "dropdownMenuButton",
        "data-toggle": "dropdown",
        "aria-haspopup": "true",
        "aria-expanded": "false",
      },
      '<i class="fas fa-ellipsis-h"></i>'
    ),
    div(
      {
        class: "dropdown-menu dropdown-menu-right",
        "aria-labelledby": "dropdownMenuButton",
      },
      a(
        {
          class: "dropdown-item",
          href: `/plugins/refresh`,
        },
        '<i class="fas fa-sync"></i>&nbsp;' + req.__("Refresh")
      ),
      db.getTenantSchema() === "public" &&
        a(
          {
            class: "dropdown-item",
            href: `/plugins/upgrade`,
          },
          '<i class="far fa-arrow-alt-circle-up"></i>&nbsp;' +
            req.__("Upgrade installed plugins")
        ),
      db.getTenantSchema() === "public" &&
        a(
          {
            class: "dropdown-item",
            href: `/plugins/new`,
          },
          '<i class="fas fa-plus"></i>&nbsp;' + req.__("Add another plugin")
        ),

      a(
        {
          class: "dropdown-item",
          href: `/packs/install`,
        },
        '<i class="fas fa-box-open"></i>&nbsp;' + req.__("Add another pack")
      ),
      a(
        {
          class: "dropdown-item",
          href: `/packs/create`,
        },
        '<i class="fas fa-plus-square"></i>&nbsp;' + req.__("Create pack")
      )

      //another pack
      //create pack
    )
  );
const plugin_store_html = (items, req) => {
  return {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [{ text: req.__("Settings") }, { text: req.__("Plugins") }],
      },
      {
        type: "pageHeader",
        title: req.__("Plugin and pack store"),
      },
      {
        type: "card",
        contents: div(
          { class: "d-flex" },
          storeNavPills(req),
          div({ class: "ml-auto" }, store_actions_dropdown(req))
        ),
      },
      {
        besides: items.map(store_item_html(req)),
        widths: items.map((item) => 4),
      },
    ],
  };
};

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const items = await get_store_items();
    const relevant_items = filter_items(items, req.query);
    res.sendWrap(req.__("Plugins"), plugin_store_html(relevant_items, req));
  })
);

router.get(
  "/configure/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    const module = getState().plugins[plugin.name];
    const flow = module.configuration_workflow();
    flow.action = `/plugins/configure/${plugin.name}`;
    const wfres = await flow.run(plugin.configuration || {});

    res.sendWrap(
      `Configure ${plugin.name} Plugin`,
      renderForm(wfres.renderForm, req.csrfToken())
    );
  })
);
router.post(
  "/configure/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    const module = getState().plugins[plugin.name];
    const flow = module.configuration_workflow();
    flow.action = `/plugins/configure/${plugin.name}`;
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
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(`New Plugin`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: "Plugins", href: "/plugins" },
            { text: "New" },
          ],
        },
        {
          type: "card",
          title: `Add plugin`,
          contents: renderForm(pluginForm(), req.csrfToken()),
        },
      ],
    });
  })
);

router.get(
  "/refresh",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    await getState().deleteConfig("available_plugins");
    await getState().deleteConfig("available_plugins_fetched_at");
    await getState().deleteConfig("available_packs");
    await getState().deleteConfig("available_packs_fetched_at");
    req.flash("success", `Store refreshed`);

    res.redirect(`/plugins`);
  })
);

router.get(
  "/upgrade",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const installed_plugins = await Plugin.find({});
    for (const plugin of installed_plugins) {
      await plugin.upgrade_version((p, f) => load_plugins.loadPlugin(p, f));
    }
    req.flash("success", `Plugins up-to-date`);

    res.redirect(`/plugins`);
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
  "/delete/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
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
  "/install/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const plugin = await Plugin.store_by_name(decodeURIComponent(name));
    delete plugin.id;
    await load_plugins.loadAndSaveNewPlugin(plugin);
    const plugin_module = getState().plugins[name];
    if (plugin_module && plugin_module.configuration_workflow) {
      const plugin_db = await Plugin.findOne({ name });
      req.flash(
        "success",
        `Plugin ${plugin_db.name} installed, please complete configuration.`
      );
      res.redirect(`/plugins/configure/${plugin_db.name}`);
    } else {
      req.flash("success", `Plugin ${plugin.name} installed`);
      res.redirect(`/plugins`);
    }
  })
);
