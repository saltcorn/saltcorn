const Router = require("express-promise-router");
const Form = require("@saltcorn/data/models/form");
const { getState, create_tenant } = require("@saltcorn/data/db/state");
const {
  getAllTenants,
  domain_sanitize,
  deleteTenant,
} = require("@saltcorn/data/models/tenant");
const { renderForm, link, post_btn, mkTable } = require("@saltcorn/markup");
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

const router = new Router();
module.exports = router;

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
//TODO only if multi ten and not already in subdomain
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
    req.flash(
      "warning",
      h4(req.__("Warning")) +
        p(
          req.__(
            "Hosting on this site is provided for free and with no guarantee of availability or security of your application. "
          ) +
            req.__(
              "This facility is intended solely for you to evaluate the suitability of Saltcorn. "
            ) +
            req.__(
              "If you would like to store private information that needs to be secure, please use self-hosted Saltcorn. "
            ) +
            'See <a href="https://github.com/saltcorn/saltcorn">GitHub repository</a> for instructions<p>'
        )
    );
    res.sendWrap(
      req.__("Create application"),
      renderForm(tenant_form(req), req.csrfToken())
    );
  })
);

const getNewURL = (req, subdomain) => {
  var ports = "";
  const host = req.get("host");
  if (typeof host === "string") {
    const hosts = host.split(":");
    if (hosts.length > 1) ports = `:${hosts[1]}`;
  }
  const hostname = req.hostname.replace(/^(www\.)/, "");
  const newurl = `${req.protocol}://${subdomain}.${hostname}${ports}/`;

  return newurl;
};

router.post(
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
    const form = tenant_form(req);
    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(
        req.__("Create application"),
        renderForm(form, req.csrfToken())
      );
    else {
      const subdomain = domain_sanitize(valres.success.subdomain);
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
        await create_tenant(subdomain, loadAllPlugins);
        const newurl = getNewURL(req, subdomain);
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
              )
            )
          )
        );
      }
    }
  })
);

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
    res.sendWrap("Tenant", {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Settings") }, { text: "Tenants" }],
        },
        {
          type: "card",
          title: "Tenants",
          contents: [
            mkTable(
              [
                {
                  label: "Subdomain",
                  key: (r) =>
                    link(getNewURL(req, r.subdomain), text(r.subdomain)),
                },
                {
                  label: "Information",
                  key: (r) =>
                    a(
                      { href: `/tenant/info/${text(r.subdomain)}` },
                      i({ class: "fas fa-lg fa-info-circle" })
                    ),
                },
                {
                  label: "Delete",
                  key: (r) =>
                    post_btn(
                      `/tenant/delete/${r.subdomain}`,
                      "Delete",
                      req.csrfToken(),
                      { small: true }
                    ),
                },
              ],
              tens
            ),
            div(`Found ${tens.length} tenants`),
            div(link("/tenant/create", "Create new tenant")),
          ],
        },
      ],
    });
  })
);
const get_tenant_info = async (subdomain) => {
  const saneDomain = domain_sanitize(subdomain);

  return await db.runWithTenant(saneDomain, async () => {
    let info = {};
    const firstUser = await User.find({}, { orderBy: "id", limit: 1 });
    if (firstUser && firstUser.length > 0) {
      info.first_user_email = firstUser[0].email;
    }
    info.nusers = await db.count("users");
    info.ntables = await db.count("_sc_tables");
    info.nviews = await db.count("_sc_views");
    info.nfiles = await db.count("_sc_files");
    info.npages = await db.count("_sc_pages");
    return info;
  });
};
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
    res.sendWrap(`${text(subdomain)} tenant`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: "Tenants", href: "/tenant/list" },
            { text: text(subdomain) },
          ],
        },
        {
          type: "card",
          title: `${text(subdomain)} tenant`,
          contents: [
            table(
              tr(th(req.__("E-mail")), td(info.first_user_email)),
              tr(th(req.__("Users")), td(info.nusers)),
              tr(th(req.__("Tables")), td(info.ntables)),
              tr(th(req.__("Views")), td(info.nviews)),
              tr(th(req.__("Pages")), td(info.npages)),
              tr(th(req.__("Files")), td(info.nfiles))
            ),
          ],
        },
      ],
    });
  })
);

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
