import Table from "../models/table";
import Field from "../models/field";
import db from "../db";
const { getState } = require("../db/state");

import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import mocks from "./mocks";
const { sleep } = mocks;

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("Field", () => {
  it("should add and then delete required field", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const fc = await Field.create({
      table: patients,
      label: "Height1",
      type: "Integer",
      required: true,
      attributes: { default: 6 },
    });
    assertIsSet(fc.id);
    expect(fc.id > 0).toBe(true);
    const f = await Field.findOne({ id: fc.id });
    expect(f.name).toBe("height1");
    expect(f.toJson.name).toBe("height1");
    expect(f.listKey).toBe("height1");
    expect(f.presets).toBe(null);
    await f.delete();
    const fs = await Field.find({ name: "height1" });
    expect(fs.length).toBe(0);
  });
  it("should add and then delete nonrequired field", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const fc = await Field.create({
      table: patients,
      name: "Height11",
      label: "height11",
      type: "Integer",
      required: false,
    });
    assertIsSet(fc.id);
    expect(fc.id > 0).toBe(true);
    const f = await Field.findOne({ id: fc.id });

    await f.delete();
    const fs = await Field.find({ name: "Height11" });
    expect(fs.length).toBe(0);
  });
  it("creates file field", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const fc = await Field.create({
      table: patients,
      name: "pic",
      label: "pic",
      type: "File",
      required: false,
    });
    expect(fc.sql_type).toBe("text");
  });
  it("fills fkey options", async () => {
    const f = await Field.findOne({ name: "favbook" });
    await f.fill_fkey_options();
    expect(f.options).toContainEqual({ label: "Leo Tolstoy", value: 2 });
    if (db.isSQLite)
      expect(f.sql_type).toBe(
        'int constraint "patients_favbook_fkey" references "books" ("id")'
      );
    else
      expect(f.sql_type).toBe(
        'int constraint "patients_favbook_fkey" references "public"."books" ("id")'
      );

    expect(f.is_fkey).toBe(true);
    expect(f.sql_bare_type).toBe("int");
  });
  it("switches delete cascade on and off", async () => {
    const f = await Field.findOne({ name: "favbook" });
    const {
      table_id,
      name,
      label,
      required,
      is_unique,
      calculated,
      expression,
      stored,
      description,
      reftable_name,
      attributes,
    } = f;
    const fldRow = {
      table_id,
      name,
      label,
      required,
      is_unique,
      reftable_name,
      attributes,
      calculated,
      expression,
      stored,
      description,
    };
    if (db.isSQLite) return;
    await f.update({
      ...fldRow,
      attributes: { ...f.attributes, on_delete_cascade: true },
    });
    await f.update({
      ...fldRow,
      attributes: { ...f.attributes, on_delete_cascade: false },
    });
    await f.update({
      ...fldRow,
      attributes: { ...f.attributes, on_delete: "Set null" },
    });
    await f.update({
      ...fldRow,
      attributes: { ...f.attributes, on_delete: "Cascade" },
    });
    await f.update({
      ...fldRow,
      attributes: { ...f.attributes, on_delete: "Fail" },
    });
  });

  it("generates fkeys", async () => {
    const f = await Field.findOne({ name: "favbook" });
    const v = await f.generate();
    expect(typeof v).toBe("number");
  });
});

describe("validate field", () => {
  const field = new Field({
    name: "age",
    label: "Age",
    type: "Integer",
  });
  expect(field.form_name).toBe("age");

  const res = field.validate({ age: 17 });
  expect(res).toStrictEqual({ success: 17 });
});
describe("generate ", () => {
  it("color is string", async () => {
    const field = new Field({
      name: "col",
      label: "col",
      type: "Color",
    });
    const rnd = await field.generate();
    expect(typeof rnd).toBe("string");
  });
  it("int not nan", async () => {
    const field = new Field({
      name: "x",
      label: "x",
      type: "Integer",
      attributes: { max: 5 },
    });
    const rnd = await field.generate();
    expect(typeof rnd).toBe("number");
    expect(isNaN(rnd)).toBe(false);
  });
});
describe("validate fkey field", () => {
  const field = new Field({
    name: "age",
    label: "Age",
    type: "Key to Foos",
  });
  expect(field.form_name).toBe("age");

  const res = field.validate({ age: 17 });
  expect(res).toStrictEqual({ success: 17 });
});

describe("validate bool field", () => {
  const field = new Field({
    name: "over_age",
    label: "Over age",
    type: "Bool",
  });
  expect(field.form_name).toBe("over_age");

  const res = field.validate({ over_age: "on" });
  expect(res).toStrictEqual({ success: true });
  const res1 = field.validate({});
  expect(res1).toStrictEqual({ success: false });
});
describe("validate required field", () => {
  it("validates required field", async () => {
    const field = new Field({
      name: "age",
      label: "Age",
      type: "Integer",
      required: true,
    });
    expect(field.form_name).toBe("age");

    const res = field.validate({ age: 17 });
    expect(res).toStrictEqual({ success: 17 });
  });
  it("fails on required field", async () => {
    const field = new Field({
      name: "age",
      label: "Age",
      type: "Integer",
      required: true,
    });
    expect(field.form_name).toBe("age");

    const res = field.validate({ name: "Sam" });
    expect(res).toStrictEqual({ error: "Unable to read Integer" });
  });
  it("validates required field if not shown", async () => {
    const field = new Field({
      name: "age",
      label: "Age",
      type: "Integer",
      showIf: { foo: "bar" },
      required: true,
    });
    expect(field.form_name).toBe("age");

    const res = field.validate({ name: "Sam" });
    expect(res).toStrictEqual({ success: null });
  });
});
describe("validate parent field", () => {
  const field = new Field({
    name: "age",
    label: "Age",
    parent_field: "person",
    type: "Integer",
  });
  expect(field.form_name).toBe("person_age");

  const res = field.validate({ person_age: 17 });
  expect(res).toStrictEqual({ success: 17 });
});

describe("validate parent field", () => {
  const field = new Field({
    name: "over_age",
    label: "Over age",
    type: "Bool",
    parent_field: "person",
  });
  expect(field.form_name).toBe("person_over_age");

  const res = field.validate({ person_over_age: "on" });
  expect(res).toStrictEqual({ success: true });
  const res1 = field.validate({});
  expect(res1).toStrictEqual({ success: false });
});

describe("validator", () => {
  const field = new Field({
    label: "Age",
    type: "Integer",
    validator: (x) => false,
  });
  const res = field.validate({ age: 17 });
  expect(res).toStrictEqual({ error: "Not accepted" });
});

describe("user presets", () => {
  const field = new Field({
    label: "User",
    type: "Key to users",
  });
  const presets = field.presets;
  assertIsSet(presets);
  expect(presets.LoggedIn({ user: { id: 5 } })).toBe(5);
});

describe("Field update", () => {
  // type to type when empty
  // fkey change target table
  it("creates table", async () => {
    await Table.create("changingtable");
  });
  it("changes to on delete cascade", async () => {
    const table = await Table.findOne({ name: "changingtable" });

    const fc = await Field.create({
      table,
      name: "read1",
      label: "Reading",
      type: "Key to books",
      required: false,
      attributes: { summary_field: "author" },
    });
    if (!db.isSQLite) {
      await fc.update({ attributes: { on_delete_cascade: true } });
      await fc.update({ attributes: { on_delete_cascade: false } });
      await fc.update({ attributes: { on_delete: "Set null" } });
      await fc.update({ attributes: { on_delete: "Cascade" } });
      await fc.update({ attributes: { on_delete: "Fail" } });
    }
  });
  it("changes to required", async () => {
    const table = await Table.findOne({ name: "changingtable" });

    const fc = await Field.create({
      table,
      name: "read3",
      label: "Reading",
      type: "Key to books",
      required: false,
      attributes: { summary_field: "author" },
    });
    if (!db.isSQLite) {
      await fc.update({ required: true });
      await fc.update({ required: false });
    }
  });
  it("changes int to float", async () => {
    const table = await Table.findOne({ name: "changingtable" });

    const fc = await Field.create({
      table,
      name: "beans",
      label: "bean count",
      type: "Integer",
    });
    //db.set_sql_logging();
    if (!db.isSQLite) {
      await fc.update({ type: "Float" });
    }
  });
  it("changes fkey ref table", async () => {
    const table = await Table.findOne({ name: "changingtable" });

    const fc = await Field.create({
      table,
      name: "read2",
      label: "Reading",
      type: "Key to books",
      required: false,
      attributes: { summary_field: "author" },
    });
    //db.set_sql_logging();

    if (!db.isSQLite) {
      await fc.update({
        type: "Key to patients",
        attributes: { summary_field: "author" },
      });
    }
  });
});

describe("Field.distinct_values", () => {
  it("gives string options", async () => {
    const table = await Table.create("fdvtable");
    const fc = await Field.create({
      table,
      label: "Colour",
      type: "String",
      required: true,
      attributes: { options: "Red,Green,Purple" },
    });
    const dvs = await fc.distinct_values();
    expect(dvs).toEqual([
      { label: "", value: "" },
      { label: "Red", value: "Red" },
      { label: "Green", value: "Green" },
      { label: "Purple", value: "Purple" },
    ]);
  });

  it("gives int values", async () => {
    const table = await Table.findOne({ name: "fdvtable" });
    assertIsSet(table);
    const fc = await Field.create({
      table,
      name: "height",
      label: "Height",
      type: "Integer",
      required: false,
    });
    await table.insertRow({ colour: "Red", height: 6 });
    await table.insertRow({ colour: "Green", height: 11 });
    const dvs = await fc.distinct_values();
    expect(dvs).toEqual([
      { label: "", value: "" },
      { label: "6", value: 6 },
      { label: "11", value: 11 },
    ]);
    const red_dvs = await fc.distinct_values(null, { colour: "Red" });
    expect(red_dvs).toEqual([
      { label: "", value: "" },
      { label: "6", value: 6 },
    ]);
  });
  it("gives fkey values", async () => {
    const fc = await Field.findOne({ name: "favbook" });
    const dvs = await fc.distinct_values();
    expect(dvs).toEqual([
      { label: "", value: "" },
      { label: "Herman Melville", value: 1 },
      { label: "Leo Tolstoy", value: 2 },
    ]);
    const longdvs = await fc.distinct_values(null, { pages: 967 });
    expect(longdvs).toEqual([
      { label: "", value: "" },
      { label: "Herman Melville", value: 1 },
    ]);
  });
  it("gives string values", async () => {
    const books = await Table.findOne({ name: "books" });
    assertIsSet(books);
    await books.insertRow({ author: "Herman Melville", pages: 56 });
    const fc = await Field.findOne({ name: "author" });
    const dvs = await fc.distinct_values();
    expect(dvs).toEqual([
      { label: "", value: "" },
      { label: "Herman Melville", value: "Herman Melville" },
      { label: "Leo Tolstoy", value: "Leo Tolstoy" },
    ]);
  });
});

describe("adds new fields to history #1202", () => {
  it("field first", async () => {
    const table = await Table.create("histcalc1");
    await Field.create({
      table,
      label: "Date",
      name: "date",
      type: "Date",
    });
    await table.update({ versioned: true });
    await table.insertRow({ date: new Date() });
    const rows = await table.getRows({});
    expect(rows.length).toBe(1);
  });
  it("history first", async () => {
    const table = await Table.create("histcalc2");
    await table.update({ versioned: true });
    await Field.create({
      table,
      label: "Date",
      name: "date",
      type: "Date",
    });
    await table.insertRow({ date: new Date() });
    const rows = await table.getRows({});
    expect(rows.length).toBe(1);
  });
  it("recalc stored first", async () => {
    const table = await Table.create("histcalc3");
    await Field.create({
      table,
      label: "Name",
      name: "name",
      type: "String",
    });
    await table.update({ versioned: true });
    await table.insertRow({ name: "Jim" });
    await Field.create({
      table,
      label: "idp1",
      type: "Integer",
      calculated: true,
      expression: "id+1",
      stored: true,
    });
    await sleep(500);

    const rows = await table.getRows({});
    expect(rows.length).toBe(1);
    expect(rows[0].idp1).toBe(2);
  });
  it("delete stored calc field #1203", async () => {
    const table = await Table.create("histcalc4");
    await table.update({ versioned: true });
    const f = await Field.create({
      table,
      label: "Name",
      name: "name",
      type: "String",
    });
    await f.delete();
    const fields = await table.getFields();
    expect(fields.length).toBe(1); // id
  });
});
