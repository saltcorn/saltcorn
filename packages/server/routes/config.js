const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
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
  isFixedConfig,
} = require("@saltcorn/data/models/config");
const { table, tbody, tr, th, td, div } = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

const wrap = (req, cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: req.__("Settings") },
        { text: req.__("Configuration"), href: lastBc && "/config" },
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
    getState().types[configTypes[key].type] ||
    configTypes[key].type === "File" ||
    configTypes[key].type.startsWith("View ");
  const hideValue = (key) =>
    configTypes[key] ? configTypes[key].type === "hidden" : true;
  const showFile = (r) => {
    const file = files.find((f) => f.id == r.value);
    return file ? file.filename : req.__("Unknown file");
  };
  const showValue = (key) =>
    hideValue(key)
      ? "..."
      : configTypes[key].type === "File"
      ? showFile(cfgs[key])
      : JSON.stringify(cfgs[key].value);
  const showkey = (key) =>
    isFixedConfig(key)
      ? ""
      : tr(
          td(req.__(cfgs[key].label || key)),
          td(showValue(key)),
          td(canEdit(key) ? link(`/config/edit/${key}`, req.__("Edit")) : ""),
          td(post_delete_btn(`/config/delete/${key}`, req))
        );
  return (
    tr(th({ colspan: 4, class: "pt-4" }, name)) + keys.map(showkey).join("")
  );
};
const sections = (req) => [
  {
    name: req.__("Site identity"),
    keys: ["site_name", "site_logo_id", "base_url"],
  },
  {
    name: req.__("Authentication"),
    keys: ["allow_signup", "login_menu", "allow_forgot", "new_user_form"],
  },
  {
    name: req.__("E-mail"),
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
    name: req.__("Development"),
    keys: ["development_mode", "log_sql"],
  },
];

const miscSection = (cfgs, req) => ({
  name: req.__("Other"),
  keys: Object.keys(cfgs).filter(
    (key) => !sections(req).some((section) => section.keys.includes(key))
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
          sections(req).map((section) =>
            show_section(section, cfgs, files, req)
          ),
          show_section(miscSection(cfgs, req), cfgs, files, req)
        )
      )
    );

    res.sendWrap(
      req.__(`Configuration`),
      wrap(req, req.__("Configuration"), configTable)
    );
  })
);

const formForKey = async (req, key, value) => {
  const isView = configTypes[key].type.startsWith("View ");
  const viewAttributes = async () => {
    const [v, table_name] = configTypes[key].type.split(" ");
    const table = await Table.findOne({ name: table_name });
    const views = await View.find({ table_id: table.id, viewtemplate: "Edit" });
    return { options: views.map((v) => v.name).join(",") };
  };
  const form = new Form({
    action: `/config/edit/${key}`,
    blurb: req.__(configTypes[key].blurb),
    submitLabel: req.__("Save"),
    fields: [
      {
        name: key,
        label: req.__(configTypes[key].label || key),
        type: isView ? "String" : configTypes[key].type,
        fieldview: configTypes[key].fieldview,
        sublabel: req.__(configTypes[key].sublabel),
        attributes: isView
          ? await viewAttributes()
          : configTypes[key].attributes,
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
    const form = await formForKey(req, key, value);
    res.sendWrap(
      req.__(`Edit configuration key %s`, key),
      wrap(
        req,
        req.__(`Edit configuration key %s`, key),
        renderForm(form, req.csrfToken()),
        {
          text: key,
        }
      )
    );
  })
);

router.post(
  "/edit/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const form = await formForKey(req, key);
    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(
        req.__(`Edit configuration key %s`, key),
        wrap(
          req,
          req.__(`Edit configuration key %s`, key),
          renderForm(form, req.csrfToken()),
          { text: key }
        )
      );
    else {
      await getState().setConfig(key, valres.success[key]);
      req.flash("success", req.__(`Configuration key %s saved`, key));

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
    req.flash("success", req.__(`Configuration key %s deleted`, key));
    res.redirect(`/config/`);
  })
);
