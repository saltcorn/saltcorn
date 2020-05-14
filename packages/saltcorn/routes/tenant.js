const Router = require("express-promise-router");
const Form = require("saltcorn-data/models/form");
const { getState, create_tenant } = require("saltcorn-data/db/state");
const { renderForm, link, post_btn } = require("saltcorn-markup");
const { div, nbsp } = require("saltcorn-markup/tags");
const db = require("saltcorn-data/db");
const url = require("url");
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
router.get("/create", async (req, res) => {
  if (!db.is_it_multi_tenant() || db.getTenantSchema() !== "public") {
    res.sendWrap(`Create tenant`, "Multi-tenancy not enabled");
    return;
  }
  res.sendWrap(`Create tenant`, renderForm(tenant_form()));
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

router.post("/create", async (req, res) => {
  if (!db.is_it_multi_tenant() || db.getTenantSchema() !== "public") {
    res.sendWrap(`Create tenant`, "Multi-tenancy not enabled");
    return;
  }
  const form = tenant_form();
  const valres = form.validate(req.body);
  if (valres.errors) res.sendWrap(`Create tenant`, renderForm(form));
  else {
    await create_tenant(valres.success);
    const newurl = getNewURL(req, valres.success.subdomain);
    res.sendWrap(
      `Create tenant`,
      div(
        div("Success!"),
        div("Visit your new site: ", nbsp, link(newurl, newurl))
      )
    );
  }
});
