const {
  div,
  hr,
  form,
  input,
  label,
  i,
  a,
  span,
  ul,
  li,
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const {
  getConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes,
  isFixedConfig,
} = require("@saltcorn/data/models/config");
const { getState } = require("@saltcorn/data/db/state");

const Form = require("@saltcorn/data/models/form");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");

const restore_backup = (csrf, inner) =>
  form(
    {
      method: "post",
      action: `/admin/restore`,
      encType: "multipart/form-data",
    },
    input({ type: "hidden", name: "_csrf", value: csrf }),
    label({ class: "btn-link", for: "upload_to_restore" }, inner),
    input({
      id: "upload_to_restore",
      class: "d-none",
      name: "file",
      type: "file",
      accept: "application/zip,.zip",
      onchange: "this.form.submit();",
    })
  );

const add_edit_bar = ({ role, title, contents, what, url }) => {
  if (role > 1) return contents;
  const bar = div(
    { class: "alert alert-light d-print-none" },
    title,
    what && span({ class: "ml-1 badge badge-primary" }, what),
    a({ class: "ml-4", href: url }, "Edit&nbsp;", i({ class: "fas fa-edit" }))
  );

  if (contents.above) {
    contents.above.unshift(bar);
    return contents;
  } else return { above: [bar, contents] };
};

const send_settings_page = ({
  req,
  res,
  main_section,
  main_section_href,
  sub_sections,
  active_sub,
  contents,
  headers,
  no_nav_pills,
  sub2_page,
}) => {
  const pillCard = no_nav_pills
    ? []
    : [
        {
          type: "card",
          contents: div(
            { class: "d-flex" },
            ul(
              { class: "nav nav-pills plugin-section" },
              sub_sections.map(({ text, href }) =>
                li(
                  { class: "nav-item" },
                  a(
                    {
                      href,
                      class: ["nav-link", active_sub === text && "active"],
                    },
                    req.__(text)
                  )
                )
              )
            )
          ),
        },
      ];
  const title = headers
    ? {
        title: req.__(active_sub),
        headers,
      }
    : req.__(active_sub);
  res.sendWrap(title, {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Settings") },
          { text: req.__(main_section), href: main_section_href },
          {
            text: req.__(active_sub),
            href: sub2_page
              ? sub_sections.find((subsec) => subsec.text === active_sub).href
              : null,
          },
          ...(sub2_page
            ? [
                {
                  text: sub2_page,
                },
              ]
            : []),
        ],
      },
      ...pillCard,
      contents,
    ],
  });
};

const send_infoarch_page = (args) => {
  const tenant_list =
    db.is_it_multi_tenant() &&
    db.getTenantSchema() === db.connectObj.default_schema;
  return send_settings_page({
    main_section: "Information architecture",
    main_section_href: "/information-architecture",
    sub_sections: [
      { text: "Menu", href: "/menu" },
      { text: "Search", href: "/search/config" },
      ...(tenant_list ? [{ text: "Tenants", href: "/tenant/list" }] : []),
    ],
    ...args,
  });
};

const send_users_page = (args) => {
  const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
  return send_settings_page({
    main_section: "Users and security",
    main_section_href: "/useradmin",
    sub_sections: [
      { text: "Users", href: "/useradmin" },
      { text: "Roles", href: "/useradmin/roles" },
      { text: "Settings", href: "/useradmin/settings" },
      ...(isRoot ? [{ text: "SSL", href: "/useradmin/ssl" }] : []),
    ],
    ...args,
  });
};
const viewAttributes = async (key) => {
  const [v, table_name] = configTypes[key].type.split(" ");
  const table = await Table.findOne({ name: table_name });
  const views = await View.find({ table_id: table.id, viewtemplate: "Edit" });
  return { options: views.map((v) => v.name).join(",") };
};
const config_fields_form = async ({ field_names, req, ...formArgs }) => {
  const values = {};
  const state = getState();
  const fields = [];
  for (const name of field_names) {
    values[name] = state.getConfig(name);
    const isView = configTypes[name].type.startsWith("View ");
    const label = configTypes[name].label || name;
    const sublabel = configTypes[name].sublabel || configTypes[name].blurb;
    fields.push({
      name,
      ...configTypes[name],
      label: label ? req.__(label) : undefined,
      sublabel: sublabel ? req.__(sublabel) : undefined,

      type: isView ? "String" : configTypes[name].type,
      attributes: isView
        ? await viewAttributes(name)
        : configTypes[name].attributes,
    });
  }
  return new Form({ fields, values, ...formArgs });
};

module.exports = {
  restore_backup,
  add_edit_bar,
  send_settings_page,
  send_infoarch_page,
  config_fields_form,
  send_users_page,
};
