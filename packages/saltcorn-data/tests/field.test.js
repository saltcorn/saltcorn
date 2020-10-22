const Table = require("../models/table");
const Field = require("../models/field");
const db = require("../db");
const { getState } = require("../db/state");
const { plugin_with_routes } = require("./mocks");
const {
  get_expression_function,
  transform_for_async,
} = require("../models/expression");

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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
describe("calculated", () => {
  it("how to use functions", () => {
    const f = new Function("{x,y}", "return x+y");
    expect(f({ x: 1, y: 2 })).toBe(3);
  });
  it("build table", async () => {
    const table = await Table.create("withcalcs");
    await Field.create({
      table,
      label: "x",
      type: "Integer",
    });
    await Field.create({
      table,
      label: "y",
      type: "Integer",
    });
    const fz = await Field.create({
      table,
      label: "z",
      type: "Integer",
      calculated: true,
      expression: "x+y",
    });
    const fzid = await Field.create({
      table,
      label: "zid",
      type: "Integer",
      calculated: true,
      expression: "x+y+id",
    });
    const fw = await Field.create({
      table,
      label: "w",
      type: "Integer",
      calculated: true,
      expression: "y-x",
      stored: true,
    });
    const fields = await table.getFields();
    const fzf = get_expression_function(fz.expression, fields);
    expect(fzf({ x: 4, y: 2 })).toBe(6);
    await table.insertRow({ x: 5, y: 8 });
    const [row] = await table.getRows();
    expect(row.z).toBe(13);
    expect(row.zid).toBe(14);
    expect(row.w).toBe(3);
    const [row1] = await table.getJoinedRows();
    expect(row1.z).toBe(13);
    expect(row1.w).toBe(3);
    const row0 = await table.getRow({});
    expect(row0.z).toBe(13);
    expect(row0.w).toBe(3);
    await table.updateRow({ y: 9 }, row.id);
    const row2 = await table.getRow({});
    expect(row2.z).toBe(14);
    expect(row2.w).toBe(4);
    await table.update({ versioned: true });
    const newid = await table.insertRow({ x: 2, y: 4 });
    const row3 = await table.getRow({ id: newid });
    expect(row3.z).toBe(6);
    expect(row3.w).toBe(2);
    await fz.delete();
    await fw.delete();
  });
  it("cannot exit", async () => {
    const table = await Table.create("withcalcs2");
    await Field.create({
      table,
      label: "x",
      type: "Integer",
    });

    const fz = await Field.create({
      table,
      label: "z",
      type: "Integer",
      calculated: true,
      expression: "process.exit(0)",
    });
    const fields = await table.getFields();
    const fzf = get_expression_function(fz.expression, fields);
    let error;
    try {
      fzf({ x: 4 });
    } catch (e) {
      error = e;
    }
    expect(error.constructor.name).toBe("ReferenceError");
  });
  it("stored existing", async () => {
    const table = await Table.create("withcalcs3");
    await Field.create({
      table,
      label: "x",
      type: "Integer",
    });
    await Field.create({
      table,
      label: "y",
      type: "Integer",
    });
    const id1 = await table.insertRow({ x: 6, y: 9 });
    for (let index = 0; index < 25; index++) {
      await table.insertRow({ x: 1, y: 1 });
    }
    const id201 = await table.insertRow({ x: 7, y: 2 });

    const fz = await Field.create({
      table,
      label: "z",
      type: "Integer",
      calculated: true,
      expression: "x+y",
      stored: true,
    });
    const row0 = await table.getRow({ id: id1 });
    expect(row0.x).toBe(6);
    expect(row0.z).toBe(null);
    const row201 = await table.getRow({ id: id201 });
    expect(row201.x).toBe(7);
    expect(row201.z).toBe(null);
    await sleep(3000);
    const row1 = await table.getRow({ id: id1 });
    expect(row1.x).toBe(6);
    expect(row1.z).toBe(15);
    const rowlast = await table.getRow({ id: id201 });
    expect(rowlast.z).toBe(9);
    expect(rowlast.x).toBe(7);
  });
  it("use supplied function", async () => {
    const table = await Table.create("withcalcs5");
    await Field.create({
      table,
      label: "x",
      type: "Integer",
    });
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    await Field.create({
      table,
      label: "z",
      type: "Integer",
      calculated: true,
      expression: "add3(x)",
    });
    await Field.create({
      table,
      label: "w",
      type: "Integer",
      calculated: true,
      expression: "add5(x)",
    });
    await table.insertRow({ x: 13 });
    const row0 = await table.getRow({});
    expect(row0.z).toBe(16);
    expect(row0.w).toBe(18);
  });
  it("use supplied function", async () => {
    const table = await Table.create("withcalcs7");
    await Field.create({
      table,
      label: "x",
      type: "Integer",
    });
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    const xres = transform_for_async(
      "add5(1)+ add3(4)+asyncAdd2(x)",
      getState().functions
    );
    expect(xres).toEqual({
      expr_string: "add5(1) + add3(4) + (await asyncAdd2(x))",
      isAsync: true,
    });
    await Field.create({
      table,
      label: "z",
      type: "Integer",
      calculated: true,
      expression: "1+asyncAdd2(x)",
      stored: true,
    });

    const id = await table.insertRow({ x: 14 });
    const row0 = await table.getRow({});
    expect(row0.z).toBe(17);
    await table.updateRow({ x: 15 }, id);
    const rows = await table.getRows({});
    expect(rows[0].z).toBe(18);
  });
});
