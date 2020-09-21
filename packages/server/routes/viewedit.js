const Router = require("express-promise-router");

const {
  renderForm,
  mkTable,
  link,
  post_btn,
  post_delete_btn,
  renderBuilder,
} = require("@saltcorn/markup");
const { span, h5, h4, nbsp, p, a, div } = require("@saltcorn/markup/tags");

const { getState } = require("@saltcorn/data/db/state");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");

const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    var views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const getTable = (tid) => tables.find((t) => t.id === tid).name;
    const viewMarkup =
      views.length > 0
        ? mkTable(
            [
              { label: req.__("Name"), key: "name" },
              { label: req.__("Template"), key: "viewtemplate" },
              { label: req.__("Table"), key: (r) => getTable(r.table_id) },
              {
                label: req.__("Run"),
                key: (r) =>
                  link(`/view/${encodeURIComponent(r.name)}`, req.__("Run")),
              },
              {
                label: req.__("Edit"),
                key: (r) =>
                  link(
                    `/viewedit/edit/${encodeURIComponent(r.name)}`,
                    req.__("Edit")
                  ),
              },
              {
                label: req.__("Delete"),
                key: (r) =>
                  post_delete_btn(
                    `/viewedit/delete/${encodeURIComponent(r.id)}`,
                    req.csrfToken()
                  ),
              },
            ],
            views
          )
        : div(
            h4(req.__("No views defined")),
            p(req.__("Views define how table rows are displayed to the user"))
          );
    res.sendWrap(req.__(`Views`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Views") }],
        },
        {
          type: "card",
          title: req.__("Your views"),
          contents: [
            viewMarkup,
            tables.length > 0
              ? a(
                  { href: `/viewedit/new`, class: "btn btn-primary" },
                  req.__("Add view")
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

const viewForm = (req, tableOptions, roles, values) =>
  new Form({
    action: "/viewedit/save",
    submitLabel: req.__("Configure") + " &raquo;",
    blurb: req.__("First, please give some basic information about the view."),
    fields: [
      new Field({ label: req.__("View name"), name: "name", type: "String" }),
      new Field({
        label: req.__("Template"),
        name: "viewtemplate",
        input_type: "select",
        sublabel: req.__("Views are based on a view template"),
        options: Object.keys(getState().viewtemplates),
      }),
      new Field({
        label: req.__("Table"),
        name: "table_name",
        input_type: "select",
        sublabel: req.__("Display data from this table"),
        options: tableOptions,
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
        label: req.__("On root page"),
        name: "on_root_page",
        type: "Bool",
      }),
    ],
    values,
  });

router.get(
  "/edit/:viewname",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { viewname } = req.params;

    var viewrow = await View.findOne({ name: viewname });

    const tables = await Table.find();
    const currentTable = tables.find((t) => t.id === viewrow.table_id);
    viewrow.table_name = currentTable.name;
    const tableOptions = tables.map((t) => t.name);
    const roles = await User.get_roles();
    const form = viewForm(req, tableOptions, roles, viewrow);
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
          title: req.__(`Edit %s view`, viewname),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find();
    const tableOptions = tables.map((t) => t.name);
    const roles = await User.get_roles();
    const form = viewForm(req, tableOptions, roles);
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
          title: req.__(`Create view`),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

router.post(
  "/save",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find();
    const tableOptions = tables.map((t) => t.name);
    const roles = await User.get_roles();
    const form = viewForm(req, tableOptions, roles);
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
        if (!req.body.id) {
          const existing_views = await View.find();
          const view_names = existing_views.map((v) => v.name);
          if (view_names.includes(result.success.name)) {
            form.errors.name = req.__("A view with this name already exists");
            form.hasErrors = true;
            sendForm(form);
            return;
          }
        }

        var v = result.success;

        const table = await Table.findOne({ name: v.table_name });

        v.table_id = table.id;

        delete v.table_name;

        if (req.body.id) {
          await View.update(v, +req.body.id);
        } else {
          const vt = getState().viewtemplates[v.viewtemplate];
          if (vt.initial_config) v.configuration = await vt.initial_config(v);
          else v.configuration = {};
          await View.create(v);
        }
        res.redirect(`/viewedit/config/${encodeURIComponent(v.name)}`);
      }
    } else {
      sendForm(form);
    }
  })
);
const respondWorkflow = (view, wfres, req, res) => {
  const wrap = (contents, noCard) => ({
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Views"), href: "/viewedit" },
          { href: `/viewedit/edit/${view.name}`, text: view.name },
          { text: wfres.stepName },
        ],
      },
      {
        type: noCard ? "container" : "card",
        title: `${wfres.stepName} (step ${wfres.currentStep} / max ${wfres.maxSteps})`,
        contents,
      },
    ],
  });
  if (wfres.flash) req.flash(wfres.flash[0], wfres.flash[1]);
  if (wfres.renderForm)
    res.sendWrap(
      req.__(`View configuration`),
      wrap(renderForm(wfres.renderForm, req.csrfToken()))
    );
  else if (wfres.renderBuilder)
    res.sendWrap(
      req.__(`View configuration`),
      wrap(renderBuilder(wfres.renderBuilder, req.csrfToken()), true)
    );
  else res.redirect(wfres.redirect);
};
router.get(
  "/config/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const view = await View.findOne({ name });
    const configFlow = await view.get_config_flow();
    const wfres = await configFlow.run({
      table_id: view.table_id,
      viewname: name,
      ...view.configuration,
    });
    respondWorkflow(view, wfres, req, res);
  })
);

router.post(
  "/config/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const view = await View.findOne({ name });
    const configFlow = await view.get_config_flow();
    const wfres = await configFlow.run(req.body);
    respondWorkflow(view, wfres, req, res);
  })
);

router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    await View.delete({ id });
    req.flash("success", req.__("View deleted"));
    res.redirect(`/viewedit`);
  })
);
