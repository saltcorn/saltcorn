/**
 * Plugin Handler for Admin zone
 * @category server
 * @module routes/plugins
 * @subcategory routes
 */

const Router = require("express-promise-router");
const { isAdmin, loggedIn, error_catcher } = require("./utils.js");
const { renderForm, link, post_btn } = require("@saltcorn/markup");
const {
  getState,
  restart_tenant,
  getRootState,
} = require("@saltcorn/data/db/state");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const Plugin = require("@saltcorn/data/models/plugin");
const User = require("@saltcorn/data/models/user");
const { fetch_available_packs } = require("@saltcorn/admin-models/models/pack");
const {
  upgrade_all_tenants_plugins,
} = require("@saltcorn/admin-models/models/tenant");
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
  form,
  select,
  option,
  input,
  label,
  text,
  script,
  domReady,
} = require("@saltcorn/markup/tags");
const { search_bar } = require("@saltcorn/markup/helpers");
const fs = require("fs");
const path = require("path");
const { get_latest_npm_version } = require("@saltcorn/data/models/config");
const { flash_restart } = require("../markup/admin.js");
const {
  sleep,
  removeNonWordChars,
  getFetchProxyOptions,
} = require("@saltcorn/data/utils");
const { loadAllPlugins } = require("../load_plugins");
const npmFetch = require("npm-registry-fetch");
const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer");
const {
  supportedVersion,
  isVersionSupported,
} = require("@saltcorn/plugins-loader/stable_versioning");

/**
 * @type {object}
 * @const
 * @namespace pluginsRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * Plugin Form Creation
 * @param {object} req
 * @param {object} plugin
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
        sublabel: req.__("Module name"),
      }),
      new Field({
        label: req.__("Source"),
        name: "source",
        type: getState().types.String,
        required: true,
        attributes: { options: "npm,local,github,git" },
        sublabel: req.__(
          "Source of module for install. Few options:" +
            "npm - download from npm repository," +
            "local - get from local file system," +
            "github - download from github," +
            "git - get from git"
        ),
      }),
      new Field({
        label: req.__("Location"),
        name: "location",
        input_type: "text",
        sublabel: req.__(
          "For npm - name of npm package, e.g. @saltcorn/html or saltcorn-gantt, check at npmjs.com, " +
            "for local - absolute path to module folder in file system, e.g. C:\\gitsrc\\any-bootstrap-theme\\, " +
            "for github - name of github project."
        ),
      }),
      ...(schema === db.connectObj.default_schema
        ? [
            new Field({
              label: req.__("Version"),
              name: "version",
              input_type: "text",
              sublabel: req.__("Version of module, latest is default value"),
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
 * @param {string} name plugin name
 * @returns {*|boolean}
 */
const local_has_theme = (name) => {
  const mod = getState().plugins[name];
  return mod ? mod.layout : false;
};

/**
 * Get Pluging store itmes
 * @returns {Promise<Object[]>}
 */
const get_store_items = async () => {
  const installed_plugins = await Plugin.find({});
  const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
  const tenants_unsafe_plugins = getRootState().getConfig(
    "tenants_unsafe_plugins",
    false
  );
  const instore = await Plugin.store_plugins_available();
  const packs_available = await fetch_available_packs();
  const packs_installed = getState().getConfig("installed_packs", []);
  const schema = db.getTenantSchema();
  const installed_plugin_names = installed_plugins.map((p) => p.name);
  const store_plugin_names = instore.map((p) => p.name);
  const plugins_item = instore
    .map((plugin) => ({
      name: plugin.name,
      installed: installed_plugin_names.includes(plugin.name),
      plugin: true,
      description: plugin.description,
      documentation_link: plugin.documentation_link,
      has_theme: plugin.has_theme,
      has_auth: plugin.has_auth,
      unsafe: plugin.unsafe,
      source: plugin.source,
      ready_for_mobile:
        plugin.ready_for_mobile && plugin.ready_for_mobile(plugin.name),
    }))
    .filter((p) => !p.unsafe || isRoot || tenants_unsafe_plugins);
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
      ready_for_mobile:
        plugin.ready_for_mobile && plugin.ready_for_mobile(plugin.name),
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

/**
 * @param {object} req
 * @param {object} row
 * @returns {a|string}
 */
const cfg_link = (req, row) => {
  let plugin = getState().plugins[row.name];
  let linknm = row.name;
  if (!plugin) {
    const othernm = getState().plugin_module_names[row.name];

    if (othernm) {
      linknm = othernm;
      plugin = getState().plugins[othernm];
    }
  }
  if (!plugin) return "";
  if (plugin.configuration_workflow)
    return a(
      {
        class: "btn btn-secondary btn-sm d-inline me-1",
        role: "button",
        href: `/plugins/configure/${encodeURIComponent(row.name)}`,
        title: req.__("Configure plugin"),
      },
      '<i class="fas fa-cog"></i>'
    );
  else return "";
};

/**
 * @param {object} req
 * @param {object} row
 * @returns {a}
 */
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

/**
 * @param {string} title
 * @returns {span}
 */
const badge = (title) =>
  span({ class: "badge bg-secondary plugin-store" }, title);

/**
 *
 * @param {object} req
 * @returns {function}
 */
const store_item_html = (req) => (item) => ({
  type: "card",
  title: item.name,
  contents: div(
    div(
      item.plugin && badge(req.__("Module")),
      item.pack && badge(req.__("Pack")),
      item.has_theme && badge(req.__("Theme")),
      item.has_auth && badge(req.__("Authentication")),
      item.github && badge("GitHub"),
      item.git && badge("Git"),
      item.local && badge(req.__("Local")),
      item.installed && badge(req.__("Installed")),
      item.ready_for_mobile && badge(req.__("Mobile"))
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
        div(
          { class: "me-2 d-inline" },
          post_btn(
            `/plugins/install/${encodeURIComponent(item.name)}`,
            req.__("Install"),
            req.csrfToken(),
            {
              klass: "store-install",
              small: true,
              onClick: "press_store_button(this)",
              formClass: "d-inline",
            }
          )
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

/**
 * @param {object} req
 * @returns {ul}
 */
const storeNavPills = (req) => {
  const link = (txt) =>
    li(
      { class: "nav-item" },
      a(
        {
          href: `/plugins?set=${txt.toLowerCase()}${
            req.query.q ? `&q=${req.query.q}` : ""
          }`,
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
    link("Modules"),
    link("Packs"),
    link("Themes"),
    link("Installed")
  );
};

/**
 * @param {object[]} items
 * @param {object} query
 * @returns {object[]}
 */
const filter_items = (items, query) => {
  const in_set = filter_items_set(items, query);
  if (!query.q) return in_set;
  return in_set.filter((p) => satisfy_q(p, query.q.toLowerCase()));
};

/**
 * @param {string} s
 * @param {string} q
 * @returns {boolean}
 */
const match_string = (s, q) => {
  if (!s || !q) return false;
  return s.toLowerCase().includes(q);
};

/**
 * @param {string} p
 * @param {string} q
 * @returns {boolean}
 */
const satisfy_q = (p, q) => {
  return match_string(p.name, q) || match_string(p.description, q);
};

/**
 * @param {object[]} items
 * @param {object} query
 * @returns {object[]}
 */
const filter_items_set = (items, query) => {
  switch (query.set) {
    case "modules":
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

/**
 * @param {object} req
 * @returns {div}
 */
const store_actions_dropdown = (req) => {
  const tenants_install_git = getRootState().getConfig(
    "tenants_install_git",
    false
  );
  return div(
    { class: "dropdown" },
    button(
      {
        class: "btn btn-outline-secondary",
        type: "button",
        id: "dropdownMenuButton",
        "data-bs-toggle": "dropdown",
        "aria-haspopup": "true",
        "aria-expanded": "false",
      },
      '<i class="fas fa-ellipsis-h"></i>'
    ),
    div(
      {
        class: "dropdown-menu dropdown-menu-end",
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
            onClick: `notifyAlert('${req.__("Upgrading modules...")}', true)`,
          },
          '<i class="far fa-arrow-alt-circle-up"></i>&nbsp;' +
            req.__("Upgrade installed modules")
        ),
      db.getTenantSchema() === db.connectObj.default_schema &&
        a(
          {
            class: "dropdown-item",
            href: `/plugins/reinstall-all`,
            onClick: `notifyAlert('${req.__("Upgrading modules...")}', true)`,
          },
          '<i class="fas fa-pump-medical"></i>&nbsp;' +
            req.__("Clean modules and restart")
        ),

      (db.getTenantSchema() === db.connectObj.default_schema ||
        tenants_install_git) &&
        a(
          {
            class: "dropdown-item",
            href: `/plugins/new`,
          },
          '<i class="fas fa-plus"></i>&nbsp;' + req.__("Add another module")
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
};

/**
 * @param {object[]} items
 * @param {object} req
 * @returns {object}
 */
const plugin_store_html = (items, req) => {
  return {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Settings"), href: "/settings" },
          { text: req.__("Module store") },
        ],
      },
      {
        type: "card",
        class: "mt-0",
        contents: div(
          { class: "d-flex justify-content-between" },
          storeNavPills(req),
          div(
            search_bar("q", req.query.q || "", {
              placeHolder: req.__("Search for..."),
              stateField: "q",
            })
          ),
          div(store_actions_dropdown(req))
        ),
      },
      {
        besides: items.map(store_item_html(req)),
        gy: 3,
        widths: items.map(() => 4),
      },
    ],
  };
};

const flash_relogin = (req, exposedConfigs) => {
  req.flash(
    "warning",
    req.__(
      "To see changes for '%s' in show-if-formulas, users need to relogin",
      exposedConfigs.join(", ")
    )
  );
};

/**
 * @name get
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const items = await get_store_items();
    const relevant_items = filter_items(items, req.query);
    res.sendWrap(
      req.__("Module store"),
      plugin_store_html(relevant_items, req)
    );
  })
);

router.get(
  "/versions_dialog/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const withoutOrg = name.replace(/^@saltcorn\//, "");
    let plugin = await Plugin.store_by_name(decodeURIComponent(withoutOrg));
    if (!plugin)
      plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    if (!plugin) {
      getState().log(
        2,
        `GET /versions_dialog${withoutOrg}: '${withoutOrg}' not found`
      );
      return res
        .status(404)
        .json({ error: req.__("Module '%s' not found", withoutOrg) });
    } else {
      try {
        const pkgInfo = await npmFetch.json(
          `https://registry.npmjs.org/${plugin.location}`,
          getFetchProxyOptions()
        );
        if (!pkgInfo?.versions)
          throw new Error(req.__("Unable to fetch versions"));
        res.set("Page-Title", req.__("%s versions", text(withoutOrg)));
        const versions = Object.keys(pkgInfo.versions);
        if (versions.length === 0) throw new Error(req.__("No versions found"));
        const tags = pkgInfo["dist-tags"] || {};
        let selected = null;
        if (getState().plugins[plugin.name]) {
          const mod = await load_plugins.requirePlugin(plugin);
          if (mod) selected = mod.version;
        }
        if (!selected) selected = versions[versions.length - 1];
        const scVersion = getState().scVersion;
        return res.send(
          form(
            {
              action: `/plugins/install/${encodeURIComponent(name)}`,
              method: "post",
            },
            input({ type: "hidden", name: "_csrf", value: req.csrfToken() }),
            div(
              { class: "form-group" },
              // version
              label(
                {
                  for: "version_select",
                  class: "form-label fw-bold",
                },
                req.__("Version")
              ),
              select(
                {
                  id: "version_select",
                  class: "form-control form-select",
                  name: "version",
                },
                versions
                  .filter((v) =>
                    isVersionSupported(v, pkgInfo.versions, scVersion)
                  )
                  .map((version) =>
                    option({
                      id: `${version}_opt`,
                      value: version,
                      label: version,
                      selected: version === selected,
                    })
                  )
              ),
              // tag
              label(
                {
                  for: "tag_select",
                  class: "form-label fw-bold mt-2",
                },
                req.__("Tags")
              ),
              select(
                {
                  id: "tag_select",
                  class: "form-control form-select",
                },
                option({
                  id: "empty_opt",
                  value: "",
                  label: req.__("Select tag"),
                  selected: true,
                }),
                Object.keys(tags)
                  .filter((tag) =>
                    isVersionSupported(tags[tag], pkgInfo.versions, scVersion)
                  )
                  .map((tag) =>
                    option({
                      id: `${tag}_opt`,
                      value: tags[tag],
                      label: `${tag} (${tags[tag]})`,
                    })
                  )
              )
            ),
            div(
              { class: "d-flex justify-content-end" },
              button(
                {
                  type: "button",
                  class: "btn btn-secondary me-2",
                  "data-bs-dismiss": "modal",
                },
                req.__("Close")
              ),
              button(
                {
                  type: "submit",
                  class: "btn btn-primary",
                  onClick: "press_store_button(this)",
                },
                req.__("Install")
              )
            )
          ) +
            script(
              domReady(`
document.getElementById('tag_select').onchange = () => {
  const version = document.getElementById('tag_select').value;
  if (version) document.getElementById('version_select').value = version;
};
document.getElementById('version_select').onchange = () => {
  const tagSelect = document.getElementById('tag_select');
  tagSelect.value = '';
}; 
`)
            )
        );
      } catch (error) {
        getState().log(
          2,
          `GET /versions_dialog${withoutOrg}: ${
            error.message || "unknown error"
          }`
        );
        return res
          .status(500)
          .json({ error: error.message || "unknown error" });
      }
    }
  })
);

/**
 * @name get/configure/:name
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/configure/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    if (!plugin) {
      req.flash("warning", req.__("Module not found"));
      res.redirect("/plugins");
      return;
    }
    let module = getState().plugins[plugin.name];
    if (!module) {
      module = getState().plugins[getState().plugin_module_names[plugin.name]];
    }
    const flow = module.configuration_workflow();
    flow.action = `/plugins/configure/${encodeURIComponent(plugin.name)}`;
    flow.autoSave = true;
    flow.saveURL = `/plugins/saveconfig/${encodeURIComponent(plugin.name)}`;
    const wfres = await flow.run(plugin.configuration || {});
    if (module.layout) {
      wfres.renderForm.additionalButtons = [
        ...(wfres.renderForm.additionalButtons || []),
        {
          label: "Reload page to see changes",
          id: "btnReloadNow",
          class: "btn btn-outline-secondary",
          onclick: `if (window.savingViewConfig) 
  notifyAlert({
    type: 'danger',
    text: 'Still saving, please wait',
  });
else location.reload();`,
        },
      ];
      wfres.renderForm.onChange = `${
        wfres.renderForm.onChange || ""
      };$('#btnReloadNow').removeClass('btn-outline-secondary').addClass('btn-secondary')`;
    }

    res.sendWrap(
      {
        title: req.__(`Configure %s Plugin`, plugin.name),
        headers: wfres.renderForm?.additionalHeaders || [],
      },
      {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Settings"), href: "/settings" },
              { text: req.__("Module store"), href: "/plugins" },
              { text: plugin.name },
            ],
          },
          {
            type: "card",
            class: "mt-0",
            title: req.__(`Configure %s Plugin`, plugin.name),
            titleAjaxIndicator: true,
            contents: renderForm(wfres.renderForm, req.csrfToken()),
          },
        ],
      }
    );
  })
);

/**
 * @name post/configure/:name
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.post(
  "/configure/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    let module = getState().plugins[plugin.name];
    if (!module) {
      module = getState().plugins[getState().plugin_module_names[plugin.name]];
    }
    const flow = module.configuration_workflow();
    flow.action = `/plugins/configure/${encodeURIComponent(plugin.name)}`;
    flow.autoSave = true;
    flow.saveURL = `/plugins/saveconfig/${encodeURIComponent(plugin.name)}`;
    const wfres = await flow.run(req.body || {});
    if (wfres.renderForm) {
      if (module.layout) {
        wfres.renderForm.additionalButtons = [
          ...(wfres.renderForm.additionalButtons || []),
          {
            label: "Reload page to see changes",
            id: "btnReloadNow",
            class: "btn btn-outline-secondary",
            onclick: "location.reload()",
          },
        ];
        wfres.renderForm.onChange = `${
          wfres.renderForm.onChange || ""
        };$('#btnReloadNow').removeClass('btn-outline-secondary').addClass('btn-secondary')`;
      }
      res.sendWrap(req.__(`Configure %s Plugin`, plugin.name), {
        type: "card",
        class: "mt-0",
        title: req.__(`Configure %s Plugin`, plugin.name),
        contents: renderForm(wfres.renderForm, req.csrfToken()),
      });
    } else {
      const newCfg = wfres.cleanup ? wfres.context : wfres;
      plugin.configuration = newCfg;
      await plugin.upsert();
      await load_plugins.loadPlugin(plugin);
      const instore = await Plugin.store_plugins_available();
      const store_plugin = instore.find((p) => p.name === plugin.name);
      if (store_plugin && store_plugin.has_auth) flash_restart(req);
      if (module.exposed_configs?.length > 0)
        flash_relogin(req, module.exposed_configs);
      getState().processSend({
        refresh_plugin_cfg: plugin.name,
        tenant: db.getTenantSchema(),
      });
      if (module.layout) await sleep(500); // Allow other workers to reload this plugin
      if (wfres.cleanup) await wfres.cleanup();
      res.redirect("/plugins");
    }
  })
);

router.post(
  "/saveconfig/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    let module = getState().plugins[plugin.name];
    if (!module) {
      module = getState().plugins[getState().plugin_module_names[plugin.name]];
    }
    const flow = module.configuration_workflow();
    const step = await flow.singleStepForm(req.body || {}, req);
    if (step?.renderForm) {
      if (step.renderForm.hasErrors || step.savingErrors)
        res.status(400).send(step.savingErrors || "Error");
      else {
        plugin.configuration = {
          ...plugin.configuration,
          ...step.renderForm.values,
        };
        await plugin.upsert();
        await load_plugins.loadPlugin(plugin);

        getState().processSend({
          refresh_plugin_cfg: plugin.name,
          tenant: db.getTenantSchema(),
        });
        res.json({ success: "ok" });
      }
    }
  })
);

router.get(
  "/user_configure/:name",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user?.id });
    if (!user) {
      req.flash("error", req.__("Not authorized"));
      return res.redirect("/");
    }
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    if (!plugin) {
      req.flash("warning", req.__("Module not found"));
      return res.redirect("/auth/settings");
    }
    let module = getState().plugins[plugin.name];
    if (!module) {
      module = getState().plugins[getState().plugin_module_names[plugin.name]];
    }
    const userLayout =
      user._attributes?.layout?.plugin === plugin.name
        ? user._attributes.layout.config || {}
        : {};
    const form = await module.user_config_form({
      ...(plugin.configuration || {}),
      ...userLayout,
    });
    form.action = `/plugins/user_configure/${encodeURIComponent(plugin.name)}`;
    form.onChange = `applyViewConfig(this, '/plugins/user_saveconfig/${encodeURIComponent(
      name
    )}', null, event);$('#btnReloadNow').removeClass('btn-outline-secondary').addClass('btn-secondary')`;

    form.additionalButtons = [
      {
        label: "Reload page to see changes",
        id: "btnReloadNow",
        class: "btn btn-outline-secondary",
        onclick: "location.reload();",
      },
    ];
    form.submitLabel = req.__("Finish") + " &raquo;";
    res.sendWrap(
      {
        title: req.__(`Configure %s Plugin for %s`, plugin.name, user.email),
        headers: form.additionalHeaders || [],
      },
      {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Settings"), href: "/settings" },
              { text: req.__("Module store"), href: "/plugins" },
              { text: plugin.name },
            ],
          },
          {
            type: "card",
            class: "mt-0",
            title: req.__(`Configure %s Plugin`, plugin.name),
            titleAjaxIndicator: true,
            contents: renderForm(form, req.csrfToken()),
          },
        ],
      }
    );
  })
);

router.post(
  "/user_configure/:name",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user?.id });
    if (!user) {
      req.flash("error", req.__("Not authorized"));
      return res.redirect("/");
    }
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    let module = getState().plugins[plugin.name];
    if (!module) {
      module = getState().plugins[getState().plugin_module_names[plugin.name]];
    }
    const form = await module.user_config_form({
      ...(plugin.configuration || {}),
      ...(user._attributes?.layout?.config || {}),
    });
    const valResult = form.validate(req.body || {});
    if (form.hasErrors) {
      req.flash("warning", req.__("An error occurred"));
      return res.sendWrap(
        req.__(`Configure %s Plugin for %s`, plugin.name, user.email),
        renderForm(form, req.csrfToken())
      );
    }
    const values = valResult.success;
    values.is_user_config = true;
    const userAttrs = user._attributes ? { ...user._attributes } : {};
    userAttrs.layout = {
      plugin: plugin.name,
      config: values,
    };
    await user.update({ _attributes: userAttrs });
    getState().userLayouts[req.user.email] = module.layout({
      ...(plugin.configuration ? plugin.configuration : {}),
      ...values,
    });
    const sessionUser = req.session?.passport?.user;
    if (sessionUser) {
      const pluginName = module.plugin_name;
      if (sessionUser.attributes) {
        const oldAttrs = sessionUser.attributes[pluginName] || {};
        sessionUser.attributes[pluginName] = { ...oldAttrs, ...values };
      } else sessionUser.attributes = { [pluginName]: values };
    }
    getState().processSend({
      refresh_plugin_cfg: plugin.name,
      tenant: db.getTenantSchema(),
    });
    if (module.layout) await sleep(500); // Allow other workers to reload this plugin
    res.redirect("/auth/settings");
  })
);

router.post(
  "/user_saveconfig/:name",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user?.id });
    if (!user) return res.status(401).json({ error: req.__("Not authorized") });
    const { name } = req.params;
    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    let module = getState().plugins[plugin.name];
    if (!module) {
      module = getState().plugins[getState().plugin_module_names[plugin.name]];
    }
    const form = await module.user_config_form({
      ...(plugin.configuration || {}),
      ...(user._attributes?.layout?.config || {}),
    });
    const valResult = form.validate(req.body || {});
    if (form.hasErrors) {
      return res.status(400).json({ error: req.__("An error occured") });
    }
    const values = valResult.success;
    values.is_user_config = true;
    const userAttrs = user._attributes ? { ...user._attributes } : {};
    userAttrs.layout = {
      plugin: plugin.name,
      config: values,
    };
    await user.update({ _attributes: userAttrs });
    getState().userLayouts[req.user.email] = module.layout(
      userAttrs.layout.config
    );
    const sessionUser = req.session?.passport?.user;
    if (sessionUser) {
      const pluginName = module.plugin_name;
      if (sessionUser.attributes) {
        const oldAttrs = sessionUser.attributes[pluginName] || {};
        sessionUser.attributes[pluginName] = { ...oldAttrs, ...values };
      } else sessionUser.attributes = { [pluginName]: values };
    }
    getState().processSend({
      refresh_plugin_cfg: plugin.name,
      tenant: db.getTenantSchema(),
    });
    res.json({ success: "ok" });
  })
);

router.post(
  "/remove_user_layout",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(401).json({ error: req.__("Not authorized") });
    } else if (user._attributes?.layout) {
      const userAttrs = { ...user._attributes };
      const plugin = userAttrs.layout.plugin;
      delete userAttrs.layout;
      await user.update({ _attributes: userAttrs });
      getState().userLayouts[req.user.email] = null;
      let module = getState().plugins[plugin];
      if (!module) {
        module = getState().plugins[getState().plugin_module_names[plugin]];
      }
      const pluginName = module.plugin_name;
      const sessionUser = req.session?.passport?.user;
      if (sessionUser?.attributes[pluginName])
        sessionUser.attributes[pluginName] = {};
      getState().processSend({
        refresh_plugin_cfg: plugin,
        tenant: db.getTenantSchema(),
      });
    }
    res.json({ success: "ok", reload_page: true });
  })
);

/**
 * @name get/new
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/new",
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__(`New Plugin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings"), href: "/settings" },
            { text: req.__("Module store"), href: "/plugins" },
            { text: req.__("New") },
          ],
        },
        {
          type: "card",
          title: req.__(`Add module`),
          contents: renderForm(pluginForm(req), req.csrfToken()),
        },
      ],
    });
  })
);

/**
 * @name get/public/:plugin/*
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/public/:plugin/*filepath",
  error_catcher(async (req, res) => {
    const { plugin } = req.params;
    const filepath = path.join(...req.params.filepath);
    const hasVersion = plugin.includes("@");
    const location =
      getState().plugin_locations[hasVersion ? plugin.split("@")[0] : plugin];
    if (location) {
      const safeFile = path
        .normalize(filepath)
        .replace(/^(\.\.(\/|\\|$))+/, "");
      const fullpath = path.join(location, "public", safeFile);
      if (fs.existsSync(fullpath))
        res.sendFile(fullpath, {
          maxAge: hasVersion ? "100d" : "1d",
          dotfiles: "allow",
        });
      else {
        getState().log(6, `Plugin serve public: file not found ${fullpath}`);
        res.status(404).send(req.__("Not found"));
      }
    } else {
      getState().log(
        6,
        `Plugin serve public: No location for plugin: ${plugin}`
      );
      res.status(404).send(req.__("Not found"));
    }
  })
);

/**
 * @name get/info/:name
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/info/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    let plugin_db = await Plugin.findOne({ name });
    if (!plugin_db) {
      req.flash("warning", req.__("Module not found"));
      res.redirect("/plugins");
      return;
    }
    const mod = await load_plugins.requirePlugin(plugin_db);
    const store_items = await get_store_items();
    const store_item = store_items.find((item) => item.name === name);
    const update_permitted =
      db.getTenantSchema() === db.connectObj.default_schema &&
      plugin_db.source === "npm";

    let latest =
      update_permitted &&
      (await get_latest_npm_version(plugin_db.location, 1000));
    let engineInfos = await load_plugins.getEngineInfos(plugin_db); // with cache
    let forceFetch = true;
    if (latest && !engineInfos[latest]) {
      engineInfos = await load_plugins.getEngineInfos(plugin_db, forceFetch);
      forceFetch = false;
    }
    if (latest && !isVersionSupported(latest, engineInfos)) {
      latest = supportedVersion(
        latest,
        await load_plugins.getEngineInfos(plugin_db, forceFetch)
      );
    }
    const can_update = update_permitted && latest && mod.version !== latest;
    const can_select_version = update_permitted && plugin_db.source === "npm";
    let pkgjson;
    if (mod.location && fs.existsSync(path.join(mod.location, "package.json")))
      pkgjson = require(path.join(mod.location, "package.json"));
    const domId = `${removeNonWordChars(mod.name)}_store_version_btn`;
    const infoTable = table(
      tbody(
        tr(th(req.__("Package name")), td(mod.name)),
        tr(
          th(req.__("Package version")),
          td(
            span(
              { style: "display: inline-block; min-width: 2.9rem;" },
              mod.version
            ),
            can_select_version
              ? a(
                  {
                    id: domId,
                    class: "store-install btn btn-sm btn-primary ms-2",
                    onClick: "press_store_button(this, true)",
                    href: `javascript:ajax_modal('/plugins/versions_dialog/${encodeURIComponent(
                      encodeURIComponent(plugin_db.name)
                    )}', { onOpen: () => { restore_old_button('${domId}'); }, onError: (res) => { selectVersionError(res, '${domId}') } });`,
                  },
                  req.__("install a different version")
                )
              : ""
          )
        ),
        tr(
          th(req.__("Latest version")),
          td(
            span(
              { style: "display: inline-block; min-width: 2.9rem;" },
              latest || ""
            ),
            can_update
              ? a(
                  {
                    href: `/plugins/upgrade-plugin/${encodeURIComponent(
                      plugin_db.name
                    )}`,
                    class: "btn btn-primary btn-sm ms-2",
                  },
                  req.__("Upgrade")
                )
              : ""
          )
        ),
        mod.plugin_module.dependencies
          ? tr(
              th(req.__("Module dependencies")),
              td(
                mod.plugin_module.dependencies.map((d) =>
                  span({ class: "badge bg-primary me-1" }, d)
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
            { text: req.__("Module store"), href: "/plugins" },
            { text: plugin_db.name },
          ],
        },
        {
          type: "card",
          title: req.__(`%s module information`, plugin_db.name),
          contents: p(store_item.description) + infoTable,
        },
        ...cards,
      ],
    });
  })
);

/**
 * @name get/refresh
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/refresh",
  isAdmin,
  error_catcher(async (req, res) => {
    await getState().deleteConfig(
      "available_plugins",
      "available_plugins_fetched_at",
      "available_packs",
      "available_packs_fetched_at",
      "latest_npm_version"
    );
    req.flash("success", req.__(`Store refreshed`));

    res.redirect(`/plugins`);
  })
);

/**
 * @name get/upgrade
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/upgrade",
  isAdmin,
  error_catcher(async (req, res) => {
    const schema = db.getTenantSchema();
    if (schema === db.connectObj.default_schema) {
      await upgrade_all_tenants_plugins((p, f, forceFetch) =>
        load_plugins.loadPlugin(p, f, forceFetch)
      );
      req.flash(
        "success",
        req.__(`Modules up-to-date. Please restart server`) +
          ". " +
          a({ href: "/admin/system" }, req.__("Restart here"))
      );
    } else {
      const installed_plugins = await Plugin.find({});
      for (const plugin of installed_plugins) {
        await plugin.upgrade_version((p, f, forceFetch) =>
          load_plugins.loadPlugin(p, f, forceFetch)
        );
      }
      req.flash("success", req.__(`Modules up-to-date`));
      await restart_tenant(loadAllPlugins);
      getState().processSend({
        restart_tenant: true,
        tenant: db.getTenantSchema(),
      });
    }
    res.redirect(`/plugins`);
  })
);

/**
 * @name get/upgrade
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/reinstall-all",
  isAdmin,
  error_catcher(async (req, res) => {
    //TODO make this post
    const schema = db.getTenantSchema();
    if (schema === db.connectObj.default_schema) {
      await PluginInstaller.cleanPluginsDirectory();
      req.flash("success", req.__(`Modules cleaned, server restarting...`));
      setTimeout(() => {
        if (process.send) getState().processSend("RestartServer");
        else process.exit(0);
      }, 1000);
    }
    res.redirect(`/plugins`);
  })
);

/**
 * @name get/upgrade-plugin/:name
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.get(
  "/upgrade-plugin/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const plugin = await Plugin.findOne({ name });
    const versions = await load_plugins.getEngineInfos(plugin, true);

    await plugin.upgrade_version(
      (p, f) => load_plugins.loadPlugin(p, f),
      supportedVersion("latest", versions, require("../package.json").version)
    );
    req.flash("success", req.__(`Module up-to-date`));

    res.redirect(`/plugins/info/${encodeURIComponent(plugin.name)}`);
  })
);

/**
 * @name post
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.post(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const plugin = new Plugin(req.body || {});
    const schema = db.getTenantSchema();
    const tenants_install_git = getRootState().getConfig(
      "tenants_install_git",
      false
    );
    if (schema !== db.connectObj.default_schema && !tenants_install_git) {
      req.flash(
        "error",
        req.__(`Only store modules can be installed on tenant instances`)
      );
      res.redirect(`/plugins`);
    } else {
      try {
        const msgs = await load_plugins.loadAndSaveNewPlugin(
          plugin,
          schema === db.connectObj.default_schema || plugin.source === "github"
        );
        req.flash("success", req.__(`Module %s installed`, plugin.name));
        for (const msg of msgs) req.flash("warning", msg);
        res.redirect(`/plugins`);
      } catch (e) {
        console.error(e);
        req.flash("error", `${e.message}`);
        const form = pluginForm(req, plugin);
        res.sendWrap(req.__(`Edit Module`), renderForm(form, req.csrfToken()));
      }
    }
  })
);

/**
 * @name post/delete/:name
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.post(
  "/delete/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const plugin = await Plugin.findOne({ name: decodeURIComponent(name) });
    if (!plugin) {
      req.flash("warning", req.__("Module not found"));
      res.redirect("/plugins");
      return;
    }
    const depviews = await plugin.dependant_views();
    if (
      depviews.length === 0 ||
      getState().getConfig("development_mode", false)
    ) {
      await plugin.delete();
      await new PluginInstaller(plugin).remove();
      req.flash("success", req.__(`Module %s removed.`, plugin.name));
    } else {
      req.flash(
        "error",
        req.__(`Cannot remove module: views %s depend on it`, depviews.join())
      );
    }
    res.redirect(`/plugins`);
  })
);

/**
 * @name post/install/:name
 * @function
 * @memberof module:routes/plugins~pluginsRouter
 * @function
 */
router.post(
  "/install/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const { version } = req.body || {};
    const tenants_unsafe_plugins = getRootState().getConfig(
      "tenants_unsafe_plugins",
      false
    );
    // when a version is specified, either update the db row or use the plugin from the store
    // when no version is specified, allways use the plugin from the store
    let plugin = null;
    if (version) {
      plugin = await Plugin.findOne({ name: name });
      if (plugin) plugin.version = version;
    }
    if (!plugin) {
      plugin = await Plugin.store_by_name(decodeURIComponent(name));
      if (plugin) {
        delete plugin.id;
        if (version) plugin.version = version;
      }
    }
    if (!plugin) {
      req.flash(
        "error",
        req.__(`Module %s not found`, text(decodeURIComponent(name)))
      );
      res.redirect(`/plugins`);
      return;
    }
    let forceReInstall =
      version !== undefined ||
      (plugin.source === "npm" && plugin.version === "latest");
    if (version) plugin.version = version;

    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    if (!isRoot && plugin.unsafe && !tenants_unsafe_plugins) {
      req.flash(
        "error",
        req.__("Cannot install unsafe modules on subdomain tenants")
      );
      res.redirect(`/plugins`);
      return;
    }

    let msgs = null;
    try {
      msgs = await load_plugins.loadAndSaveNewPlugin(
        plugin,
        forceReInstall,
        undefined,
        req.__
      );
    } catch (e) {
      console.error(e);
      req.flash(
        "error",
        e.message || req.__("Error installing module %s", plugin.name)
      );
      res.redirect(`/plugins`);
      return;
    }
    const plugin_module = getState().plugins[name];
    await sleep(1000); // Allow other workers to load this plugin
    await getState().refresh_views();

    if (plugin_module && plugin_module.configuration_workflow) {
      const plugin_db = await Plugin.findOne({ name });
      req.flash(
        "success",
        req.__(
          `Module %s installed, please complete configuration.`,
          plugin_db.name
        )
      );
      if (msgs?.length > 0) req.flash("warning", msgs.join("<br>"));
      res.redirect(`/plugins/configure/${plugin_db.name}`);
    } else {
      req.flash("success", req.__(`Module %s installed`, plugin.name));
      if (msgs?.length > 0) req.flash("warning", msgs.join("<br>"));
      res.redirect(`/plugins`);
    }
  })
);
