const Router = require("express-promise-router");
const Form = require("@saltcorn/data/models/form");
const { getState, create_tenant } = require("@saltcorn/data/db/state");
const {
  getAllTenants,
  domain_sanitize
} = require("@saltcorn/data/models/tenant");
const { renderForm, link, post_btn, mkTable } = require("@saltcorn/markup");
const { div, nbsp } = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const url = require("url");
const { loadAllPlugins } = require("../load_plugins");
const { setTenant, isAdmin } = require("../routes/utils.js");

const router = new Router();
module.exports = router;

const tenant_form = () =>
  new Form({
    action: "/tenant/create",    
    fields: [
      {
        name: "subdomain",
        label: "Subdomain",
        type: "String"
      },
      { label: "E-mail", name: "email", input_type: "text" },
      { label: "Password", name: "password", input_type: "password" }
    ]
  });
//TODO only if multi ten and not already in subdomain
router.get("/create", setTenant, async (req, res) => {
  if (!db.is_it_multi_tenant() || db.getTenantSchema() !== "public") {
    res.sendWrap(`Create application`, "Multi-tenancy not enabled");
    return;
  }
  req.flash("warning", "<h4>Warning</h4><p>Hosting on this site is provided for free and with no guarantee of availability or security of your application. This is only intended to evaluate the suitability of Saltcorn. If you would like to store private information that needs to be secure, please use self-hosted Saltcorn. See https://github.com/saltcorn/saltcorn<p>")
  res.sendWrap(`Create application`, renderForm(tenant_form()));
});

const getNewURL = (req, subdomain) => {
  var ports = "";
  const host = req.get("host");
  if (typeof host === "string") {
    const hosts = host.split(":");
    if (hosts.length > 1) ports = `:${hosts[1]}`;
  }
  const newurl = `${req.protocol}://${subdomain}.${req.hostname}${ports}/`;

  return newurl;
};

router.post("/create", setTenant, async (req, res) => {
  if (!db.is_it_multi_tenant() || db.getTenantSchema() !== "public") {
    res.sendWrap(`Create application`, "Multi-tenancy not enabled");
    return;
  }
  const form = tenant_form();
  const valres = form.validate(req.body);
  if (valres.errors) res.sendWrap(`Create application`, renderForm(form));
  else {
    const subdomain = domain_sanitize(valres.success.subdomain);
    const allTens = await getAllTenants();
    if (allTens.includes(subdomain)) {
      form.errors.subdomain = "A site with this subdomain already exists";
      form.hasErrors = true;
      res.sendWrap(`Create application`, renderForm(form));
    } else {
      await create_tenant(valres.success, loadAllPlugins);
      const newurl = getNewURL(req, subdomain);
      res.sendWrap(
        `Create application`,
        div(
          div("Success!"),
          div("Visit your new site: ", nbsp, link(newurl, newurl))
        )
      );
    }
  }
});

router.get("/list", setTenant, isAdmin, async (req, res) => {
  if (!db.is_it_multi_tenant() || db.getTenantSchema() !== "public") {
    res.sendWrap(`Create application`, "Multi-tenancy not enabled");
    return;
  }
  const tens = await db.select("_sc_tenants");
  res.sendWrap(
    "Tenant",
    mkTable(
      [
        { label: "Subdomain", key: "subdomain" },
        { label: "email", key: "email" },
        {
          label: "Delete",
          key: r => post_btn(`/tenant/delete/${r.subdomain}`, "Delete")
        }
      ],
      tens
    )
  );
});

router.post("/delete/:sub", setTenant, isAdmin, async (req, res) => {
  if (!db.is_it_multi_tenant() || db.getTenantSchema() !== "public") {
    res.sendWrap(`Create application`, "Multi-tenancy not enabled");
    return;
  }
  const { sub } = req.params;

  const subdomain = domain_sanitize(sub)
  await db.query(`drop schema if exists ${subdomain} CASCADE `);
  await db.deleteWhere("_sc_tenants",{subdomain})
  res.redirect(`/tenant/list`);

})
