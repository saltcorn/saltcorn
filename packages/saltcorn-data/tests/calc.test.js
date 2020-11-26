const Table = require("../models/table");
const Field = require("../models/field");
const db = require("../db");
const { getState } = require("../db/state");
const { plugin_with_routes, sleep } = require("./mocks");
const {
  get_expression_function,
  transform_for_async,
  expressionValidator,
} = require("../models/expression");

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

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
    expect([null, 15]).toContain(row0.z);
    const row201 = await table.getRow({ id: id201 });
    expect(row201.x).toBe(7);
    expect([null, 9]).toContain(row201.z);
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
describe("expressions", () => {
  it("validates correct", () => {
    expect(expressionValidator("2+2")).toBe(true);
  });
  it("validates correct", () => {
    expect(expressionValidator("name.toUpperCase()")).toBe(true);
  });
  it("invalidates incorrect", () => {
    expect(expressionValidator("2+")).toBe("Unexpected token '}'");
  });
});
