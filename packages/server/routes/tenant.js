const Router = require("express-promise-router");
const Form = require("@saltcorn/data/models/form");
const { getState, create_tenant } = require("@saltcorn/data/db/state");
const {
  getAllTenants,
  domain_sanitize,
  deleteTenant,
} = require("@saltcorn/data/models/tenant");
const {
  renderForm,
  link,
  post_delete_btn,
  mkTable,
} = require("@saltcorn/markup");
const {
  div,
  nbsp,
  p,
  a,
  h4,
  text,
  i,
  table,
  tr,
  th,
  td,
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const url = require("url");
const { loadAllPlugins } = require("../load_plugins");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const User = require("@saltcorn/data/models/user");
const File = require("@saltcorn/data/models/file");
const {
  send_infoarch_page,
  send_admin_page,
  config_fields_form,
  save_config_from_form,
} = require("../markup/admin.js");
const { getConfig } = require("@saltcorn/data/models/config");

const router = new Router();
module.exports = router;
/**
 * Declare Form to create Tenant
 * @param req - Request
 * @returns {Form} - Saltcorn Form Declaration
 */
// TBD add form field email for tenant admin
const tenant_form = (req) =>
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
        postText: text(req.hostname),
      },
    ],
  });
/**
 * Check that user has role that allowed to create tenants
 * By default Admin role (id is 10) has rights to create tenants.
 * You can specify config variable "role_to_create_tenant" to overwrite this.
 * Note that only one role currently can have such rights simultaneously.
 * @param req - Request
 * @returns {boolean} true if role has righs to create tenant
 */
// TBD To allow few roles to create tenants - currently only one role has such rights simultaneously
const create_tenant_allowed = (req) => {
  const required_role = +getState().getConfig("role_to_create_tenant") || 10;
  const user_role = req.user ? req.user.role_id : 10;
  return user_role <= required_role;
};
/**
 * Check that String is IPv4 address
 * @param hostname
 * @returns {boolean|this is string[]}
 */
// TBD not sure that false is correct return if type of is not string
// TBD Add IPv6 support
const is_ip_address = (hostname) => {
  if (typeof hostname !== "string") return false;
  return hostname.split(".").every((s) => +s >= 0 && +s <= 255);
};
router.get(
  "/create",
  setTenant,
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
    if (!create_tenant_allowed(req)) {
      res.sendWrap(req.__("Create application"), req.__("Not allowed"));
      return;
    }

    if (is_ip_address(req.hostname))
      req.flash(
        "danger",
        req.__(
          "You are trying to create a tenant while connecting via an IP address rather than a domain. This will probably not work."
        )
      );
    if (getState().getConfig("create_tenant_warning"))
      req.flash(
        "warning",
        h4(req.__("Warning")) +
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
    res.sendWrap(
      req.__("Create application"),
      renderForm(tenant_form(req), req.csrfToken())
    );
  })
);
/**
 * Return URL of new Tenant
 * @param req - Request
 * @param subdomain - Tenant Subdomain name string
 * @returns {string}
 */
const getNewURL = (req, subdomain) => {
  var ports = "";
  const host = req.get("host");
  if (typeof host === "string") {
    const hosts = host.split(":");
    if (hosts.length > 1) ports = `:${hosts[1]}`;
  }
  const hostname = req.hostname;
  const newurl = `${req.protocol}://${subdomain}.${hostname}${ports}/`;

  return newurl;
};
/**
 * Create Tenant UI Main logic
 */
router.post(
  "/create",
  setTenant,
  error_catcher(async (req, res) => {
    // check that multi-tenancy is enabled
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
    // check that user has rights
    if (!create_tenant_allowed(req)) {
      res.sendWrap(req.__("Create application"), req.__("Not allowed"));
      return;
    }
    // declare  ui form
    const form = tenant_form(req);
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
      // get list of tenants
      const allTens = await getAllTenants();
      if (allTens.includes(subdomain) || !subdomain) {
        form.errors.subdomain = req.__(
          "A site with this subdomain already exists"
        );
        form.hasErrors = true;
        res.sendWrap(
          req.__("Create application"),
          renderForm(form, req.csrfToken())
        );
      } else {
        const newurl = getNewURL(req, subdomain);
        await create_tenant(subdomain, loadAllPlugins, newurl);
        res.sendWrap(
          req.__("Create application"),
          div(
            div(req.__("Success! Your new application is available at:")),

            div(
              { class: "my-3", style: "font-size: 22px" },
              a({ href: newurl, class: "new-tenant-link" }, newurl)
            ),
            p(
              req.__(
                "Please click the above link now to create the first user."
              ) +
                " " +
                req.__("Use this link to revisit your application at any time.")
            )
          )
        );
      }
    }
  })
);
/**
 * List tenants HTTP GET Web UI
 */
router.get(
  "/list",
  setTenant,
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
const tenant_settings_form = (req) =>
  config_fields_form({
    req,
    field_names: ["role_to_create_tenant", "create_tenant_warning"],
    action: "/tenant/settings",
    submitLabel: req.__("Save"),
  });

router.get(
  "/settings",
  setTenant,
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
      active_sub: "Multitenancy settings",
      contents: {
        type: "card",
        title: req.__("Multitenancy settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);
router.post(
  "/settings",
  setTenant,
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

      req.flash("success", req.__("Tenant settings updated"));
      res.redirect("/tenant/settings");
    }
  })
);
/**
 * Get Tenant info
 * @param subdomain
 * @returns {Promise<*>}
 */
// TBD move this function data layer or just separate file(reengineering)
const get_tenant_info = async (subdomain) => {
  const saneDomain = domain_sanitize(subdomain);

  return await db.runWithTenant(saneDomain, async () => {
    let info = {};
    // TBD fix the first user issue because not always firt user by id is creator of tenant
    const firstUser = await User.find({}, { orderBy: "id", limit: 1 });
    if (firstUser && firstUser.length > 0) {
      info.first_user_email = firstUser[0].email;
    }
    // users count
    info.nusers = await db.count("users");
    // roles count
    info.nroles = await db.count("_sc_roles");
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
    // triggers (actions) ccount
    info.nactions = await db.count("_sc_triggers");
    // error messages count
    info.nerrors = await db.count("_sc_errors");
    // config items count
    info.nconfigs = await db.count("_sc_config");
    // plugins count
    info.nplugins = await db.count("_sc_plugins");
    // TBD decide Do we need count tenants, table constraints, migrations
    // base url
    info.base_url = await getConfig("base_url");
    return info;
  });
};
/**
 * Tenant info
 */
router.get(
  "/info/:subdomain",
  setTenant,
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
                  th(req.__("E-mail")),
                  td(
                    a(
                      { href: "mailto:" + info.first_user_email },
                      info.first_user_email
                    )
                  )
                ),
                tr(
                  th(req.__("Users")),
                  td(a({ href: info.base_url + "useradmin" }, info.nusers))
                ),
                tr(
                  th(req.__("Roles")),
                  td(a({ href: info.base_url + "roleadmin" }, info.nroles))
                ),
                tr(
                  th(req.__("Tables")),
                  td(a({ href: info.base_url + "table" }, info.ntables))
                ),
                tr(
                  th(req.__("Table columns")),
                  td(a({ href: info.base_url + "table" }, info.nfields))
                ),
                tr(
                  th(req.__("Views")),
                  td(a({ href: info.base_url + "viewedit" }, info.nviews))
                ),
                tr(
                  th(req.__("Pages")),
                  td(a({ href: info.base_url + "pageedit" }, info.npages))
                ),
                tr(
                  th(req.__("Files")),
                  td(a({ href: info.base_url + "files" }, info.nfiles))
                ),
                tr(
                  th(req.__("Actions")),
                  td(a({ href: info.base_url + "actions" }, info.nactions))
                ),
                tr(
                  th(req.__("Plugins")),
                  td(a({ href: info.base_url + "plugins" }, info.nplugins))
                ),
                tr(
                  th(req.__("Configuration items")),
                  td(a({ href: info.base_url + "admin" }, info.nconfigs))
                ),
                tr(
                  th(req.__("Crashlogs")),
                  td(a({ href: info.base_url + "crashlog" }, info.nerrors))
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
                  ],
                  values: { base_url: info.base_url },
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
 */
router.post(
  "/info/:subdomain",
  setTenant,
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

    await db.runWithTenant(saneDomain, async () => {
      await getState().setConfig("base_url", base_url);
    });
    res.redirect(`/tenant/info/${text(subdomain)}`);
  })
);
/**
 * Execute Delete of tenant
 */
router.post(
  "/delete/:sub",
  setTenant,
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

    await deleteTenant(sub);
    res.redirect(`/tenant/list`);
  })
);
