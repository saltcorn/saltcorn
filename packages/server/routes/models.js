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

const { renderForm } = require("@saltcorn/markup");

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

router.get(
  "/config/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const { step } = req.query;

    const model = await Model.findOne({ id });
    const table = await Table.findOne({ id: model.table_id });
    const configFlow = model.templateObj.configuration_workflow(req);
    console.log({ configFlow });
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
