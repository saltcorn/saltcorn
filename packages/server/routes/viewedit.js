/**
 * View Edit Router
 * @category server
 * @module routes/viewedit
 * @subcategory routes
 */

const Router = require("express-promise-router");

const { renderForm, renderBuilder, toast } = require("@saltcorn/markup");
const tags = require("@saltcorn/markup/tags");
const { p, a, div, script, text, domReady, code, pre, tbody, tr, th, td } =
  tags;

const { getState } = require("@saltcorn/data/db/state");
const {
  isAdmin,
  error_catcher,
  addOnDoneRedirect,
  is_relative_url,
} = require("./utils.js");
const { setTableRefs, viewsList } = require("./common_lists");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");
const Page = require("@saltcorn/data/models/page");
const File = require("@saltcorn/data/models/file");
const db = require("@saltcorn/data/db");
const { sleep } = require("@saltcorn/data/utils");

const { add_to_menu } = require("@saltcorn/admin-models/models/pack");

/**
 * @type {object}
 * @const
 * @namespace vieweditRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name get
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    let orderBy = "name";
    if (req.query._sortby === "viewtemplate") orderBy = "viewtemplate";
    const views = await View.find({}, { orderBy, nocase: true });
    await setTableRefs(views);

    if (req.query._sortby === "table")
      views.sort((a, b) =>
        a.table.toLowerCase() > b.table.toLowerCase() ? 1 : -1
      );

    const viewMarkup = await viewsList(views, req);
    const tables = await Table.find();
    const viewAccessWarning = (view) => {
      const table = tables.find((t) => t.name === view.table);
      if (!table) return false;
      if (table.name === "users") return false;
      if (table.ownership_field_id || table.ownership_formula) return false;

      return table.min_role_read < view.min_role;
    };
    const hasAccessWarning = views.filter(viewAccessWarning);
    const accessWarning =
      hasAccessWarning.length > 0
        ? toast(
            "danger",
            `<p>${req.__(
              `You have views with a role to access lower than the table role to read, with no table ownership. This may cause a denial of access. Users need to have table read access to any data displayed.`
            )}</p> 
      ${req.__("Views potentially affected")}: ${hasAccessWarning
              .map((v) => v.name)
              .join(", ")}`,
            true
          )
        : "";
    res.sendWrap(req.__(`Views`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Views") }],
        },
        {
          type: "card",
          class: "mt-0",
          title: req.__("Your views"),
          contents: [
            accessWarning,
            viewMarkup,
            tables.length > 0
              ? a(
                  { href: `/viewedit/new`, class: "btn btn-primary" },
                  req.__("Create view")
                )
              : p(
                  req.__(
                    "You must create at least one table before you can create views."
                  )
                ),
          ],
        },
      ],
    });
  })
);

/**
 * @param {object} o
 * @param {function} f
 * @returns {object}
 */
const mapObjectValues = (o, f) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

/**
 * @param {object} req
 * @param {object} tableOptions
 * @param {object[]} roles
 * @param {object[]} pages
 * @param {object} values
 * @returns {Form}
 */
const viewForm = async (req, tableOptions, roles, pages, values) => {
  const isEdit =
    values && values.id && !getState().getConfig("development_mode", false);
  const hasTable = Object.entries(getState().viewtemplates)
    .filter(([k, v]) => !v.tableless)
    .map(([k, v]) => k);
  const slugOptions = await Table.allSlugOptions();
  return new Form({
    action: addOnDoneRedirect("/viewedit/save", req),
    submitLabel: req.__("Configure") + " &raquo;",
    blurb: req.__("First, please give some basic information about the view."),
    tabs: { tabsStyle: "Accordion" },
    fields: [
      new Field({
        label: req.__("View name"),
        name: "name",
        type: "String",
        sublabel: req.__(
          "The view name will appear as the title of pop-ups showing this view, and in the URL when it is shown alone."
        ),
      }),
      new Field({
        label: req.__("Description"),
        name: "description",
        type: "String",
        sublabel: req.__(
          "Description allows you to give more information about the view."
        ),
      }),
      new Field({
        label: req.__("View pattern"),
        name: "viewtemplate",
        input_type: "select",
        sublabel: req.__(
          "The view pattern sets the foundation of how the view relates to the table and the behaviour of the view"
        ),
        options: Object.keys(getState().viewtemplates),
        attributes: {
          explainers: mapObjectValues(
            getState().viewtemplates,
            ({ description }) => description
          ),
        },
        disabled: isEdit,
      }),
      new Field({
        label: req.__("Table"),
        name: "table_name",
        input_type: "select",
        sublabel: req.__("Display data from this table"),
        options: tableOptions,
        disabled: isEdit,
        showIf: { viewtemplate: hasTable },
      }),
      new Field({
        name: "min_role",
        label: req.__("Minimum role"),
        sublabel: req.__("Role required to run view"),
        input_type: "select",
        required: true,
        options: roles.map((r) => ({ value: r.id, label: r.role })),
      }),
      new Field({
        name: "default_render_page",
        label: req.__("Show on page"),
        sublabel: req.__(
          "Requests to render this view directly will instead show the chosen page, if any. The chosen page should embed this view. Use this to decorate the view with additional elements."
        ),
        input_type: "select",
        tab: "View settings",
        options: [
          { value: "", label: "" },
          ...pages.map((p) => ({ value: p.name, label: p.name })),
        ],
      }),
      new Field({
        name: "slug",
        label: req.__("Slug"),
        sublabel: req.__("Field that can be used for a prettier URL structure"),
        type: "String",
        tab: "View settings",
        attributes: {
          calcOptions: [
            "table_name",
            mapObjectValues(slugOptions, (lvs) => lvs.map((lv) => lv.label)),
          ],
        },
        showIf: { viewtemplate: hasTable },
      }),
      new Field({
        name: "popup_title",
        label: req.__("Title"),
        type: "String",
        parent_field: "attributes",
        tab: "Popup settings",
      }),
      {
        name: "popup_width",
        label: req.__("Column width"),
        type: "Integer",
        tab: "Popup settings",
        parent_field: "attributes",
        attributes: { asideNext: true },
      },
      {
        name: "popup_width_units",
        label: req.__("Units"),
        type: "String",
        tab: "Popup settings",
        fieldview: "radio_group",
        parent_field: "attributes",
        attributes: {
          inline: true,
          options: ["px", "%", "vw", "em", "rem"],
        },
      },
      {
        name: "popup_save_indicator",
        label: req.__("Save indicator"),
        type: "Bool",
        parent_field: "attributes",
        tab: "Popup settings",
      },
      {
        name: "popup_link_out",
        label: req.__("Link out?"),
        sublabel: req.__("Show a link to open popup contents in new tab"),
        type: "Bool",
        parent_field: "attributes",
        tab: "Popup settings",
      },
      ...(isEdit
        ? [
            new Field({
              name: "viewtemplate",
              input_type: "hidden",
            }),
            new Field({
              name: "table_name",
              input_type: "hidden",
            }),
          ]
        : []),
    ],
    values,
  });
};

/**
 * @name get/edit/:viewname
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.get(
  "/edit/:viewname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { viewname } = req.params;

    const viewrow = await View.findOne({ name: viewname });
    if (!viewrow) {
      req.flash("error", `View not found: ${text(viewname)}`);
      res.redirect("/viewedit");
      return;
    }
    const tables = await Table.find_with_external();
    const currentTable = tables.find(
      (t) =>
        (t.id && t.id === viewrow.table_id) || t.name === viewrow.exttable_name
    );
    viewrow.table_name = currentTable && currentTable.name;
    if (viewrow.slug && currentTable) {
      const slugOptions = await currentTable.slug_options();
      const slug = slugOptions.find((so) => so.label === viewrow.slug.label);
      if (slug) viewrow.slug = slug.label;
    }
    const tableOptions = tables.map((t) => t.name);
    const roles = await User.get_roles();
    const pages = await Page.find();
    const form = await viewForm(req, tableOptions, roles, pages, viewrow);
    const inbound_connected = await viewrow.inbound_connected_objects();
    form.hidden("id");
    res.sendWrap(req.__(`Edit view`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Views"), href: "/viewedit" },
            { text: `${viewname}` },
          ],
        },
        {
          type: "card",
          class: "mt-0",
          title: req.__(
            `%s view - %s on %s`,
            viewname,
            viewrow.viewtemplate,
            viewrow.table_name
          ),
          contents: renderForm(form, req.csrfToken()),
        },
        {
          type: "card",
          title: req.__("View configuration"),
          contents: {
            type: "tabs",
            contents: [
              pre(code(JSON.stringify(viewrow.configuration, null, 2))),
            ],
            tabsStyle: "Accordion",
            startClosed: true,
            titles: [req.__("Show configuration object")],
          },
        },
        {
          type: "card",
          title: req.__("Connected views"),
          contents: tags.table(
            tbody(
              tr(
                th({ class: "me-2" }, req.__("Embedded in")),
                td(
                  inbound_connected.embeddedViews.map((v) => v.name).join(", ")
                )
              ),
              tr(
                th({ class: "me-2" }, req.__("Linked from")),
                td(inbound_connected.linkedViews.map((v) => v.name).join(", "))
              )
            )
          ),
        },
      ],
    });
  })
);

/**
 * @name get/new
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.get(
  "/new",
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find_with_external();
    const tableOptions = tables.map((t) => t.name);
    const roles = await User.get_roles();
    const pages = await Page.find();
    const form = await viewForm(req, tableOptions, roles, pages);
    if (req.query && req.query.table) {
      form.values.table_name = req.query.table;
    }
    res.sendWrap(req.__(`Create view`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Views"), href: "/viewedit" },
            { text: req.__("Create") },
          ],
        },
        {
          type: "card",
          class: "mt-0",
          title: req.__(`Create view`),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

/**
 * @name post/save
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/save",
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find_with_external();
    const tableOptions = tables.map((t) => t.name);
    const roles = await User.get_roles();
    const pages = await Page.find();
    const form = await viewForm(req, tableOptions, roles, pages);
    const result = form.validate(req.body);
    const sendForm = (form) => {
      res.sendWrap(req.__(`Edit view`), {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Views"), href: "/viewedit" },
              { text: req.__("Edit") },
            ],
          },
          {
            type: "card",
            class: "mt-0",
            title: req.__(`Edit view`),
            contents: renderForm(form, req.csrfToken()),
          },
        ],
      });
    };

    if (result.success) {
      if (result.success.name.replace(" ", "") === "") {
        form.errors.name = req.__("Name required");
        form.hasErrors = true;
        sendForm(form);
      } else {
        const existing_view = await View.findOne({ name: result.success.name });
        if (existing_view)
          if (+req.body.id !== existing_view.id) {
            // may be need !== but doesnt work
            form.errors.name = req.__("A view with this name already exists");
            form.hasErrors = true;
            sendForm(form);
            return;
          }

        const v = result.success;
        if (v.table_name) {
          const table = Table.findOne({ name: v.table_name });
          if (table && table.id) {
            v.table_id = table.id;
          } else if (table && table.external) v.exttable_name = v.table_name;
        }
        if (v.table_id) {
          const table = Table.findOne({ id: v.table_id });
          const slugOptions = await table.slug_options();
          const slug = slugOptions.find((so) => so.label === v.slug);
          v.slug = slug || null;
        }
        //const table = Table.findOne({ name: v.table_name });
        delete v.table_name;
        if (req.body.id) {
          await View.update(v, +req.body.id);
        } else {
          const vt = getState().viewtemplates[v.viewtemplate];
          if (vt.initial_config) v.configuration = await vt.initial_config(v);
          else v.configuration = {};
          //console.log(v);
          await View.create(v);
        }
        res.redirect(
          addOnDoneRedirect(
            `/viewedit/config/${encodeURIComponent(v.name)}`,
            req
          )
        );
      }
    } else {
      sendForm(form);
    }
  })
);

/**
 * @param {object} view
 * @param {Workflow} wf
 * @param {object} wfres
 * @param {object} req
 * @param {object} res
 * @returns {void}
 */
const respondWorkflow = (view, wf, wfres, req, res, table) => {
  const wrap = (contents, noCard, previewURL) => ({
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Views"), href: "/viewedit" },
          {
            href: `/view/${view.name}`,
            text: view.name,
            postLinkText: `[${view.viewtemplate}${
              table
                ? ` on ${a({ href: `/table/` + table.name }, table.name)}`
                : ""
            }]`,
          },
          { workflow: wf, step: wfres },
        ],
      },
      {
        type: noCard ? "container" : "card",
        class: !noCard && "mt-0",
        title: wfres.title,
        titleAjaxIndicator: true,
        contents,
      },
      ...(previewURL
        ? [
            {
              type: "card",
              title: req.__("Preview"),
              contents: div(
                div(pre({ id: "viewcfg-preview-error", class: "text-danger" })),
                div(
                  { id: "viewcfg-preview", "data-preview-url": previewURL },
                  script(domReady(`updateViewPreview()`))
                )
              ),
            },
          ]
        : []),
    ],
  });
  if (wfres.flash) req.flash(wfres.flash[0], wfres.flash[1]);
  if (wfres.renderForm)
    res.sendWrap(
      {
        title: req.__(`%s configuration`, view.name),
        headers: [
          {
            script: `/static_assets/${db.connectObj.version_tag}/jquery-menu-editor.min.js`,
          },
          {
            script: `/static_assets/${db.connectObj.version_tag}/iconset-fontawesome5-3-1.min.js`,
          },
          {
            script: `/static_assets/${db.connectObj.version_tag}/bootstrap-iconpicker.js`,
          },
          {
            css: `/static_assets/${db.connectObj.version_tag}/bootstrap-iconpicker.min.css`,
          },
        ],
      },
      wrap(
        renderForm(wfres.renderForm, req.csrfToken()),
        false,
        wfres.previewURL
      )
    );
  else if (wfres.renderBuilder) {
    wfres.renderBuilder.options.view_id = view.id;
    res.sendWrap(
      req.__(`%s configuration`, view.name),
      wrap(renderBuilder(wfres.renderBuilder, req.csrfToken()), true)
    );
  } else res.redirect(wfres.redirect);
};

/**
 * @name get/config/:name
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.get(
  "/config/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    req.socket.on("close", () => {
      File.destroyDirCache();
    });
    req.socket.on("timeout", () => {
      File.destroyDirCache();
    });
    const { name } = req.params;
    const { step } = req.query;
    const [view] = await View.find({ name });
    if (!view) {
      req.flash("error", `View not found: ${text(name)}`);
      res.redirect("/viewedit");
      return;
    }
    (view.configuration?.columns || []).forEach((c) => {
      c._columndef = JSON.stringify(c);
    });
    let table;
    if (view.table_id) table = Table.findOne({ id: view.table_id });
    if (view.exttable_name) table = Table.findOne({ name: view.exttable_name });
    const configFlow = await view.get_config_flow(req);
    const hasConfig =
      view.configuration && Object.keys(view.configuration).length > 0;
    const wfres = await configFlow.run(
      {
        ...view.configuration,
        id: hasConfig ? view.id : undefined,
        table_id: view.table_id,
        exttable_name: view.exttable_name,
        viewname: name,
        ...(step ? { stepName: step } : {}),
      },
      req
    );
    respondWorkflow(view, configFlow, wfres, req, res, table);
  })
);

/**
 * @name post/config/:name
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/config/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const view = await View.findOne({ name });
    const configFlow = await view.get_config_flow(req);
    const wfres = await configFlow.run(req.body, req);

    let table;
    if (view.table_id) table = Table.findOne({ id: view.table_id });
    if (view.exttable_name) table = Table.findOne({ name: view.exttable_name });
    respondWorkflow(view, configFlow, wfres, req, res, table);
  })
);

/**
 * @name post/add-to-menu/:id
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/add-to-menu/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const view = await View.findOne({ id });
    await add_to_menu({
      label: view.name,
      type: "View",
      min_role: view.min_role,
      viewname: view.name,
    });
    req.flash(
      "success",
      req.__(
        "View %s added to menu. Adjust access permissions in Settings &raquo; Menu",
        view.name
      )
    );
    let redirectTarget =
      req.query.on_done_redirect && is_relative_url(req.query.on_done_redirect)
        ? `/${req.query.on_done_redirect}`
        : "/viewedit";
    res.redirect(redirectTarget);
  })
);

/**
 * @name post/clone/:id
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/clone/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const view = await View.findOne({ id });
    const newview = await view.clone();
    req.flash(
      "success",
      req.__("View %s duplicated as %s", view.name, newview.name)
    );
    let redirectTarget =
      req.query.on_done_redirect && is_relative_url(req.query.on_done_redirect)
        ? `/${req.query.on_done_redirect}`
        : "/viewedit";
    res.redirect(redirectTarget);
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    await View.delete({ id });
    req.flash("success", req.__("View deleted"));
    let redirectTarget =
      req.query.on_done_redirect && is_relative_url(req.query.on_done_redirect)
        ? `/${req.query.on_done_redirect}`
        : "/viewedit";
    res.redirect(redirectTarget);
  })
);

/**
 * @name post/savebuilder/:id
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/savebuilder/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;

    if (id && req.body) {
      const exview = await View.findOne({ id });
      let newcfg = { ...exview.configuration, ...req.body };
      await View.update({ configuration: newcfg }, +id);
      res.json({ success: "ok" });
    } else {
      res.json({ error: "no view" });
    }
  })
);

/**
 * @name post/saveconfig/:id
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/saveconfig/:viewname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { viewname } = req.params;

    if (viewname && req.body) {
      const view = await View.findOne({ name: viewname });
      req.staticFieldViewConfig = true;
      const configFlow = await view.get_config_flow(req);
      const step = await configFlow.singleStepForm(req.body, req);
      if (step?.renderForm) {
        if (!step.renderForm.hasErrors) {
          let newcfg;
          if (step.contextField)
            newcfg = {
              ...view.configuration,
              [step.contextField]: {
                ...view.configuration?.[step.contextField],
                ...step.renderForm.values,
              },
            };
          else newcfg = { ...view.configuration, ...step.renderForm.values };
          await View.update({ configuration: newcfg }, view.id);
          res.json({ success: "ok" });
        } else {
          res.json({ error: step.renderForm.errorSummary });
        }
      } else {
        res.json({ error: "no form" });
      }
    } else {
      res.json({ error: "no view" });
    }
  })
);

/**
 * @name post/setrole/:id
 * @function
 * @memberof module:routes/viewedit~vieweditRouter
 * @function
 */
router.post(
  "/setrole/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const role = req.body.role;
    await View.update({ min_role: role }, +id);
    const view = await View.findOne({ id });
    const roles = await User.get_roles();
    const roleRow = roles.find((r) => r.id === +role);
    const message =
      roleRow && view
        ? req.__(`Minimum role for %s updated to %s`, view.name, roleRow.role)
        : req.__(`Minimum role updated`);
    if (!req.xhr) {
      req.flash("success", message);
      let redirectTarget =
        req.query.on_done_redirect &&
        is_relative_url(req.query.on_done_redirect)
          ? `/${req.query.on_done_redirect}`
          : "/viewedit";
      res.redirect(redirectTarget);
    } else res.json({ okay: true, responseText: message });
  })
);

router.post(
  "/test/inserter",
  isAdmin,
  error_catcher(async (req, res) => {
    const view = await View.create(req.body);
    res.json({ view });
  })
);
