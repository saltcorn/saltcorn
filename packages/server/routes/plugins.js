/**
 * Plugin Handler for Admin zone
 */


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
const {
  plugin_types_info_card,
  plugin_functions_info_card,
  plugin_viewtemplates_info_card,
  showRepository,
} = require("../markup/plugin-store");
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
  table,
  tbody,
  tr,
  th,
  td,
  p,
  strong,
} = require("@saltcorn/markup/tags");
const { search_bar } = require("@saltcorn/markup/helpers");
const fs = require("fs");
const path = require("path");
const { get_latest_npm_version } = require("@saltcorn/data/models/config");
const { flash_restart } = require("../markup/admin.js");

const router = new Router();
module.exports = router;
/**
 * Plugin Form Creation
 * @param req
 * @param plugin
 * @returns {Form}
 */
const pluginForm = (req, plugin) => {
  const schema = db.getTenantSchema();
  const form = new Form({
    action: "/plugins",
    fields: [
      new Field({
          label: req.__("Name"),
          name: "name",
          input_type: "text",
          sublabel: req.__("Plugin name"),
      }),
      new Field({
        label: req.__("Source"),
        name: "source",
        type: getState().types.String,
        required: true,
        attributes: { options: "npm,local,github,git" },
        sublabel: req.__(
            "Source of plugin for install. Few options:"+
            "npm - download from npm repository,"+
            "local - get from local file system,"+
            "github - download from github,"+
            "git - get from git"
        ),
      }),
      new Field({
        label: req.__("Location"),
        name: "location",
        input_type: "text",
        sublabel: req.__(
            "For npm - name of npm package, e.g. @saltcorn/html or saltcorn-gantt, check at npmjs.com, "+
            "for local - absolute path to plugin folder in file system, e.g.C:\\gitsrc\\any-bootstrap-theme\\, "+
            "for github - name of github project."
        ),
      }),
      ...(schema === db.connectObj.default_schema
        ? [
            new Field({
              label: req.__("Version"),
              name: "version",
              input_type: "text",
              sublabel: req.__("Version of plugin, latest is default value"),
            }),
          ]
        : []),
      new Field({
        label: req.__("Private SSH key"),
        sublabel:
          "Optional, for private repositories. Generate key by running ssh-keygen, then upload public key as GitHub or GitLab deploy key",
        name: "deploy_private_key",
        input_type: "textarea",
        showIf: { source: "git" },
      }),
    ],
    submitLabel: plugin ? req.__("Save") : req.__("Create"),
  });
  if (plugin) {
    if (plugin.id) form.hidden("id");
    form.values = plugin;
  }
  return form;
};
/**
 * Returns true if plugin has own theme
 * @param name -plugin name
 * @returns {*|boolean}
 */
const local_has_theme = (name) => {
  const mod = getState().plugins[name];
  return mod ? mod.layout : false;
};
/**
 * Get Pluging store itmes
 * @returns {Promise<*[]>}
 */
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
    has_auth: plugin.has_auth,
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
      git: plugin.source === "git",
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
        class: "btn btn-secondary btn-sm d-inline mr-1",
        role: "button",
        href: `/plugins/configure/${encodeURIComponent(row.name)}`,
        title: req.__("Configure plugin"),
      },
      '<i class="fas fa-cog"></i>'
    );
  else return "";
};

const info_link = (req, row) =>
  a(
    {
      class: "btn btn-secondary btn-sm d-inline",
      role: "button",
      href: `/plugins/info/${encodeURIComponent(row.name)}`,
      title: req.__("Information about plugin"),
    },
    '<i class="far fa-question-circle"></i>'
  );

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
      item.has_auth && badge(req.__("Authentication")),
      item.github && badge("GitHub"),
      item.git && badge("Git"),
      item.local && badge(req.__("Local")),
      item.installed && badge(req.__("Installed"))
    ),
    div(item.description || ""),
    item.documentation_link
      ? div(
          a(
            { href: item.documentation_link, target: "_blank" },
            req.__("Documentation")
          )
        )
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
      item.installed && item.plugin && info_link(req, item),

      item.installed &&
        item.pack &&
        post_btn(
          `/packs/uninstall/${encodeURIComponent(item.name)}`,
          req.__("Uninstall"),
          req.csrfToken(),
          {
            klass: "store-install",
            small: true,
            btnClass: "btn-danger",
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
            btnClass: "btn-danger",
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
        req.__(txt)
      )
    );
  return ul(
    { class: "nav nav-pills plugin-section" },
    link("All"),
    link("Plugins"),
    link("Packs"),
    link("Themes"),
    link("Installed")
  );
};

const filter_items = (items, query) => {
  const in_set = filter_items_set(items, query);
  if (!query.q) return in_set;
  return in_set.filter((p) => satisfy_q(p, query.q.toLowerCase()));
};

const match_string = (s, q) => {
  if (!s || !q) return false;
  return s.toLowerCase().includes(q);
};

const satisfy_q = (p, q) => {
  return match_string(p.name, q) || match_string(p.description, q);
};
const filter_items_set = (items, query) => {
  switch (query.set) {
    case "plugins":
      return items.filter((item) => item.plugin && !item.has_theme);
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
      db.getTenantSchema() === db.connectObj.default_schema &&
        a(
          {
            class: "dropdown-item",
            href: `/plugins/upgrade`,
          },
          '<i class="far fa-arrow-alt-circle-up"></i>&nbsp;' +
            req.__("Upgrade installed plugins")
        ),
      db.getTenantSchema() === db.connectObj.default_schema &&
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
        crumbs: [
          { text: req.__("Settings"), href: "/settings" },
          { text: req.__("Plugin and pack store") },
        ],
      },
      {
        type: "card",
        contents: div(
          { class: "d-flex" },
          storeNavPills(req),
          div(
            { class: "ml-auto" },
            search_bar("q", req.query.q || "", { stateField: "q" })
          ),
          div({ class: "ml-auto" }, store_actions_dropdown(req))
        ),
      },
      {
        besides: items.map(store_item_html(req)),
        widths: items.map((item) => 4), // todo warning that item uis unused
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
    if (!plugin) {
      req.flash("warning", "Plugin not found");
      res.redirect("/plugins");
      return;
    }
    const module = getState().plugins[plugin.name];
    const flow = module.configuration_workflow();
    flow.action = `/plugins/configure/${encodeURIComponent(plugin.name)}`;
    const wfres = await flow.run(plugin.configuration || {});

    res.sendWrap(
      req.__(`Configure %s Plugin`, plugin.name),
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
    flow.action = `/plugins/configure/${encodeURIComponent(plugin.name)}`;
    const wfres = await flow.run(req.body);
    if (wfres.renderForm)
      res.sendWrap(
        req.__(`Configure %s Plugin`, plugin.name),
        renderForm(wfres.renderForm, req.csrfToken())
      );
    else {
      plugin.configuration = wfres;
      await plugin.upsert();
      await load_plugins.loadPlugin(plugin);
      const instore = await Plugin.store_plugins_available();
      const store_plugin = instore.find((p) => p.name === plugin.name);
      if (store_plugin && store_plugin.has_auth) flash_restart(req);
      res.redirect("/plugins");
    }
  })
);
router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__(`New Plugin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings"), href: "/settings" },
            { text: req.__("Plugin and pack store"), href: "/plugins" },
            { text: req.__("New") },
          ],
        },
        {
          type: "card",
          title: req.__(`Add plugin`),
          contents: renderForm(pluginForm(req), req.csrfToken()),
        },
      ],
    });
  })
);
router.get(
  "/public/:plugin/:file",
  setTenant,
  error_catcher(async (req, res) => {
    const { plugin, file } = req.params;

    const location = getState().plugin_locations[plugin];
    if (location) {
      var safeFile = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, "");
      const fullpath = path.join(location, "public", safeFile);
      if (fs.existsSync(fullpath)) res.sendFile(fullpath);
      else res.status(404).send(req.__("Not found"));
    } else {
      res.status(404).send(req.__("Not found"));
    }
  })
);
router.get(
  "/info/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const plugin_db = await Plugin.findOne({ name });
    const mod = await load_plugins.requirePlugin(plugin_db);
    const store_items = await get_store_items();
    const store_item = store_items.find((item) => item.name === name);
    const update_permitted =
      db.getTenantSchema() === db.connectObj.default_schema &&
      plugin_db.source === "npm";
    const latest =
      update_permitted && (await get_latest_npm_version(plugin_db.location));
    const can_update = update_permitted && latest && mod.version !== latest;
    let pkgjson;
    if (mod.location && fs.existsSync(path.join(mod.location, "package.json")))
      pkgjson = require(path.join(mod.location, "package.json"));

    if (!plugin_db) {
      req.flash("warning", "Plugin not found");
      res.redirect("/plugins");
      return;
    }
    const infoTable = table(
      tbody(
        tr(th(req.__("Package name")), td(mod.name)),
        tr(th(req.__("Package version")), td(mod.version)),
        tr(
          th(req.__("Latest version")),
          td(
            latest || "",
            can_update
              ? a(
                  {
                    href: `/plugins/upgrade-plugin/${plugin_db.name}`,
                    class: "btn btn-primary btn-sm ml-2",
                  },
                  req.__("Upgrade")
                )
              : ""
          )
        ),
        mod.plugin_module.dependencies
          ? tr(
              th(req.__("Plugin dependencies")),
              td(
                mod.plugin_module.dependencies.map((d) =>
                  span({ class: "badge badge-primary mr-1" }, d)
                )
              )
            )
          : null,
        store_item && store_item.documentation_link
          ? tr(
              th(req.__("Documentation")),
              td(
                link(
                  store_item.documentation_link,
                  store_item.documentation_link
                )
              )
            )
          : null,
        pkgjson && pkgjson.repository
          ? tr(th(req.__("Repository")), td(showRepository(pkgjson.repository)))
          : null
      )
    );
    let cards = [];
    if (mod.plugin_module.layout)
      cards.push({
        type: "card",
        title: req.__("Layout"),
        contents: req.__("This plugin supplies a theme."),
      });
    if (mod.plugin_module.types) cards.push(plugin_types_info_card(mod, req));
    if (mod.plugin_module.functions)
      cards.push(plugin_functions_info_card(mod, req));
    if (mod.plugin_module.viewtemplates)
      cards.push(plugin_viewtemplates_info_card(mod, req));
    res.sendWrap(req.__(`New Plugin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings"), href: "/settings" },
            { text: req.__("Plugin and pack store"), href: "/plugins" },
            { text: plugin_db.name },
          ],
        },
        {
          type: "card",
          title: req.__(`%s plugin information`, plugin_db.name),
          contents: p(store_item.description) + infoTable,
        },
        ...cards,
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
    req.flash("success", req.__(`Store refreshed`));

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
    req.flash("success", req.__(`Plugins up-to-date`));

    res.redirect(`/plugins`);
  })
);

router.get(
  "/upgrade-plugin/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const plugin = await Plugin.findOne({ name });
    await plugin.upgrade_version((p, f) => load_plugins.loadPlugin(p, f));
    req.flash("success", req.__(`Plugin up-to-date`));

    res.redirect(`/plugins/info/${plugin.name}`);
  })
);
router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const plugin = new Plugin(req.body);
    const schema = db.getTenantSchema();
    if (schema !== db.connectObj.default_schema) {
      req.flash(
        "error",
        req.__(`Only store plugins can be installed on tenant instances`)
      );
      res.redirect(`/plugins`);
    } else {
      try {
        await load_plugins.loadAndSaveNewPlugin(
          plugin,
          schema === db.connectObj.default_schema || plugin.source === "github"
        );
        req.flash("success", req.__(`Plugin %s installed`, plugin.name));
        res.redirect(`/plugins`);
      } catch (e) {
        req.flash("error", `${e.message}`);
        const form = pluginForm(req, plugin);
        res.sendWrap(req.__(`Edit Plugin`), renderForm(form, req.csrfToken()));
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
    if (!plugin) {
      req.flash("warning", "Plugin not found");
      res.redirect("/plugins");
      return;
    }
    const depviews = await plugin.dependant_views();
    if (
      depviews.length === 0 ||
      getState().getConfig("development_mode", false)
    ) {
      await plugin.delete();
      req.flash("success", req.__(`Plugin %s removed.`, plugin.name));
    } else {
      req.flash(
        "error",
        req.__(`Cannot remove plugin: views %s depend on it`, depviews.join())
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
        req.__(
          `Plugin %s installed, please complete configuration.`,
          plugin_db.name
        )
      );
      res.redirect(`/plugins/configure/${plugin_db.name}`);
    } else {
      req.flash("success", req.__(`Plugin %s installed`, plugin.name));
      res.redirect(`/plugins`);
    }
  })
);
