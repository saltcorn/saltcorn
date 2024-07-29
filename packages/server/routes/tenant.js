/**
 * Tenant(s) Route
 * @category server
 * @module routes/tenant
 * @subcategory routes
 */

const Router = require("express-promise-router");
const Form = require("@saltcorn/data/models/form");
const {
  getState,
  add_tenant,
  getRootState,
} = require("@saltcorn/data/db/state");
const {
  create_tenant,
  getAllTenants,
  domain_sanitize,
  deleteTenant,
  switchToTenant,
  insertTenant,
  Tenant,
} = require("@saltcorn/admin-models/models/tenant");
const {
  renderForm,
  link,
  post_delete_btn,
  localeDateTime,
  mkTable,
} = require("@saltcorn/markup");
const {
  div,
  p,
  a,
  h4,
  text,
  i,
  table,
  tr,
  th,
  td,
  code,
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");

const { loadAllPlugins, loadAndSaveNewPlugin } = require("../load_plugins");
const { isAdmin, error_catcher, is_ip_address } = require("./utils.js");
const User = require("@saltcorn/data/models/user");
const File = require("@saltcorn/data/models/file");
const {
  send_infoarch_page,
  config_fields_form,
  save_config_from_form,
} = require("../markup/admin.js");
const { getConfig } = require("@saltcorn/data/models/config");
//const {quote} = require("@saltcorn/db-common");
// todo add button backup / restore for particular tenant (available in admin tenants screens)
//const {
//  create_backup,
//  restore,
//} = require("@saltcorn/admin-models/models/backup");

/**
 * @type {object}
 * @const
 * @namespace tenantRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

const remove_leading_chars = (cs, s) =>
  s.startsWith(cs) ? remove_leading_chars(cs, s.substring(cs.length)) : s;

/**
 * Declare Form to create Tenant
 * @param {object} req - Request
 * @param base_url - Base URL
 * @returns {Form} - Saltcorn Form Declaration
 * @category server
 */
// TBD add form field email for tenant admin

const tenant_form = (req, base_url) =>
  new Form({
    action: "/tenant/create",
    submitLabel: req.__("Create"),
    labelCols: 4,
    blurb: req.__(
      "Please select a name for your application. The name will determine the address at which it will be available. "
    ),
    fields: [
      {
        name: "subdomain",
        label: req.__("Application name"),
        input_type: "text",
        postText: text("." + base_url),
        attributes: { autofocus: true },
      },
    ],
  });

/**
 * Check that user has role that allowed to create tenants
 * By default Admin role (id is 10) has rights to create tenants.
 * You can specify config variable "role_to_create_tenant" to overwrite this.
 * Note that only one role currently can have such rights simultaneously.
 * @param {object} req - Request
 * @returns {boolean} true if role has righs to create tenant
 */
// TBD To allow few roles to create tenants - currently only one role has such rights simultaneously
const create_tenant_allowed = (req) => {
  const required_role =
    +getRootState().getConfig("role_to_create_tenant") || 100;
  const user_role = req.user ? req.user.role_id : 100;
  return user_role <= required_role;
};

const get_cfg_tenant_base_url = (req) =>
  remove_leading_chars(
    ".",
    getRootState().getConfig("tenant_baseurl", req.hostname) || req.hostname
  )
    .replace("http://", "")
    .replace("https://", "");
/**
 * Create tenant screen runnning
 * @name get/create
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.get(
  "/create",
  error_catcher(async (req, res) => {
    if (!db.is_it_multi_tenant()) {
      res.sendWrap(
        req.__("Create application"),
        req.__("Multi-tenancy not enabled")
      );
      return;
    }
    if (!create_tenant_allowed(req)) {
      const redir = getState().getConfig("tenant_create_unauth_redirect");
      const redirRoot = getRootState().getConfig(
        "tenant_create_unauth_redirect"
      );
      if (redir) res.redirect(redir);
      else if (redirRoot) res.redirect(redirRoot);
      else res.sendWrap(req.__("Create application"), req.__("Not allowed"));
      return;
    }

    if (is_ip_address(req.hostname))
      req.flash(
        "danger",
        req.__(
          "You are trying to create a tenant while connecting via an IP address rather than a domain. This will probably not work."
        )
      );
    let create_tenant_warning_text = "";
    const base_url = get_cfg_tenant_base_url(req);
    if (getState().getConfig("create_tenant_warning")) {
      create_tenant_warning_text = getState().getConfig(
        "create_tenant_warning_text"
      );
      if (create_tenant_warning_text && create_tenant_warning_text.length > 0)
        create_tenant_warning_text = div(
          {
            class: "alert alert-warning alert-dismissible fade show mt-5",
            role: "alert",
          },
          h4(req.__("Warning")),
          p(create_tenant_warning_text)
        );
      else
        create_tenant_warning_text = div(
          {
            class: "alert alert-warning alert-dismissible fade show mt-5",
            role: "alert",
          },
          h4(req.__("Warning")),
          p(
            req.__(
              "Hosting on this site is provided for free and with no guarantee of availability or security of your application. "
            ) +
              " " +
              req.__(
                "This facility is intended solely for you to evaluate the suitability of Saltcorn. "
              ) +
              " " +
              req.__(
                "If you would like to store private information that needs to be secure, please use self-hosted Saltcorn. "
              ) +
              " " +
              req.__(
                'See <a href="https://github.com/saltcorn/saltcorn">GitHub repository</a> for instructions<p>'
              )
          )
        );
    }

    res.sendWrap(
      req.__("Create application"),
      create_tenant_warning_text +
        renderForm(tenant_form(req, base_url), req.csrfToken()) +
        p(
          { class: "mt-2" },
          req.__("To login to a previously created application, go to: "),
          code(`${req.protocol}://`) +
            i(req.__("Application name")) +
            code("." + base_url)
        )
    );
  })
);
/**
 * Return URL of new Tenant
 * @param {object} req - Request
 * @param {string} subdomain - Tenant Subdomain name string
 * @param base_url - Base URL
 * @returns {string}
 */
const getNewURL = (req, subdomain, base_url) => {
  var ports = "";
  const host = req.get("host");
  if (typeof host === "string") {
    const hosts = host.split(":");
    if (hosts.length > 1) ports = `:${hosts[1]}`;
  }
  const hostname = base_url || req.hostname;
  // return newurl
  return `${req.protocol}://${subdomain}.${hostname}${ports}/`;
};

/**
 * Create Tenant UI Main logic
 * @name post/create
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.post(
  "/create",
  error_catcher(async (req, res) => {
    // check that multi-tenancy is enabled
    if (!db.is_it_multi_tenant()) {
      res.sendWrap(
        req.__("Create application"),
        req.__("Multi-tenancy not enabled")
      );
      return;
    }
    // check that user has rights
    if (!create_tenant_allowed(req)) {
      res.sendWrap(req.__("Create application"), req.__("Not allowed"));
      return;
    }
    // declare  ui form
    const base_url = get_cfg_tenant_base_url(req);
    const form = tenant_form(req, base_url);
    // validate ui form
    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(
        req.__("Create application"),
        // render ui form if validation finished with error
        renderForm(form, req.csrfToken())
      );
    else {
      // normalize domain name
      const subdomain = domain_sanitize(valres.success.subdomain);
      // get description
      const description = valres.success.description;
      // get list of tenants
      const allTens = await getAllTenants();
      if (allTens.includes(subdomain) || !subdomain || subdomain === "public") {
        form.errors.subdomain = req.__(
          "A site with this subdomain already exists"
        );
        form.hasErrors = true;
        res.sendWrap(
          req.__("Create application"),
          renderForm(form, req.csrfToken())
        );
      } else {
        // tenant url
        const base_url = get_cfg_tenant_base_url(req);
        const newurl = getNewURL(req, subdomain, base_url);
        // tenant template
        const tenant_template = getState().getConfig("tenant_template");
        // tenant creator
        const user_email = req.user && req.user.email;
        const tenrow = await insertTenant(
          subdomain,
          user_email,
          description,
          tenant_template
        );
        // add tenant to global state
        add_tenant(subdomain);

        await switchToTenant(tenrow, newurl);

        await create_tenant({
          t: subdomain,
          plugin_loader: loadAllPlugins,
          noSignalOrDB: false,
          loadAndSaveNewPlugin: loadAndSaveNewPlugin,
          tenant_template,
        });
        let new_url_create = newurl;
        const hasTemplate = getState().getConfig("tenant_template");
        if (hasTemplate) {
          new_url_create += "auth/create_first_user";
        }

        res.sendWrap(
          req.__("Create application"),
          div(
            div(req.__("Success! Your new application is available at:")),

            div(
              { class: "my-3", style: "font-size: 22px" },
              a(
                { href: new_url_create, class: "new-tenant-link" },
                new_url_create
              )
            ),
            p(
              req.__(
                "Please click the above link now to create the first user."
              ) +
                " " +
                hasTemplate
                ? req.__(
                    'Use this link: <a href="%s">%s</a> to revisit your application at any time.',
                    newurl,
                    newurl
                  )
                : req.__(
                    "Use this link to revisit your application at any time."
                  )
            )
          )
        );
      }
    }
  })
);

/**
 * List tenants ( on /tenant/list)
 * @name get/list
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.get(
  "/list",
  isAdmin,
  error_catcher(async (req, res) => {
    if (
      !db.is_it_multi_tenant() ||
      db.getTenantSchema() !== db.connectObj.default_schema
    ) {
      res.sendWrap(
        req.__("Create application"),
        req.__("Multi-tenancy not enabled")
      );
      return;
    }
    const tens = await db.select("_sc_tenants");
    send_infoarch_page({
      res,
      req,
      active_sub: "Tenants",
      contents: {
        type: "card",
        title: req.__("Tenants"),
        contents: [
          mkTable(
            [
              {
                label: req.__("Subdomain"),
                key: (r) =>
                  link(getNewURL(req, r.subdomain), text(r.subdomain)),
              },
              {
                label: req.__("Description"),
                key: (r) => text(r.description),
                //blurb: req.__("Specify some description for tenant if need"),
              },
              {
                label: req.__("Creator email"),
                key: (r) => text(r.email),
              },
              {
                label: req.__("Created"),
                key: (r) => (r.created ? localeDateTime(r.created) : ""),
              },
              {
                label: req.__("Information"),
                key: (r) =>
                  a(
                    { href: `/tenant/info/${text(r.subdomain)}` },
                    i({ class: "fas fa-lg fa-info-circle" })
                  ),
              },
              {
                label: req.__("Delete"),
                key: (r) =>
                  post_delete_btn(
                    `/tenant/delete/${r.subdomain}`,
                    req,
                    r.subdomain
                  ),
              },
            ],
            tens
          ),
          div(req.__(`Found %s tenants`, tens.length)),
          div(link("/tenant/create", req.__("Create new tenant"))),
        ],
      },
    });
  })
);

/**
 * @param {object} req
 * @returns {Form}
 */
const tenant_settings_form = (req) =>
  config_fields_form({
    req,
    field_names: [
      "role_to_create_tenant",
      "create_tenant_warning",
      "create_tenant_warning_text",
      "tenant_template",
      "tenant_baseurl",
      "tenant_create_unauth_redirect",
      { section_header: req.__("Tenant application capabilities") },
      "tenants_install_git",
      "tenants_set_npm_modules",
      "tenants_unsafe_plugins",
    ],
    action: "/tenant/settings",
    submitLabel: req.__("Save"),
  });

/**
 * @name get/settings
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.get(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    if (
      !db.is_it_multi_tenant() ||
      db.getTenantSchema() !== db.connectObj.default_schema
    ) {
      res.sendWrap(
        req.__("Create application"),
        req.__("Multi-tenancy not enabled")
      );
      return;
    }
    const form = await tenant_settings_form(req);

    send_infoarch_page({
      res,
      req,
      active_sub: "Multitenancy",
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__("Multitenancy settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * @name post/settings
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.post(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await tenant_settings_form(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_infoarch_page({
        res,
        req,
        active_sub: "Multitenancy settings",
        contents: {
          type: "card",
          title: req.__("Multitenancy settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);

      if (!req.xhr) {
        req.flash("success", req.__("Tenant settings updated"));
        res.redirect("/tenant/settings");
      } else res.json({ success: "ok" });
    }
  })
);
/**
 * Get Tenant info
 * @param {string} subdomain
 * @returns {Promise<*>}
 */
// TBD move this function data layer or just separate file(reengineering)
const get_tenant_info = async (subdomain) => {
  const saneDomain = domain_sanitize(subdomain);

  let info = {};

  // get tenant row
  const ten = await Tenant.findOne({ subdomain: saneDomain });
  if (ten) {
    //info.ten = ten;
    info.description = ten.description;
    info.created = ten.created;
    info.template = ten.template;
    info.email = ten.email;
  }

  // get data from tenant schema
  return await db.runWithTenant(saneDomain, async () => {
    // TBD fix the first user issue because not always firt user by id is creator of tenant
    const firstUser = await User.find({}, { orderBy: "id", limit: 1 });
    if (firstUser && firstUser.length > 0) {
      info.first_user_email = firstUser[0].email;
    }
    // todo sort in alphabet order
    // config items count
    info.nconfigs = await db.count("_sc_config");
    // error messages count
    info.nerrors = await db.count("_sc_errors");
    // event log
    info.nevent_log = await db.count("_sc_event_log");
    // users count
    info.nusers = await db.count("users");
    // roles count
    info.nroles = await db.count("_sc_roles");
    // table_constraints count
    info.ntable_constraints = await db.count("_sc_table_constraints");
    // tables count
    info.ntables = await db.count("_sc_tables");
    // table fields count
    info.nfields = await db.count("_sc_fields");
    // views count
    info.nviews = await db.count("_sc_views");
    // files count
    info.nfiles = await db.count("_sc_files");
    // pages count
    info.npages = await db.count("_sc_pages");
    // triggers (actions) count
    info.nactions = await db.count("_sc_triggers");
    // plugins count
    info.nplugins = await db.count("_sc_plugins");
    // migration count
    info.nmigrations = await db.count("_sc_migrations");
    // library count
    info.nlibrary = await db.count("_sc_library");
    // notifications
    info.nnotifications = await db.count("_sc_notifications");
    // tags
    info.ntags = await db.count("_sc_tags");
    // tag_entries
    info.ntag_entries = await db.count("_sc_tag_entries");
    // snapshots
    info.nsnapshots = await db.count("_sc_snapshots");
    // session - Only for main app?
    //info.nsession = await db.count("_sc_session");

    // base url
    info.base_url = await getConfig("base_url");
    return info;
  });
};

/**
 * Tenant info
 * @name get/info/:subdomain
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.get(
  "/info/:subdomain",
  isAdmin,
  error_catcher(async (req, res) => {
    if (
      !db.is_it_multi_tenant() ||
      db.getTenantSchema() !== db.connectObj.default_schema
    ) {
      res.sendWrap(
        req.__("Create application"),
        req.__("Multi-tenancy not enabled")
      );
      return;
    }
    const { subdomain } = req.params;
    // get tenant info
    const info = await get_tenant_info(subdomain);
    // get list of files
    let files;
    await db.runWithTenant(subdomain, async () => {
      files = await File.find({});
    });
    send_infoarch_page({
      res,
      req,
      active_sub: "Tenants",
      sub2_page: text(subdomain),
      contents: {
        above: [
          {
            type: "card",
            title: req.__(`%s tenant statistics`, text(subdomain)),
            // TBD make more pretty view - in ideal with charts
            contents: [
              table(
                tr(
                  th(req.__("First user E-mail")),
                  td(
                    a(
                      { href: "mailto:" + info.first_user_email },
                      info.first_user_email
                    )
                  ),
                  th(req.__("Template")),
                  td(a({ href: info.base_url }, info.template))
                ),
                tr(
                  th(req.__("Users")),
                  td(a({ href: info.base_url + "useradmin" }, info.nusers)),
                  th(req.__("Roles")),
                  td(a({ href: info.base_url + "roleadmin" }, info.nroles))
                ),
                tr(
                  th(req.__("Tables")),
                  td(a({ href: info.base_url + "table" }, info.ntables)),
                  th(req.__("Table columns")),
                  td(a({ href: info.base_url + "table" }, info.nfields))
                ),
                tr(
                  th(req.__("Table constraints")),
                  td(
                    a(
                      { href: info.base_url + "table" },
                      info.ntable_constraints
                    )
                  ),
                  th(req.__("Library")),
                  td(a({ href: info.base_url + "library/list" }, info.nlibrary))
                ),
                tr(
                  th(req.__("Views")),
                  td(a({ href: info.base_url + "viewedit" }, info.nviews)),
                  th(req.__("Pages")),
                  td(a({ href: info.base_url + "pageedit" }, info.npages))
                ),
                tr(
                  th(req.__("Files")),
                  td(a({ href: info.base_url + "files" }, info.nfiles)),
                  th(req.__("Actions")),
                  td(a({ href: info.base_url + "actions" }, info.nactions))
                ),
                tr(
                  th(req.__("Modules")),
                  td(a({ href: info.base_url + "plugins" }, info.nplugins)),
                  th(req.__("Configuration items")),
                  td(a({ href: info.base_url + "admin" }, info.nconfigs))
                ),
                tr(
                  // Crashlogs only for main site?
                  th(req.__("Crashlogs")),
                  td(a({ href: info.base_url + "crashlog" }, info.nerrors)),
                  //th(req.__("Sessions")),
                  //td(a({ href: info.base_url + "crashlog" }, info.nsessions)),
                  th(req.__("Event logs")),
                  td(a({ href: info.base_url + "eventlog" }, info.nevent_log))
                  // Notifications only for main site?
                  //th(req.__("Notifications")),
                  //td(a({ href: info.base_url + "???" }, info.nnotifications)),
                ),
                tr(
                  th(req.__("Snapshots")),
                  td(
                    a({ href: info.base_url + "admin/backup" }, info.nsnapshots)
                  ),
                  th(req.__("Migrations")),
                  td(a({ href: info.base_url + "admin" }, info.nmigrations))
                ),
                tr(
                  th(req.__("Tags")),
                  td(a({ href: info.base_url + "tag" }, info.ntags)),
                  th(req.__("Tag Entries")),
                  td(a({ href: info.base_url + "tag" }, info.ntag_entries))
                )
              ),
            ],
          },
          {
            type: "card",
            title: req.__("Settings"),
            contents: [
              renderForm(
                new Form({
                  action: "/tenant/info/" + text(subdomain),
                  submitLabel: req.__("Save"),
                  submitButtonClass: "btn-outline-primary",
                  onChange: "remove_outline(this)",
                  fields: [
                    {
                      name: "base_url",
                      label: req.__("Base URL"),
                      type: "String",
                    },
                    {
                      name: "description",
                      label: req.__("Description"),
                      type: "String",
                      fieldview: "textarea",
                    },
                  ],
                  values: {
                    base_url: info.base_url,
                    description: info.description,
                  },
                }),
                req.csrfToken()
              ),
            ],
          },
          {
            type: "card",
            title: req.__("Files"),
            contents: mkTable(
              [
                {
                  label: req.__("Name"),
                  key: (r) =>
                    link(
                      `${getNewURL(req, text(subdomain))}files/serve/${r.id}`,
                      r.filename
                    ),
                },
                { label: req.__("Size (KiB)"), key: "size_kb", align: "right" },
                { label: req.__("Media type"), key: (r) => r.mimetype },
              ],
              files
            ),
          },
        ],
      },
    });
  })
);

/**
 * Show Information about Tenant
 * /tenant/info
 * @name post/info/:subdomain
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.post(
  "/info/:subdomain",
  isAdmin,
  error_catcher(async (req, res) => {
    if (
      !db.is_it_multi_tenant() ||
      db.getTenantSchema() !== db.connectObj.default_schema
    ) {
      res.sendWrap(
        req.__("Create application"),
        req.__("Multi-tenancy not enabled")
      );
      return;
    }
    const { subdomain } = req.params;
    const { base_url } = req.body;
    const saneDomain = domain_sanitize(subdomain);

    // save description
    const { description } = req.body;
    await Tenant.update(saneDomain, { description: description });

    await db.runWithTenant(saneDomain, async () => {
      await getState().setConfig("base_url", base_url);
    });
    res.redirect(`/tenant/info/${text(subdomain)}`);
  })
);

/**
 * Execute Delete of tenant
 * @name post/delete/:sub
 * @function
 * @memberof module:routes/tenant~tenantRouter
 */
router.post(
  "/delete/:sub",
  isAdmin,
  error_catcher(async (req, res) => {
    if (
      !db.is_it_multi_tenant() ||
      db.getTenantSchema() !== db.connectObj.default_schema
    ) {
      res.sendWrap(
        req.__("Create application"),
        req.__("Multi-tenancy not enabled")
      );
      return;
    }
    const { sub } = req.params;
    // todo warning before deletion
    await deleteTenant(sub);
    res.redirect(`/tenant/list`);
  })
);
