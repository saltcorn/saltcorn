/**
 * @category server
 * @module routes/models
 * @subcategory routes
 */

const Router = require("express-promise-router");

const { error_catcher, is_relative_url, isAdmin } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Model = require("@saltcorn/data/models/model");
const ModelInstance = require("@saltcorn/data/models/model_instance");
const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const moment = require("moment");

const { mkTable, renderForm } = require("@saltcorn/markup");
const {
  span,
  h4,
  p,
  a,
  div,
  i,
  form,
  label,
  input,
  text,
  script,
  domReady,
  code,
} = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

const newModelForm = (table, req) => {
  return new Form({
    action: "/models/new/" + table.id,
    fields: [
      { name: "name", label: "Name", type: "String", required: true },
      {
        name: "modeltemplate",
        label: "Model template",
        type: "String",
        required: true,
        attributes: { options: Object.keys(getState().modeltemplates) },
      },
    ],
  });
};

router.get(
  "/new/:table_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { table_id } = req.params;
    const table = await Table.findOne({ id: table_id });
    res.sendWrap(req.__(`New field`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: req.__(`New model`) },
          ],
        },
        {
          type: "card",
          class: "mt-0",
          title: req.__(`New model`),
          contents: renderForm(newModelForm(table, req), req.csrfToken()),
        },
      ],
    });
  })
);

router.post(
  "/new/:table_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { table_id } = req.params;
    const table = await Table.findOne({ id: table_id });
    const form = newModelForm(table, req);
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(req.__(`New model`), renderForm(form, req.csrfToken()));
    } else {
      const model = await Model.create({ ...form.values, table_id: table.id });
      if (model.templateObj.configuration_workflow)
        res.redirect(`/models/config/${model.id}`);
      else res.redirect(`/models/show/${model.id}`);
    }
  })
);

const respondWorkflow = (model, table, wf, wfres, req, res) => {
  const wrap = (contents, noCard, previewURL) => ({
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Tables"), href: "/table" },
          { href: `/table/${table.id || table.name}`, text: table.name },
          { href: `/models/show/${model.id}`, text: model.name },
          { text: req.__("Configuration") },
        ],
      },
      {
        type: noCard ? "container" : "card",
        class: !noCard && "mt-0",
        title: wfres.title,
        titleAjaxIndicator: true,
        contents,
      },
    ],
  });
  if (wfres.flash) req.flash(wfres.flash[0], wfres.flash[1]);
  if (wfres.renderForm)
    res.sendWrap(
      {
        title: req.__(`%s configuration`, model.name),
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
  else res.redirect(wfres.redirect);
};

const get_model_workflow = (model, req) => {
  const workflow = model.templateObj.configuration_workflow(req);
  workflow.action = `/models/config/${model.id}`;
  const oldOnDone = workflow.onDone || ((c) => c);
  workflow.onDone = async (ctx) => {
    const { id, ...configuration } = await oldOnDone(ctx);
    await model.update({ configuration });

    return {
      redirect: `/models/show/${model.id}`,
      flash: ["success", `Model ${this.name || ""} saved`],
    };
  };
  return workflow;
};

router.get(
  "/config/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const { step } = req.query;

    const model = await Model.findOne({ id });
    const table = await Table.findOne({ id: model.table_id });
    const configFlow = get_model_workflow(model, req);
    const wfres = await configFlow.run(
      {
        ...model.configuration,
        id: model.id,
        table_id: model.table_id,
        ...(step ? { stepName: step } : {}),
      },
      req
    );
    respondWorkflow(model, table, configFlow, wfres, req, res);
  })
);

router.post(
  "/config/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const { step } = req.query;

    const model = await Model.findOne({ id });
    const table = await Table.findOne({ id: model.table_id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    const workflow = get_model_workflow(model, req);
    const wfres = await workflow.run(req.body, req);
    respondWorkflow(model, table, workflow, wfres, req, res);
  })
);

router.get(
  "/show/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const model = await Model.findOne({ id });
    const table = await Table.findOne({ id: model.table_id });
    const instances = await ModelInstance.find({ model_id: model.id });
    const metrics = model.templateObj.metrics;
    const metricCols = Object.entries(metrics).map(([k, v]) => ({
      label: k,
      key: (inst) => inst.metric_values?.[k]?.toPrecision(6),
    }));
    res.sendWrap(req.__(`New field`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: model.name },
          ],
          after: a(
            { href: `/models/config/${model.id}` },
            req.__("Edit"),
            i({ class: "ms-1 fas fa-edit" })
          ),
        },
        {
          type: "card",
          class: "mt-0",
          title: req.__("Model instances"),
          contents: div(
            mkTable(
              [
                { label: req.__("Name"), key: "name" },
                {
                  label: req.__("Trained"),
                  key: (inst) => moment(inst.trained_on).fromNow(),
                },
                ...metricCols,
                {
                  label: req.__("Default"),
                  key: (inst) =>
                    form(
                      {
                        action: `/models/make-default-instance/${inst.id}`,
                        method: "POST",
                      },
                      span(
                        { class: "form-switch" },
                        input({
                          class: ["form-check-input"],
                          type: "checkbox",
                          onChange: "this.form.submit()",
                          role: "switch",
                          name: "enabled",
                          ...(inst.is_default && { checked: true }),
                        })
                      ),
                      input({
                        type: "hidden",
                        name: "_csrf",
                        value: req.csrfToken(),
                      })
                    ),
                },
              ],
              instances
            ),
            a(
              { href: `/models/train/${model.id}`, class: "btn btn-primary" },
              i({ class: "fas fa-graduation-cap me-1" }),
              req.__("Train new instance")
            )
          ),
        },
      ],
    });
  })
);
const model_train_form = (model, table, req) => {
  const hyperparameter_fields =
    model.templateObj.hyperparameter_fields?.({
      table,
      ...model,
    }) || [];
  return new Form({
    action: `/models/train/${model.id}`,
    fields: [
      {
        name: "name",
        label: req.__("Name"),
        type: "String",
        required: true,
      },
      ...hyperparameter_fields,
    ],
  });
};
router.get(
  "/train/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const model = await Model.findOne({ id });
    const table = await Table.findOne({ id: model.table_id });
    const form = model_train_form(model, table, req);
    res.sendWrap(req.__(`Train model`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { href: `/models/show/${model.id}`, text: model.name },
            { text: req.__(`Train`) },
          ],
        },
        {
          type: "card",
          class: "mt-0",
          title: req.__(`New model`),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);
router.post(
  "/train/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const model = await Model.findOne({ id });
    const table = Table.findOne({ id: model.table_id });
    const form = model_train_form(model, table, req);
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(req.__(`Train model`), renderForm(form, req.csrfToken()));
    } else {
      const { name, ...hyperparameters } = form.values;

      await model.train_instance(name, hyperparameters, {});
      req.flash("success", "Model trained?");
      res.redirect(`/models/show/${model.id}`);
    }
  })
);

router.post(
  "/make-default-instance/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const model_instance = await ModelInstance.findOne({ id });
    await model_instance.make_default(!req.body.enabled);
    res.redirect(`/models/show/${model_instance.model_id}`);
  })
);
