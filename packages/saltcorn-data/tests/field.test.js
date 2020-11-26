const Table = require("../models/table");
const Field = require("../models/field");
const db = require("../db");
const { getState } = require("../db/state");

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
    expect(fc.reftable_name).toBe("_sc_files");
  });
  it("fills fkey options", async () => {
    const f = await Field.findOne({ name: "favbook" });
    await f.fill_fkey_options();
    expect(f.options).toContainEqual({ label: "Leo Tolstoy", value: 2 });
    if (db.isSQLite) expect(f.sql_type).toBe('int references "books" (id)');
    else expect(f.sql_type).toBe('int references "public"."books" (id)');

    expect(f.is_fkey).toBe(true);
    expect(f.sql_bare_type).toBe("int");
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
  expect(presets.LoggedIn({ user: { id: 5 } })).toBe(5);
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
      { label: 6, value: 6 },
      { label: 11, value: 11 },
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
  });
  it("gives string values", async () => {
    const books = await Table.findOne({ name: "books" });
    books.insertRow({ author: "Herman Melville", pages: 56 });
    const fc = await Field.findOne({ name: "author" });
    const dvs = await fc.distinct_values();
    expect(dvs).toEqual([
      { label: "", value: "" },
      { label: "Herman Melville", value: "Herman Melville" },
      { label: "Leo Tolstoy", value: "Leo Tolstoy" },
    ]);
  });
});
