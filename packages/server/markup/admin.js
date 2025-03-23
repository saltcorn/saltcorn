/**
 * Admin Menu (Settings...)
 * @category server
 * @module markup/admin
 * @subcategory markup
 */

const {
  div,
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
const { configTypes } = require("@saltcorn/data/models/config");
const { getState } = require("@saltcorn/data/db/state");
const Form = require("@saltcorn/data/models/form");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const Field = require("@saltcorn/data/models/field");

/**
 * Restore Backup
 * @param {*} csrf
 * @param {*} inner
 * @param {string} action
 * @returns {*}
 */
const restore_backup = (csrf, inner, action = `/admin/restore`) =>
  form(
    {
      method: "post",
      action,
      encType: "multipart/form-data",
    },
    input({ type: "hidden", name: "_csrf", value: csrf }),
    label(
      {
        class: "btn-link",
        for: "upload_to_restore",
        style: { cursor: "pointer" },
      },
      inner
    ),
    input({
      id: "upload_to_restore",
      class: "d-none",
      name: "file",
      type: "file",
      accept: "application/zip,.zip,.sczip",
      onchange: "notifyAlert('Restoring backup...', true);this.form.submit();",
    })
  );

/**
 * Add Edit Bar
 * @param {object} opts
 * @param {*} opts.role
 * @param {*} opts.title
 * @param {*} opts.contents
 * @param {*} opts.what
 * @param {*} opts.url
 * @param {*} opts.req
 * @returns {object}
 */
const add_edit_bar = ({
  role,
  title,
  contents,
  what,
  url,
  req,
  viewtemplate,
  table,
  view,
  cfgUrl,
}) => {
  if (req && req.headers.localizedstate)
    return { above: [contents], noWrapTop: true };
  if (role > 1 && req && req.xhr) return { above: [contents] }; //make sure not put in card
  if (role > 1) return contents;

  let viewSpec = "";
  if (viewtemplate) viewSpec = viewtemplate;
  if (table) {
    const tbl = Table.findOne(table);
    if (tbl)
      viewSpec = `${viewSpec} on <a href="/table/${table}">${tbl.name}</a>`;
  }
  const singleton = view?.viewtemplateObj?.singleton;

  const bar = div(
    { class: "card p-1 mt-1 mb-3 d-print-none admin-edit-bar" },
    div(
      { class: "card-body p-1" },
      i({ class: "fas fa-user-cog me-1" }),
      what && span({ class: "ms-1 me-2 badge bg-secondary" }, what),
      title,
      !singleton &&
        a(
          { class: "ms-2", href: url },
          "Edit&nbsp;",
          i({ class: "fas fa-edit" })
        ),
      cfgUrl && !singleton
        ? a(
            { class: "ms-1 me-3", href: cfgUrl },
            "Configure&nbsp;",
            i({ class: "fas fa-cog" })
          )
        : "",
      !singleton && viewSpec
    )
  );

  if (contents.above) {
    contents.above.unshift(bar);
    return contents;
  } else return { above: [bar, contents] };
};

/**
 * Send Settings Page
 * @param {object} opts
 * @param {*} opts.req,
 * @param {*} opts.res,
 * @param {*} opts.main_section,
 * @param {*} opts.main_section_href,
 * @param {*} opts.sub_sections,
 * @param {*} opts.active_sub,
 * @param {*} opts.contents,
 * @param {*} opts.headers,
 * @param {*} opts.no_nav_pills,
 * @param {*} opts.sub2_page,
 */
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
  page_title,
}) => {
  const pillCard = no_nav_pills
    ? []
    : [
        {
          type: "card",
          class: "mt-0",
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
  // headers
  const pg_title = page_title || req.__(active_sub);
  const title = headers
    ? {
        title: pg_title,
        headers,
      }
    : pg_title;
  res.sendWrap(title, {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Settings"), href: "/settings" },
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

/**
 * Send InfoArch Page
 * @param {object} args
 * @returns {void}
 */
const send_infoarch_page = (args) => {
  const tenant_list =
    db.is_it_multi_tenant() &&
    db.getTenantSchema() === db.connectObj.default_schema;
  const role = args.req?.user.role_id || 100;
  const isUserAdmin = role === 1;
  const state = getState();
  const canEditMenu = state.getConfig("min_role_edit_menu", 1) >= role;
  const canEditSearch = state.getConfig("min_role_edit_search", 1) >= role;
  const canCreateSnapshot =
    state.getConfig("min_role_create_snapshots", 1) >= role && role > 1;

  return send_settings_page({
    main_section: "Site structure",
    main_section_href: "/site-structure",
    sub_sections: [
      ...(canEditMenu ? [{ text: "Menu", href: "/menu" }] : []),
      ...(canEditSearch ? [{ text: "Search", href: "/search/config" }] : []),
      ...(canCreateSnapshot
        ? [{ text: "Snapshots", href: "/site-structure/create-snapshot" }]
        : []),
      ...(isUserAdmin
        ? [
            { text: "Library", href: "/library/list" },
            { text: "Languages", href: "/site-structure/localizer" },
            ...(tenant_list
              ? [
                  { text: "Tenants", href: "/tenant/list" },
                  { text: "Multitenancy", href: "/tenant/settings" },
                ]
              : []),
            { text: "Pagegroups", href: "/page_group/settings" },
            { text: "Tags", href: "/tag" },
            { text: "Diagram", href: "/diagram" },
            { text: "Registry editor", href: "/registry-editor" },
          ]
        : []),
    ],
    ...args,
  });
};

/**
 * Send Users Page
 * @param {object} args
 * @returns {void}
 */
const send_users_page = (args) => {
  const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
  return send_settings_page({
    main_section: "Users and security",
    main_section_href: "/useradmin",
    sub_sections: [
      { text: "Users", href: "/useradmin" },
      { text: "Roles", href: "/roleadmin" },
      { text: "Login and Signup", href: "/useradmin/settings" },
      { text: "Table access", href: "/useradmin/table-access" },
      ...(isRoot ? [{ text: "SSL", href: "/useradmin/ssl" }] : []),
      { text: "HTTP", href: "/useradmin/http" },
      { text: "Permissions", href: "/useradmin/permissions" },
    ],
    ...args,
  });
};

/**
 * Send Files Page
 * @param {object} args
 * @returns {void}
 */
const send_files_page = (args) => {
  const isUserAdmin = args.req?.user.role_id === 1;
  return send_settings_page({
    main_section: "Files",
    main_section_href: "/files",
    no_nav_pills: !isUserAdmin,
    sub_sections: isUserAdmin
      ? [
          { text: "Files", href: "/files" },
          ...(isUserAdmin
            ? [
                { text: "Storage", href: "/files/storage" },
                { text: "Settings", href: "/files/settings" },
              ]
            : []),
        ]
      : null,
    ...args,
  });
};

const send_tags_page = (args) => {
  return send_settings_page({
    main_section: "Tags",
    ...args,
  });
};

/**
 * Send Events Page
 * @param {object} args
 * @returns {void}
 */
const send_events_page = (args) => {
  const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
  const isUserAdmin = args.req?.user.role_id === 1;
  return send_settings_page({
    main_section: "Events",
    main_section_href: "/events",
    sub_sections: [
      { text: "Triggers", href: "/actions" },
      ...(isUserAdmin
        ? [
            { text: "Custom", href: "/eventlog/custom" },
            { text: "Settings", href: "/eventlog/settings" },
            { text: "Event log", href: "/eventlog" },
          ]
        : []),
      { text: "Workflow runs", href: "/actions/runs" },
      ...(isRoot ? [{ text: "Crash log", href: "/crashlog" }] : []),
    ],
    ...args,
  });
};

/**
 * Send Admin page
 * @param {object} args
 * @returns {void}
 */
const send_admin_page = (args) => {
  //const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
  return send_settings_page({
    main_section: "About application",
    main_section_href: "/admin",
    sub_sections: [
      { text: "Site identity", href: "/admin" },
      { text: "Backup", href: "/admin/backup" },
      { text: "Email", href: "/admin/email" },
      { text: "System", href: "/admin/system" },
      { text: "Mobile app", href: "/admin/build-mobile-app" },
      { text: "Development", href: "/admin/dev" },
      { text: "Notifications", href: "/admin/notifications" },
    ],
    ...args,
  });
};

/**
 * View Attributes
 * @param {object} key
 * @returns {Promise<object>}
 */
const viewAttributes = async (key) => {
  const [v, table_name] = configTypes[key].type.split(" ");
  const table = Table.findOne({ name: table_name });
  const views = await View.find({ table_id: table.id });
  return {
    options: views.map((v) => {
      v.table = table;
      return v.select_option;
    }),
  };
};

/**
 * Flash start if required
 * @param {*} cfgForm
 * @param {*} req
 * @returns {void}
 */
const check_if_restart_required = (cfgForm, req) => {
  let restart = false;
  cfgForm.fields.forEach((f) => {
    if (configTypes[f.name]?.restart_required) {
      const current = getState().getConfig(f.name);
      if (current !== cfgForm.values[f.name]) restart = true;
    }
  });
  return restart;
};

/**
 * Flash restart
 * @param {object} req
 * @returns {void}
 */
const flash_restart = (req) => {
  req.flash(
    "warning",
    req.__(`Restart required for changes to take effect.`) +
      " " +
      a({ href: "/admin/system" }, req.__("Restart here"))
  );
};

/**
 * Config fields form
 * @param {object} opts
 * @param {string[]} opts.field_names
 * @param {object} opts.req
 * @param {*} opts.formArgs
 * @returns {Promise<Form>}
 */
const config_fields_form = async ({
  field_names,
  req,
  action,
  ...formArgs
}) => {
  const values = {};
  const state = getState();
  const fields = [];
  const tenant = db.getTenantSchema();
  const roleAttribs = {
    options: (await User.get_roles()).map((r) => ({
      label: r.role,
      name: `${r.id}`,
    })),
  };
  const getTenants = async () => {
    const tens = await db.select("_sc_tenants");
    return { options: tens.map((t) => t.subdomain) };
  };
  for (const name0 of field_names) {
    if (typeof name0 === "object" && name0.section_header) {
      fields.push({
        input_type: "section_header",
        label: req.__(name0.section_header),
        sublabel: name0.sublabel ? req.__(name0.sublabel) : undefined,
      });
      continue;
    }
    let name, showIf;
    if (typeof name0 === "object" && name0.name) {
      name = name0.name;
      showIf = name0.showIf;
    } else {
      name = name0;
    }
    values[name] = state.getConfig(name);
    // console.log(`config field name: %s`,name);
    if (configTypes[name].root_only && tenant !== db.connectObj.default_schema)
      continue;
    const isView = (configTypes[name].type || "").startsWith("View ");
    const isRole = configTypes[name].type === "Role";
    const isTenant = configTypes[name].type === "Tenant";
    const label = configTypes[name].label || name;
    const sublabel = configTypes[name].sublabel || configTypes[name].blurb;

    if (configTypes[name].type === "Repeat") {
      const repFields = configTypes[name].fields;
      const filledFields = [];
      for (const rfield of repFields) {
        const fillField = new Field(rfield);
        await fillField.fill_fkey_options();
        filledFields.push(fillField);
      }
      fields.push(
        new FieldRepeat({
          name,
          label,
          fields: filledFields,
          showIf,
        })
      );

      continue;
    }

    fields.push({
      name,
      ...configTypes[name],
      label: label ? req.__(label) : undefined,
      sublabel:
        (sublabel ? req.__(sublabel) : "") +
        (isView
          ? ". " +
            a(
              {
                "data-dyn-href": `\`/viewedit/config/\${${name}}\``,
                "data-show-if": `showIfFormulaInputs($('select[name=${name}]'), '${name}')`,
                target: "_blank",
              },
              req.__("Configure")
            )
          : ""),
      disabled: state.isFixedConfig(name),
      type:
        isView || isRole || isTenant
          ? "String"
          : configTypes[name].input_type
            ? undefined
            : configTypes[name].type,
      input_type: configTypes[name].input_type,
      showIf,
      help: configTypes[name].helpTopic
        ? { topic: configTypes[name].helpTopic }
        : undefined,
      attributes: isView
        ? await viewAttributes(name)
        : isRole
          ? roleAttribs
          : isTenant
            ? await getTenants()
            : configTypes[name].attributes,
    });
  }
  const form = new Form({
    fields,
    values,
    action,
    noSubmitButton: true,
    onChange: `saveAndContinue(this)`,
    ...formArgs,
  });
  await form.fill_fkey_options();
  return form;
};

/**
 * Save config fields from page
 * @param {*} form
 * @returns {Promise<void>}
 */
const save_config_from_form = async (form) => {
  const state = getState();

  for (const [k, v] of Object.entries(form.values)) {
    if (!state.isFixedConfig(k) && typeof v !== "undefined") {
      await state.setConfig(k, v);
    }
  }
};

/**
 * Get Base Domain
 * @returns {string|null} base domain
 */
const getBaseDomain = () => {
  const base_url = getState().getConfig("base_url");
  if (!base_url) return null;
  return base_url
    .toLowerCase()
    .replace("https://", "")
    .replace("http://", "")
    .replace(/\//g, "");
};

/**
 * @param {object} req
 * @param {string} domain
 * @returns {boolean}
 */
const hostname_matches_baseurl = (req, domain) => domain === req.hostname;

/**
 * @param {string} domain
 * @returns {string[]|boolean}
 */
const is_hsts_tld = (domain) => {
  if (!domain) return false;
  const ds = domain.split(".");
  const tld = ds[ds.length - 1];
  return [
    "gle",
    "prod",
    "docs",
    "cal",
    "soy",
    "how",
    "chrome",
    "ads",
    "mov",
    "youtube",
    "channel",
    "nexus",
    "goog",
    "boo",
    "dad",
    "drive",
    "hangout",
    "new",
    "eat",
    "app",
    "moto",
    "ing",
    "meme",
    "here",
    "zip",
    "guge",
    "car",
    "foo",
    "day",
    "dev",
    "play",
    "gmail",
    "fly",
    "gbiz",
    "rsvp",
    "android",
    "map",
    "page",
    "google",
    "dclk",
    "search",
    "prof",
    "phd",
    "esq",
  ].includes(tld);
};
module.exports = {
  is_hsts_tld,
  getBaseDomain,
  hostname_matches_baseurl,
  restore_backup,
  add_edit_bar,
  send_settings_page,
  send_infoarch_page,
  config_fields_form,
  send_users_page,
  send_events_page,
  send_admin_page,
  send_files_page,
  save_config_from_form,
  check_if_restart_required,
  flash_restart,
  send_tags_page,
};
