const Router = require("express-promise-router");
const Form = require("saltcorn-data/models/form");
const { createTenant } = require("saltcorn-data/models/tenant");
const { renderForm, link, post_btn } = require("saltcorn-markup");

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
  res.sendWrap(`Create tenant`, renderForm(tenant_form()));
});

router.post("/create", async (req, res) => {
  const form = tenant_form();
  const valres = form.validate(req.body);
  if (valres.errors) res.sendWrap(`Create tenant`, renderForm(form));
  else {
    await createTenant(valres.success);
    res.sendWrap(`Create tenant`, "sucess!");
  }
});
