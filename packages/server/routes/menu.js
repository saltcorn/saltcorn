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

const router = new Router();
module.exports = router;

const menuForm = async (req) => {
  const imageFiles = await File.find(
    { mime_super: "image" },
    { orderBy: "filename" }
  );
  const images = [
    { label: "None", value: 0 },
    ...imageFiles.map((f) => ({ label: f.filename, value: f.id })),
  ];
  const views = await View.find({});
  const pages = await Page.find({});
  const roles = await User.get_roles();

  return new Form({
    action: "/menu/",
    submitLabel: req.__("Save"),
    fields: [
      {
        name: "site_name",
        label: req.__("Site name"),
        input_type: "text",
      },
      {
        name: "site_logo_id",
        label: req.__("Site logo"),
        input_type: "select",
        options: images,
      },
      new FieldRepeat({
        name: "menu_items",
        fields: [
          {
            name: "type",
            label: req.__("Type"),
            input_type: "select",
            class: "menutype",
            required: true,
            options: ["View", "Page", "Link"],
          },
          {
            name: "label",
            label: req.__("Text label"),
            input_type: "text",
            required: true,
          },
          {
            name: "min_role",
            label: req.__("Minimum role"),
            input_type: "select",
            options: roles.map((r) => ({ label: r.role, value: r.id })),
          },
          {
            name: "url",
            label: req.__("URL"),
            input_type: "text",
            showIf: { ".menutype": "Link" },
          },
          {
            name: "pagename",
            label: req.__("Page"),
            input_type: "select",
            options: pages.map((r) => r.name),
            showIf: { ".menutype": "Page" },
          },
          {
            name: "viewname",
            label: req.__("Views"),
            input_type: "select",
            options: views.map((r) => r.name),
            showIf: { ".menutype": "View" },
          },
        ],
      }),
    ],
  });
};

//create -- new
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await menuForm(req);
    const state = getState();
    form.values.site_name = state.getConfig("site_name");
    form.values.site_logo_id = state.getConfig("site_logo_id");
    form.values.menu_items = state.getConfig("menu_items");
    res.sendWrap(
      { title: req.__(`Menu editor`), headers: [{}] },
      {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [{ text: req.__("Settings") }, { text: req.__("Menu") }],
          },
          {
            type: "card",
            title: req.__(`Menu editor`),
            contents: renderForm(form, req.csrfToken()),
          },
        ],
      }
    );
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await menuForm(req);

    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(req.__(`Menu editor`), {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [{ text: req.__("Settings") }, { text: req.__("Menu") }],
          },
          {
            type: "card",
            title: req.__(`Menu editor`),
            contents: renderForm(form, req.csrfToken()),
          },
        ],
      });
    else {
      await getState().setConfig("site_name", valres.success.site_name);
      await getState().setConfig("site_logo_id", valres.success.site_logo_id);
      await getState().setConfig("menu_items", valres.success.menu_items);
      req.flash("success", req.__(`Menu updated`));

      res.redirect(`/menu`);
    }
  })
);
