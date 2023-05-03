/**
 * @category server
 * @module routes/models
 * @subcategory routes
 */

const Router = require("express-promise-router");

const { error_catcher, is_relative_url } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Model = require("@saltcorn/data/models/model");
const ModelInstance = require("@saltcorn/data/models/model_instance");
const { getState } = require("@saltcorn/data/db/state");

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
  error_catcher(async (req, res) => {
    const { table_id } = req.params;
    const table = await Table.findOne({ id: table_id });
    const form = newModelForm(table, req);
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(req.__(`New model`), renderForm(form, req.csrfToken()));
    } else {
      const model = await Model.create({ ...form.values, table_id: table.id });
      res.redirect(`/models/show/${model.id}`);
    }
  })
);
