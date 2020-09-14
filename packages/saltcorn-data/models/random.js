const View = require("./view");
const Field = require("./field");
const Table = require("./table");
const { getState } = require("../db/state");
const { generate_attributes } = require("../plugin-testing");
const { contract, is } = require("contractis");
const db = require("../db");

const random_table = async () => {
  const name = is
    .and(
      is.sat((s) => db.sqlsanitize(s).length > 1),
      is.str
    )
    .generate();
  const table = await Table.create(name);
  //fields
  const nfields = is.integer({ gte: 1, lte: 10 }).generate();
  const existing_field_names = ["id"];
  for (let index = 0; index < nfields; index++) {
    const field = await random_field(existing_field_names);
    existing_field_names.push(field.label);
    field.table_id = table.id;
    await Field.create(field);
  }
  //fill rows
  const fields = await table.getFields();
  for (let index = 0; index < 20; index++) {
    const row = {};
    for (const f of fields) {
      if (f.required || is.bool.generate()) row[f.name] = await f.generate();
    }
    //console.log(fields, row);
    await table.tryInsertRow(row);
  }
  return table;
};

const random_field = async (existing_field_names) => {
  const tables = await Table.find({});
  const fkey_opts = [
    ...tables.map((t) => `Key to ${t.name}`),
    "Key to users",
    "File",
  ];
  const type_options = getState().type_names.concat(fkey_opts || []);
  const type = is.one_of(type_options).generate();

  const label = is
    .and(
      is.sat(
        (s) =>
          s.length > 1 && !existing_field_names.includes(Field.labelToName(s))
      ),
      is.str
    )
    .generate();
  const f = new Field({ type, label });
  if (f.type.attributes) f.attributes = generate_attributes(f.type.attributes);

  // unique?
  if (Math.random() < 0.25 && type !== "Bool") f.is_unique = true;
  // required?
  if (is.bool.generate()) f.required = true;
  return f;
};

module.exports = { random_table };
