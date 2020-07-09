const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");

const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const {
  getConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes
} = require("@saltcorn/data/models/config");

const router = new Router();
module.exports = router;

const menuForm = async () => {
  const images = await File.find(
    { mime_super: "image" },
    { orderBy: "filename" }
  );

  const views = await View.find({});
  const pages = await Page.find({});
  const roles = await User.get_roles();

  return new Form({
    action: "/menu/",
    fields: [
      {
        name: "site_name",
        label: "Site name",
        input_type: "text"
      },
      {
        name: "site_logo",
        label: "Site logo",
        input_type: "select",
        options: images
      },
      new FieldRepeat({
        name: "menuitems",
        fields: [
          {
            name: "type",
            label: "Type",
            input_type: "select",
            class: "menutype",
            required: true,
            options: ["View", "Page", "Link"]
          },
          {
            name: "label",
            label: "Text label",
            input_type: "text",
            required: true
          },
          {
            name: "min_role",
            label: "Minimum role",
            input_type: "select",
            options: roles.map(r => r.role)
          },
          {
            name: "url",
            label: "URL",
            input_type: "text",
            showIf: { ".menutype": "Link" }
          },
          {
            name: "pagename",
            label: "Page",
            input_type: "select",
            options: pages.map(r => r.name),
            showIf: { ".menutype": "Page" }
          },
          {
            name: "viewname",
            label: "Views",
            input_type: "select",
            options: views.map(r => r.name),
            showIf: { ".menutype": "View" }
          }
        ]
      })
    ]
  });
};

//create -- new
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await menuForm();
    res.sendWrap(`Menu editor`, renderForm(form, req.csrfToken()));
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const form = formForKey(key);
    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(
        `Edit configuration key ${key}`,
        renderForm(form, req.csrfToken())
      );
    else {
      await getState().setConfig(key, valres.success[key]);
      req.flash("success", `Configuration key ${key} saved`);

      res.redirect(`/menu`);
    }
  })
);
