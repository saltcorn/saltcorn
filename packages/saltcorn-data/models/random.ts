/**
 * View Database Access Layer
 * @category saltcorn-data
 * @module models/random
 * @subcategory models
 */
import View from "./view";
import Field from "./field";
import Table from "./table";
const { getState } = require("../db/state");
const { generate_attributes } = require("../plugin-testing");
const { initial_config_all_fields } = require("../plugin-helper");
import db from "../db";
import { GenObj } from "@saltcorn/types/common_types";
import { Row } from "@saltcorn/db-common/internal";
import { instanceOfType } from "@saltcorn/types/common_types";
import {
  generateString,
  oneOf,
  generateBool,
  num_between,
} from "@saltcorn/types/generators";

/**
 * @param {object} [opts = {}]
 * @returns {Promise<Table>}
 */
const random_table = async (opts: GenObj = {}): Promise<Table> => {
  const name = generateString(3);
  const table = await Table.create(name);
  // test UUID type
  if (Math.random() < 0.3 && !opts.force_int_pk && !db.isSQLite) {
    const [pk] = await table.getFields();
    await pk.update({ type: "UUID" });
    table.fields = null;
  }
  //fields
  const nfields = num_between(3, 10);
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

/**
 * Fill table row by random data
 * @param {Table} table
 * @returns {Promise<*>}
 */
const fill_table_row = async (table: Table): Promise<void> => {
  const fields = await table.getFields();
  const row: Row = {};
  for (const f of fields) {
    if (!f.calculated && (f.required || generateBool()) && !f.primary_key)
      row[f.name] = await f.generate();
  }
  //console.log(fields, row);
  await table.tryInsertRow(row);
};

/**
 * returns Random Expression
 * @param {string} type
 * @param {string[]} existing_fields
 * @throws {Error}
 * @returns {string}
 */
const random_expression = (
  type: string,
  existing_fields: Array<Field>
): string => {
  const numField = existing_fields.find(
    (f) => typeof f.type === "string" && ["Integer", "Float"].includes(f.type)
  );
  switch (type) {
    case "Bool":
      if (numField) return `${numField.name}>0`;
      else return oneOf(["true", "false"]);
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

/**
 * Random Field
 * @param {string[]} existing_field_names
 * @param {Table} table
 * @returns {Promise<Field>}
 */
const random_field = async (
  existing_field_names: string[],
  table: Table
): Promise<Field> => {
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
  const label = generateString(3, existing_field_names);
  const type = oneOf(type_options);
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
  if (instanceOfType(f.type) && f.type.attributes)
    f.attributes = generate_attributes(
      f.type.attributes,
      f.type.validate_attributes,
      table.id
    );
  if (f.is_fkey) {
    if (f.reftable_name === "users") {
      f.attributes.summary_field = "email";
    } else if (f.reftable_name === "_sc_files") {
      f.attributes.summary_field = "email";
    } else {
      const reftable = await Table.findOne({ name: f.reftable_name });
      if (!reftable)
        throw new Error(`The table '${f.reftable_name} does not exist'`);
      const reffields = (await reftable.getFields()).filter(
        (f) => !f.calculated || f.stored
      );
      if (reffields.length > 0) {
        const reff = oneOf(reffields);
        f.attributes.summary_field = reff.name;
      } else {
        f.attributes.summary_field = "id";
      }
    }
  }
  // unique?
  if (Math.random() < 0.25 && type !== "Bool") f.is_unique = true;
  // required?
  if (generateBool()) f.required = true;
  return f;
};

/**
 * Create View
 * @param {Table} table
 * @param {string} viewtemplate
 * @returns {Promise<View>}
 */
const initial_view = async (
  table: Table,
  viewtemplate: string
): Promise<View> => {
  const configuration = await initial_config_all_fields(
    viewtemplate === "Edit"
  )({ table_id: table.id });
  //console.log(configuration);
  const name = generateString();
  const view = await View.create({
    name,
    configuration,
    viewtemplate,
    table_id: table.id,
    min_role: 10,
  });
  return view;
};

/**
 * Create all views
 * @param {Table} table
 * @returns {Promise<object[]>}
 */
const all_views = async (
  table: Table
): Promise<{ list: View; show: View; edit: View }> => {
  const list = await initial_view(table, "List");
  const edit = await initial_view(table, "Edit");
  const show = await initial_view(table, "Show");
  return { list, show, edit };
};

export = { random_table, fill_table_row, initial_view, all_views };
