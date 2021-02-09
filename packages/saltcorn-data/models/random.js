const View = require("./view");
const Field = require("./field");
const Table = require("./table");
const { getState } = require("../db/state");
const { generate_attributes } = require("../plugin-testing");
const { initial_config_all_fields } = require("../plugin-helper");
const { contract, is } = require("contractis");
const db = require("../db");

const random_table = async () => {
  const name = is
    .and(
      is.sat((s) => db.sqlsanitize(s).length > 2),
      is.str
    )
    .generate();
  const table = await Table.create(name);
  //fields
  const nfields = is.integer({ gte: 2, lte: 10 }).generate();
  const existing_field_names = ["id"];
  for (let index = 0; index < nfields; index++) {
    const field = await random_field(existing_field_names, table);
    existing_field_names.push(field.label);

    await Field.create(field);
  }
  //fill rows
  for (let index = 0; index < 20; index++) {
    await fill_table_row(table);
  }
  const fields = await table.getFields();
  const userFields = fields.filter((f) => f.reftable_name === "users");
  if (userFields.length > 0 && Math.random() > 0.5)
    await table.update({ ownership_field_id: userFields[0].id });

  return table;
};

const fill_table_row = async (table) => {
  const fields = await table.getFields();
  const row = {};
  for (const f of fields) {
    if (!f.calculated && (f.required || is.bool.generate()) && !f.primary_key)
      row[f.name] = await f.generate();
  }
  //console.log(fields, row);
  await table.tryInsertRow(row);
};
const random_expression = (type, existing_fields) => {
  const numField = existing_fields.find((f) =>
    ["Integer", "Float"].includes(f.type)
  );
  switch (type) {
    case "Bool":
      if (numField) return `${numField.name}>0`;
      else return is.one_of(["true", "false"]).generate();
    case "Float":
      if (numField) return `${numField.name}+1.5`;
      else return "1.3";
    case "Integer":
      if (numField) return `${numField.name}+3`;
      else return "7";
    default:
      throw new Error("random_expression: unknown type " + type);
  }
};
const random_field = async (existing_field_names, table) => {
  const tables = await Table.find({});
  const tables_with_data = [];
  for (const t of tables) {
    const n = await t.countRows();
    if (n > 0) tables_with_data.push(t);
  }
  const fkey_opts = [
    ...tables_with_data.map((t) => `Key to ${t.name}`),
    "Key to users",
    "File",
  ];
  const type_options = getState().type_names.concat(fkey_opts || []);
  const label = is
    .and(
      is.sat(
        (s) =>
          s.length > 2 && !existing_field_names.includes(Field.labelToName(s))
      ),
      is.str
    )
    .generate();

  const type = is.one_of(type_options).generate();

  if (Math.random() < 0.2 && ["Integer", "Float", "Bool"].includes(type)) {
    const stored = Math.random() < 0.5;
    const existing_fields = await Field.find(
      {
        table_id: table.id,
        calculated: false,
      },
      {
        orderBy: "RANDOM()",
      }
    );
    const expression = random_expression(type, existing_fields);
    const f = new Field({ type, label, calculated: true, stored, expression });
    f.table_id = table.id;
    return f;
  }

  const f = new Field({ type, label });
  f.table_id = table.id;
  if (f.type.attributes)
    f.attributes = generate_attributes(
      f.type.attributes,
      f.type.validate_attributes
    );
  if (f.is_fkey) {
    if (f.reftable_name === "users") {
      f.attributes.summary_field = "email";
    } else if (f.reftable_name === "_sc_files") {
      f.attributes.summary_field = "email";
    } else {
      const reftable = await Table.findOne({ name: f.reftable_name });
      const reffields = (await reftable.getFields()).filter(
        (f) => !f.calculated || f.stored
      );
      if (reffields.length > 0) {
        const reff = is.one_of(reffields).generate();
        f.attributes.summary_field = reff.name;
      } else {
        f.attributes.summary_field = "id";
      }
    }
  }
  // unique?
  if (Math.random() < 0.25 && type !== "Bool") f.is_unique = true;
  // required?
  if (is.bool.generate()) f.required = true;
  return f;
};

const initial_view = async (table, viewtemplate) => {
  const configuration = await initial_config_all_fields(
    viewtemplate === "Edit"
  )({ table_id: table.id });
  //console.log(configuration);
  const name = is.str.generate();
  const view = await View.create({
    name,
    configuration,
    viewtemplate,
    table_id: table.id,
    min_role: 10,
  });
  return view;
};

const all_views = async (table) => {
  const list = await initial_view(table, "List");
  const edit = await initial_view(table, "Edit");
  const show = await initial_view(table, "Show");
  return { list, show, edit };
};

module.exports = { random_table, fill_table_row, initial_view, all_views };
