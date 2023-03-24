import Table from "../models/table";
import Field from "../models/field";
import db from "../db";
const { getState } = require("../db/state");
import mocks from "./mocks";
const { plugin_with_routes, sleep } = mocks;
import expression from "../models/expression";
const {
  get_expression_function,
  transform_for_async,
  expressionValidator,
  jsexprToWhere,
  freeVariables,
  recalculate_for_stored,
} = expression;
import { mkWhere } from "@saltcorn/db-common/internal";

import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

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
    const fzf = get_expression_function(fz.expression!, fields);
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
    assertIsSet(row0);
    expect(row0.z).toBe(13);
    expect(row0.w).toBe(3);
    await table.updateRow({ y: 9 }, row.id);
    const row2 = await table.getRow({});
    assertIsSet(row2);
    expect(row2.z).toBe(14);
    expect(row2.w).toBe(4);
    await table.update({ versioned: true });
    const newid = await table.insertRow({ x: 2, y: 4 });
    const row3 = await table.getRow({ id: newid });
    assertIsSet(row3);
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
    assertIsSet(fz.expression);
    const fzf = get_expression_function(fz.expression, fields);
    let error;
    try {
      fzf({ x: 4 });
    } catch (e: any) {
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
    assertIsSet(row0);
    expect(row0.x).toBe(6);
    expect([null, 15]).toContain(row0.z);
    const row201 = await table.getRow({ id: id201 });
    assertIsSet(row201);

    expect(row201.x).toBe(7);
    expect([null, 9]).toContain(row201.z);
    await sleep(3000);
    const row1 = await table.getRow({ id: id1 });
    assertIsSet(row1);
    expect(row1.x).toBe(6);
    expect(row1.z).toBe(15);
    const rowlast = await table.getRow({ id: id201 });
    assertIsSet(rowlast);
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
    getState().registerPlugin("mock_plugin", plugin_with_routes());
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
    assertIsSet(row0);
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
    getState().registerPlugin("mock_plugin", plugin_with_routes());
    const xres = transform_for_async(
      "add5(1)+ add3(4)+asyncAdd2(x)",
      getState().functions
    );
    expect(xres).toEqual({
      expr_string: "add5(1) + add3(4) + await asyncAdd2(x)",
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
    assertIsSet(row0);
    expect(row0.z).toBe(17);
    await table.updateRow({ x: 15 }, id);
    const rows = await table.getRows({});
    expect(rows[0].z).toBe(18);
  });
});
describe("joinfields in stored calculated fields", () => {
  it("creates", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    await Field.create({
      table: patients,
      label: "favpages",
      type: "Integer",
      calculated: true,
      expression: "favbook?.pages",
      stored: true,
    });
  });
  it("updates", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const bookRows = await patients.getRows({});
    for (const row of bookRows) {
      await patients.updateRow({}, row.id);
    }
  });
  it("check", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const bookrow = await patients.getRow({ id: 1 });

    expect(bookrow?.favpages).toBe(967);
  });
  it("changes", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    await patients.updateRow({ favbook: 2 }, 1);

    const bookrow = await patients.getRow({ id: 1 });

    expect(bookrow?.favpages).toBe(728);
  });
  it("insert", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const hid = await patients.insertRow({ name: "Herman Smith", favbook: 1 });
    const hrow = await patients.getRow({ id: hid });

    expect(hrow?.favpages).toBe(967);
    //expect(bookrow?.favpages).toBe(967);
  });
});

describe("expressionValidator", () => {
  it("validates correct", () => {
    expect(expressionValidator("2+2")).toBe(true);
  });
  it("validates record literal", () => {
    expect(expressionValidator("{foo: 4}")).toBe(true);
  });
  it("validates correct", () => {
    expect(expressionValidator("name.toUpperCase()")).toBe(true);
  });
  it("invalidates incorrect", () => {
    expect(expressionValidator("2+")).toContain("Unexpected");
  });
});

describe("free variables", () => {
  it("empty", () => {
    expect([...freeVariables("2+2")]).toEqual([]);
  });
  it("simple", () => {
    expect([...freeVariables("2+x")]).toEqual(["x"]);
  });
  it("record access", () => {
    expect([...freeVariables("2+x.k")]).toEqual(["x.k"]);
  });
  it("record double access", () => {
    expect([...freeVariables("x.k.y")]).toEqual(["x.k.y"]);
  });
  it("record triple access", () => {
    expect([...freeVariables("1+x.k.y.z")]).toEqual(["x.k.y.z"]);
  });
  it("record single and double access", () => {
    expect([...freeVariables("x.k.y+x.z")]).toEqual(["x.k.y", "x.z"]);
  });
  it("record double access with function", () => {
    expect([...freeVariables("Math.floor(x.k.y)")]).toEqual(["x.k.y"]);
  });
  it("chain record access", () => {
    expect([...freeVariables("1+x?.k")]).toEqual(["x.k"]);
  });
});
describe("jsexprToWhere", () => {
  it("translates equality", () => {
    expect(jsexprToWhere("foo==4")).toEqual({ foo: 4 });
  });
  it("translates equality reverse", () => {
    expect(jsexprToWhere("4==foo")).toEqual({ foo: 4 });
  });
  it("translates equal to col", () => {
    expect(jsexprToWhere("foo==bar").foo.description).toBe("bar");
  });
  it("translates context", () => {
    expect(jsexprToWhere("foo==$bar", { bar: 5 })).toEqual({ foo: 5 });
  });
  it("translates context", () => {
    const w = jsexprToWhere("$father !== null && married_to === $father", {
      father: "1",
    });
    expect(w).toEqual({ married_to: "1", not: { eq: ["1", null] } });
  });
  it("translates context", () => {
    const w = jsexprToWhere("$father !== null && married_to === $father", {});
    expect(w).toEqual({ married_to: null, not: { eq: [null, null] } });
  });
  it("is null in sql", () => {
    const w = jsexprToWhere("group !== null", {});
    expect(w).toEqual({ not: { group: null } });

    const { where } = mkWhere(w);
    expect(where).toEqual('where not ("group" is null)');
  });
  it("translates greater than", () => {
    expect(jsexprToWhere("foo>4")).toEqual({ foo: { gt: 4 } });
  });
  it("translates lte", () => {
    expect(jsexprToWhere("foo<=4")).toEqual({ foo: { lt: 4, equal: true } });
  });
  it("translates join field", async () => {
    const books = Table.findOne({ name: "books" });
    const fields = await books?.getFields();
    expect(jsexprToWhere("publisher.name=='AK Press'", {}, fields)).toEqual({
      publisher: {
        inSelect: {
          field: "id",
          table: "publisher",
          tenant: "public",
          where: { name: "AK Press" },
        },
      },
    });
  });
  it("access context subvars", () => {
    expect(jsexprToWhere("foo==user.id", { user: { id: 5 } })).toEqual({
      foo: 5,
    });
  });
  /*it("access context subvars rev", () => {
    expect(jsexprToWhere("4===foo")).toEqual({ foo: 4 });
    expect(jsexprToWhere("user.id===foo", { user: { id: 5 } })).toEqual({
      foo: 5,
    });
  });*/
});
