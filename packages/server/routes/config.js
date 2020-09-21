const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const Form = require("@saltcorn/data/models/form");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");

const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
} = require("@saltcorn/markup");
const {
  getConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes,
} = require("@saltcorn/data/models/config");
const { table, tbody, tr, th, td, div } = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

const wrap = (cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: "Settings" },
        { text: "Configuration", href: lastBc && "/config" },
        ...(lastBc ? [lastBc] : []),
      ],
    },
    {
      type: "card",
      title: cardTitle,
      contents: response,
    },
  ],
});

const show_section = ({ name, keys }, cfgs, files, req) => {
  const canEdit = (key) =>
    getState().types[configTypes[key].type] || configTypes[key].type === "File";
  const hideValue = (key) =>
    configTypes[key] ? configTypes[key].type === "hidden" : true;
  const showFile = (r) => {
    const file = files.find((f) => f.id == r.value);
    return file ? file.filename : "Unknown file";
  };
  const showValue = (key) =>
    hideValue(key)
      ? "..."
      : configTypes[key].type === "File"
      ? showFile(cfgs[key])
      : JSON.stringify(cfgs[key].value);
  const showkey = (key) =>
    tr(
      td(cfgs[key].label || key),
      td(showValue(key)),
      td(canEdit(key) ? link(`/config/edit/${key}`, "Edit") : ""),
      td(post_delete_btn(`/config/delete/${key}`, req.csrfToken()))
    );
  return (
    tr(th({ colspan: 4, class: "pt-4" }, name)) + keys.map(showkey).join("")
  );
};
const sections = [
  {
    name: "Site identity",
    keys: ["site_name", "site_logo_id", "base_url"],
  },
  {
    name: "Authentication",
    keys: ["allow_signup", "login_menu", "allow_forgot"],
  },
  {
    name: "E-mail",
    keys: [
      "smtp_host",
      "smtp_username",
      "smtp_password",
      "smtp_port",
      "smtp_secure",
      "email_from",
    ],
  },
  {
    name: "Development",
    keys: ["development_mode", "log_sql"],
  },
];

const miscSection = (cfgs) => ({
  name: "Other",
  keys: Object.keys(cfgs).filter(
    (key) => !sections.some((section) => section.keys.includes(key))
  ),
});
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const cfgs = await getAllConfigOrDefaults();
    const files = await File.find({ min_role_read: 10 });

    const configTable = div(
      { class: "table-responsive" },
      table(
        { class: "table table-sm" },
        tbody(
          sections.map((section) => show_section(section, cfgs, files, req)),
          show_section(miscSection(cfgs), cfgs, files, req)
        )
      )
    );

    res.sendWrap(`Configuration`, wrap("Configuration", configTable));
  })
);

const formForKey = async (key, value) => {
  const form = new Form({
    action: `/config/edit/${key}`,
    blurb: configTypes[key].blurb,
    fields: [
      {
        name: key,
        label: configTypes[key].label || key,
        type: configTypes[key].type,
        sublabel: configTypes[key].sublabel,
        attributes: configTypes[key].attributes,
      },
    ],
    ...(typeof value !== "undefined" && { values: { [key]: value } }),
  });
  await form.fill_fkey_options();
  return form;
};
router.get(
  "/edit/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const value = await getConfig(key);
    const form = await formForKey(key, value);
    res.sendWrap(
      `Edit configuration key ${key}`,
      wrap(`Edit configuration key ${key}`, renderForm(form, req.csrfToken()), {
        text: key,
      })
    );
  })
);

router.post(
  "/edit/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const form = await formForKey(key);
    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(
        `Edit configuration key ${key}`,
        wrap(
          `Edit configuration key ${key}`,
          renderForm(form, req.csrfToken()),
          { text: key }
        )
      );
    else {
      await getState().setConfig(key, valres.success[key]);
      req.flash("success", `Configuration key ${key} saved`);

      res.redirect(`/config/`);
    }
  })
);

router.post(
  "/delete/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;
    await getState().deleteConfig(key);
    req.flash("success", `Configuration key ${key} deleted`);
    res.redirect(`/config/`);
  })
);
