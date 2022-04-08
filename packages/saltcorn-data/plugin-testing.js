/**
 * @category saltcorn-data
 * @module plugin-testing
 */
const { contract, is, auto_test } = require("contractis");
const { is_plugin_wrap, is_plugin } = require("./contracts");
const { getState } = require("./db/state");
const { renderForm } = require("@saltcorn/markup");
const { mockReqRes } = require("./tests/mocks");
const Field = require("./models/field");
const Table = require("./models/table");
const Trigger = require("./models/trigger");
const { expressionValidator } = require("./models/expression");

const auto_test_wrap = (wrap) => {
  auto_test(contract(is_plugin_wrap, wrap, { n: 5 }));
};

const generate_attributes = (typeattrs, validate, table_id) => {
  var res = {};
  const attrs = Field.getTypeAttributes(typeattrs, table_id);
  (attrs || []).forEach((a) => {
    if (a.type && (a.required || is.bool.generate())) {
      const contract = a.type.contract || getState().types[a.type].contract;
      const gen = contract({}).generate;
      if (gen) res[a.name] = gen();
    }
  });
  if (validate && !validate(res))
    return generate_attributes(attrs, validate, table_id);
  else return res;
};

const auto_test_type = (t) => {
  const fvs = t.fieldviews || {};

  //run edit field views without a value
  Object.values(fvs).forEach((fv) => {
    if (fv.isEdit) {
      const attr = generate_attributes(t.attributes, t.validate_attributes);
      is.str(fv.run("foo", undefined, attr, "myclass", true, { name: "foo" }));
      is.str(fv.run("foo", undefined, attr, "myclass", false, { name: "foo" }));
    }
  });
  //find examples, run all fieldview on each example

  const has_contract = t.contract && t.contract.generate;
  const numex = has_contract ? 20 : 200;
  for (let index = 0; index < numex; index++) {
    const x = has_contract ? t.contract.generate() : t.read(is.any.generate());

    const attribs = generate_attributes(t.attributes, t.validate_attributes);
    if (has_contract || (typeof x !== "undefined" && x !== null))
      if ((t.validate && t.validate(attribs)(x)) || !t.validate) {
        Object.values(fvs).forEach((fv) => {
          if (fv.isEdit) {
            is.str(fv.run("foo", x, attribs, "myclass", true, { name: "foo" }));
            is.str(
              fv.run("foo", x, attribs, "myclass", false, { name: "foo" })
            );
          } else {
            is.str(fv.run(x));
          }
        });
        if (t.readFromFormRecord) t.readFromFormRecord({ akey: x }, "akey");
      }
  }
  if (t.readFromFormRecord) {
    t.readFromFormRecord({}, "akey");
  }
  //todo: try creating a table with this type
};
const auto_test_workflow = async (wf, initialCtx) => {
  const step = async (wf, ctx) => {
    is.obj(ctx);
    const res = await wf.run(ctx);

    if (res.renderForm) {
      is.str(renderForm(res.renderForm, ""));

      const vs = await res.renderForm.generate();
      return await step(wf, vs);
    } else return res;
  };
  return await step(wf, initialCtx);
};

const auto_test_viewtemplate = async (vt) => {
  if (vt.noAutoTest) return;
  const wf = vt.configuration_workflow({ __: (s) => s });
  is.class("Workflow")(wf);
  for (let index = 0; index < 10; index++) {
    var cfg;
    if (vt.initial_config && Math.round() > 0.5)
      cfg = await vt.initial_config({ table_id: 2 });
    else
      cfg = await auto_test_workflow(wf, {
        table_id: 2,
        viewname: "newview",
      });
    const sfs = vt.get_state_fields
      ? await vt.get_state_fields(1, "newview", cfg)
      : [];
    const res = await vt.run(2, "newview", cfg, {}, mockReqRes);
    is.or(is.str, is.array(is.str))(res);
    if (sfs.some((sf) => sf.name === "id")) {
      const resid = await vt.run(2, "newview", cfg, { id: 1 }, mockReqRes);
      is.or(is.str, is.array(is.str))(resid);
    }
  }
};

const auto_test_plugin = async (plugin) => {
  is_plugin(plugin);
  getState().registerPlugin("test_plugin", plugin);
  if (plugin.layout) {
    auto_test_wrap(plugin.layout.wrap);
  }
  if (plugin.types) {
    plugin.types.forEach(auto_test_type);
  }
  for (const vt of plugin.viewtemplates || []) await auto_test_viewtemplate(vt);

  //is each header reachable
};

const check_view_columns = async (view, columns) => {
  const errs = [];
  const table = Table.findOne(
    view.table_id
      ? { id: view.table_id }
      : view.exttable_name
      ? { name: view.exttable_name }
      : { id: -1 }
  );
  let fields;
  if (table) fields = await table.getFields();
  const check_formula = (s, loc) => {
    const v = expressionValidator(s, loc);
    if (v === true) return;
    if (typeof v === "string") errs.push(`In view ${view.name}, ${loc} ${v}`);
  };
  const trigger_actions = (
    await Trigger.find({
      when_trigger: { or: ["API call", "Never"] },
    })
  ).map((tr) => tr.name);
  for (const column of columns) {
    switch (column.type) {
      // in general, if formula checked, make sure it is present
      case "Field":
        //field exists
        if (
          table?.name === "users" &&
          ["remember", "passwordRepeat", "password"].includes(column.field_name)
        )
          break;
        const f = fields.find((fld) => fld.name === column.field_name);
        if (!f) {
          errs.push(
            `In view ${view.name}, field ${column.field_name} does not exist in table ${table?.name}`
          );
          break;
        }
        if (
          column.fieldview &&
          !f.is_fkey &&
          !f.type.fieldviews[column.fieldview]
        )
          errs.push(
            `In view ${view.name}, field ${column.field_name} of type ${f.type.name} table ${table?.name} does not have fieldview ${column.fieldview}`
          );
        break;
      case "Action":
        if (column.action_label_formula)
          check_formula(
            column.action_label,
            `Label for action ${column.action_name}`
          );
        if (
          column.action_name.startsWith("Toggle ") ||
          column.action_name.startsWith("Login with ") ||
          [
            "GoBack",
            "Delete",
            "Save",
            "Reset",
            "SaveAndContinue",
            "Login",
            "Sign up",
          ].includes(column.action_name)
        )
          break;
        if (
          !getState().actions[column.action_name] &&
          !trigger_actions.includes(column.action_name)
        )
          errs.push(
            `In view ${view.name}, action ${column.action_name} does not exist`
          );
      case "ViewLink":
        if (column.view_label_formula)
          check_formula(column.view_label, `Label for view link`);
        if (column.extra_state_fml)
          check_formula(
            column.extra_state_fml,
            `View link extra state formula`
          );
        break;

      case "View":
        break;
      case "JoinField":
        break;
      case "Link":
        if (column.link_text_formula)
          check_formula(column.link_text, `Link text`);
        if (column.link_url_formula) check_formula(column.link_url, `Link URL`);
        break;
      case "Aggregation":
        break;
      default:
        break;
    }
  }
  return errs;
};

module.exports = { auto_test_plugin, generate_attributes, check_view_columns };
