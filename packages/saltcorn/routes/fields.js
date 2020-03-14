const Router = require("express-promise-router");

const db = require("../db");
const types = require("../types");
const { renderForm } = require("../markup");
const Field = require("../models/field");
const Form = require("../models/form");

const { sqlsanitize, fkeyPrefix, isAdmin } = require("./utils.js");

const router = new Router();
module.exports = router;

const fieldForm = fkey_opts =>
  new Form({
    action: "/field",
    fields: [
      new Field({
        name: "table_id",
        input_type: "hidden",
        type: types.Integer
      }),
      new Field({ label: "Name", name: "fname", input_type: "text" }),
      new Field({ label: "Label", name: "flabel", input_type: "text" }),
      new Field({
        label: "Type",
        name: "ftype",
        input_type: "select",
        options: types._type_names.concat(fkey_opts || [])
      }),
      new Field({
        label: "Required",
        name: "required",
        type: types["Bool"]
      })
    ]
  });

const attributesForm = (v, attributes) => {
  const ff = fieldForm();
  const a2ff = attr =>
    new Field({
      label: attr.label || attr.name,
      name: attr.name,
      options: attr.options,
      input_type: attr.input_type || "fromtype",
      type: typeof attr.type === "string" ? types[attr.type] : attr.type
    });
  const attr_fields = attributes.map(a2ff);
  const hidden_fields = ff.fields.map(f => {
    f.hidden = true;
    f.input_type = "hidden";
    return f;
  });
  var hasattr = [new Field({ name: "has_attributes", input_type: "hidden" })];
  if (v.id) hasattr.push(new Field({ name: "id", input_type: "hidden" }));
  return new Form({
    action: "/field",
    fields: attr_fields.concat(hidden_fields, hasattr),
    values: { has_attributes: "true", ...v }
  });
};

router.get("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const field = await db.get_field_by_id(id);
  const tables = await db.get_tables();
  const fkey_opts = tables.map(t => fkeyPrefix + t.name);
  const form = fieldForm(fkey_opts);
  form.values = field;
  form.hidden("id");

  res.sendWrap(`Edit field`, renderForm(form));
});

router.get("/new/:table_id", isAdmin, async (req, res) => {
  const { table_id } = req.params;
  const tables = await db.get_tables();
  const fkey_opts = tables.map(t => fkeyPrefix + t.name);
  const form = fieldForm(fkey_opts);
  form.values = { table_id };

  res.sendWrap(`New field`, renderForm(form));
});

router.post("/delete/:id", isAdmin, async (req, res) => {
  const { id } = req.params;

  const {
    rows
  } = await db.query("delete FROM fields WHERE id = $1 returning *", [id]);

  const table = await db.get_table_by_id(rows[0].table_id);
  await db.query(
    `alter table ${sqlsanitize(table.name)} drop column ${sqlsanitize(
      rows[0].fname
    )}`
  );

  res.redirect(`/table/${rows[0].table_id}`);
});

router.post("/", isAdmin, async (req, res) => {
  const v = req.body;
  const fld = new Field(v);
  const type = types[v.ftype];
  var attributes = [];
  var need_default = false;
  if (v.required) {
    const table = await db.get_table_by_id(v.table_id);
    const rows = await db.select(table.name);
    if (rows.length > 0) need_default = true;
  }
  if (fld.is_fkey) {
    const fields = await Field.get_by_table_id(v.table_id);
    const keyfields = fields.map(f => ({ value: f.name, label: f.label }));
    attributes = [
      {
        name: "summary_field",
        label: "Summary field",
        input_type: "select",
        options: keyfields
      }
    ];
    // todo: default
  } else {
    attributes = type.attributes;
    if (need_default)
      attributes.push({
        name: "default",
        label: "Default",
        type: type
      });
  }
  if (attributes && typeof v.has_attributes === "undefined") {
    const attrForm = attributesForm(v, attributes);
    res.sendWrap(`New field`, renderForm(attrForm));
  } else {
    //console.log("v", v);
    const form = fieldForm();
    form.values = v;
    var attrs = {};
    if (attributes) {
      attributes.forEach(a => {
        //console.log("attrib", a);
        const t = typeof a.type === "string" ? types[a.type] : a.type;
        const aval = t ? t.read(v[a.name]) : v[a.name];
        if (typeof aval !== "undefined") attrs[a.name] = aval;
      });
    }
    if (v.id) form.hidden("id");
    const vres = form.validate(v).success; // TODO what if it fails
    if (typeof v.id === "undefined") {
      await Field.create({ attributes: attrs, ...vres });
    } else {
      // update
      //TODO edit db field
      const { table_id, fname, flabel, ftype, required } = vres;
      //console.log("update v", vres);
      await db.update(
        "fields",
        { table_id, fname, flabel, ftype, required, attributes: attrs },
        v.id
      );
    }
    res.redirect(`/table/${v.table_id}`);
  }
});
