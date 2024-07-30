import Table from "../models/table";
import Field from "../models/field";
import Trigger from "../models/trigger";
import db from "../db";
const { getState } = require("../db/state");
import mocks from "./mocks";
const { plugin_with_routes, sleep } = mocks;
import expression from "../models/expression";
const {
  eval_expression,
  get_expression_function,
  transform_for_async,
  expressionValidator,
  jsexprToWhere,
  jsexprToSQL,
  freeVariables,
  freeVariablesInInterpolation,
  recalculate_for_stored,
} = expression;
import { mkWhere } from "@saltcorn/db-common/internal";

import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import utils from "../utils";
const { interpolate, mergeIntoWhere } = utils;

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("eval_expression", () => {
  it("simply evaluates", () => {
    expect(eval_expression("x+2", { x: 5 })).toBe(7);
  });
  it("uses code pages", async () => {
    await getState().setConfig("function_code_pages", {
      mypage: `function add58(x){return x+58}`,
    });
    await getState().refresh_codepages();

    expect(eval_expression("add58(x)", { x: 5 })).toBe(63);
  });
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
    const fields = table.getFields();
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
    const fields = table.getFields();
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
describe("aggregations in stored calculated fields", () => {
  it("creates", async () => {
    const publisher = Table.findOne({ name: "publisher" });
    assertIsSet(publisher);
    await Field.create({
      table: publisher,
      label: "Number of books",
      type: "Integer",
      calculated: true,
      expression: "__aggregation",
      attributes: {
        aggregate: "Count",
        aggwhere: "",
        agg_field: "id@Integer",
        agg_relation: "books.publisher",
        table: "books",
        ref: "publisher",
      },
      stored: true,
    });
  });
  it("updates", async () => {
    const publisher = Table.findOne({ name: "publisher" });
    assertIsSet(publisher);
    const bookRows = await publisher.getRows({});
    for (const row of bookRows) {
      await publisher.updateRow({}, row.id);
    }
  });
  it("check", async () => {
    const publisher = Table.findOne({ name: "publisher" });
    assertIsSet(publisher);
    const bookrow = await publisher.getRow({ id: 1 });

    expect(bookrow?.number_of_books).toBe(1);
  });

  it("insert", async () => {
    const publisher = Table.findOne({ name: "publisher" });
    assertIsSet(publisher);
    const hid = await publisher.insertRow({ name: "Collins" });
    const hrow = await publisher.getRow({ id: hid });
    expect(hrow?.number_of_books).toBe(0);

    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await books.insertRow({
      author: "Murphy",
      pages: 456,
      publisher: hid,
    });
    //await recalculate_for_stored(publisher);
    const hrow1 = await publisher.getRow({ id: hid });
    expect(hrow1?.number_of_books).toBe(1);
    await books.insertRow({
      author: "Tufte",
      pages: 210,
      publisher: hid,
    });
    await recalculate_for_stored(publisher, { id: hid });
    const hrow2 = await publisher.getRow({ id: hid });
    expect(hrow2?.number_of_books).toBe(2);
    const trigger = await Trigger.create({
      action: "recalculate_stored_fields",
      table_id: books.id,
      when_trigger: "Insert",
      configuration: {
        table: "publisher",
        where: "{id: publisher}",
      },
    });
    const wid = await books.insertRow({
      author: "West",
      pages: 210,
      publisher: hid,
    });
    await sleep(200);

    const hrow3 = await publisher.getRow({ id: hid });
    expect(hrow3?.number_of_books).toBe(3);
    await books.deleteRows({ id: wid });
    const hrow4 = await publisher.getRow({ id: hid });
    expect(hrow4?.number_of_books).toBe(2);
  });
  it("creates and updates sum field", async () => {
    const publisher = Table.findOne({ name: "publisher" });
    assertIsSet(publisher);
    await Field.create({
      table: publisher,
      label: "Sum of pages",
      type: "Integer",
      calculated: true,
      expression: "__aggregation",
      attributes: {
        aggregate: "Sum",
        aggwhere: "",
        agg_field: "pages@Integer",
        agg_relation: "books.publisher",
        table: "books",
        ref: "publisher",
      },
      stored: true,
    });
    const bookRows = await publisher.getRows({});
    for (const row of bookRows) {
      await publisher.updateRow({}, row.id);
    }
    const hrow3 = await publisher.getRow({ id: 1 });

    expect(hrow3?.sum_of_pages).toBe(728);
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const book = await books.getRow({ publisher: 1 });
    assertIsSet(book);
    await books.updateRow({ pages: 729 }, book.id);
    const hrow4 = await publisher.getRow({ id: 1 });
    expect(hrow4?.sum_of_pages).toBe(729);
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
  it("in interpolation", () => {
    expect([...freeVariablesInInterpolation("hello {{2+x.k}}")]).toEqual([
      "x.k",
    ]);
  });
  it("in unsafe interpolation", () => {
    expect([...freeVariablesInInterpolation("hello {{! x.k}}")]).toEqual([
      "x.k",
    ]);
  });
  it("in unsafe interpolation", () => {
    expect([...freeVariablesInInterpolation("hello {{! foo}}")]).toEqual([
      "foo",
    ]);
  });
  it("in interpolation", () => {
    expect([
      ...freeVariablesInInterpolation("hello {{2+x.k}} there {{y.z}}"),
    ]).toEqual(["x.k", "y.z"]);
  });
});
describe("interpolation", () => {
  it("interpolates simple", () => {
    expect(interpolate("hello {{ x }}", { x: 1 })).toBe("hello 1");
    expect(
      interpolate("hello {{ x }}", { x: "<script>alert(1)</script>" })
    ).toBe("hello &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(
      interpolate("hello {{! x }}", { x: "<script>alert(1)</script>" })
    ).toBe("hello <script>alert(1)</script>");

    //expect(interpolate("hello {{x}}", { x: 1 })).toBe("hello 1"); TODO
  });
});
describe("jsexprToSQL", () => {
  it("translates equality", () => {
    expect(jsexprToSQL("foo==4")).toEqual("(foo)==(4)");
  });
  it("translates bools", () => {
    expect(jsexprToSQL("foo==true")).toEqual("foo is true");
    expect(jsexprToSQL("foo==false")).toEqual("foo is false");
  });
  it("translates null cmps", () => {
    expect(jsexprToSQL("foo===null")).toEqual("foo is null");
    expect(jsexprToSQL("foo==null")).toEqual("foo is null");
    expect(jsexprToSQL("foo!=null")).toEqual("foo is not null");
    expect(jsexprToSQL("foo!==null")).toEqual("foo is not null");
  });
});
describe("mergeIntoWhere", () => {
  it("merges", () => {
    expect(mergeIntoWhere({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    expect(mergeIntoWhere({ a: 1 }, { a: 2 })).toEqual({ a: [1, 2] });
    expect(
      mergeIntoWhere({ or: [{ a: 1 }, { a: 2 }] }, { or: [{ b: 3 }, { b: 4 }] })
    ).toEqual({
      and: [{ or: [{ a: 1 }, { a: 2 }] }, { or: [{ b: 3 }, { b: 4 }] }],
    });
  });
});
let x = {
  and: [{ or: [{ a: 1 }, { a: 2 }] }, { or: [{ b: 3 }, { b: 4 }] }],
  or: [{ b: 3 }, { b: 4 }],
};
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
  it("translates own context", () => {
    expect(
      jsexprToWhere("foo==$foo", { foo: 5 }, [{ name: "foo" }] as Field[])
    ).toEqual({ foo: 5 });
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
  it("access deep context subvars", () => {
    expect(
      jsexprToWhere("foo==user.address.id", { user: { address: { id: 5 } } })
    ).toEqual({
      foo: 5,
    });
  });
  it("access context subvars rev", () => {
    expect(jsexprToWhere("user.id===foo", { user: { id: 5 } })).toEqual({
      foo: 5,
    });
  });
  it("still parses same var", () => {
    //nexdot issue Where function not working well
    expect(jsexprToWhere("foo == $foo", { foo: "$foo" })).toEqual({
      foo: "$foo",
    });
  });
  it("translates sums", () => {
    expect(jsexprToWhere("foo==4+3")).toEqual({ foo: 7 });
    expect(jsexprToWhere("foo==4+3+1")).toEqual({ foo: 8 });
  });
  it("translates bools", () => {
    expect(jsexprToWhere("foo==true")).toEqual({ foo: true });
    expect(jsexprToWhere("foo==false")).toEqual({ foo: false });
    expect(jsexprToWhere("foo!==true")).toEqual({ not: { foo: true } });
    expect(jsexprToWhere("!(foo==true)")).toEqual({ not: { foo: true } });
    expect(jsexprToWhere('bar == "Zoo" && !(foo==true)')).toEqual({
      bar: "Zoo",
      not: { foo: true },
    });
    expect(
      jsexprToWhere(
        '(bar == "Zoo" || bar == "Baz" || bar == "Waz") && !(foo==true)'
      )
    ).toEqual({
      or: [{ or: [{ bar: "Zoo" }, { bar: "Baz" }] }, { bar: "Waz" }],
      not: { foo: true },
    });
    expect(
      jsexprToWhere(
        '(bar == "Zoo" || bar == "Baz") && (foo==false || foo==null)'
      )
    ).toEqual({
      and: [
        { or: [{ bar: "Zoo" }, { bar: "Baz" }] },
        { or: [{ foo: false }, { foo: null }] },
      ],
    });
  });
  it("translates date limits", () => {
    expect(jsexprToWhere("foo>=year+'-'+month+'-01'").foo.gt).toMatch(/^202/);
  });
  it("translates today()", () => {
    const todayW = jsexprToWhere("foo>=today()");
    const today = todayW.foo.gt;
    expect(todayW.foo.equal).toEqual(true);
    expect(today).toMatch(/^202/);

    expect(jsexprToWhere("foo>=today(5)").foo.gt).toMatch(/^202/);
    expect(
      new Date(jsexprToWhere("foo>=today(5)").foo.gt) > new Date(today)
    ).toEqual(true);
    expect(
      new Date(jsexprToWhere("foo>=today({startOf: 'week'})").foo.gt) <
        new Date()
    ).toEqual(true);

    const eoweek = new Date(
      jsexprToWhere("foo>=today({endOf: 'week'})").foo.gt
    );

    expect(
      eoweek > new Date() || eoweek.toDateString() === new Date().toDateString()
    ).toEqual(true);
    expect(jsexprToWhere("foo>=today(-5)").foo.gt).toMatch(/^202/);
    expect(
      new Date(jsexprToWhere("foo>=today(-5)").foo.gt) < new Date(today)
    ).toEqual(true);
    const pp1W = jsexprToWhere("foo >= today(-1) && foo < today()");
    expect(!!pp1W.foo[0].gt).toBe(true);
    expect(pp1W.foo[0].equal).toBe(true);
    expect(!!pp1W.foo[1].lt).toBe(true);
    const ppW = jsexprToWhere(
      "createdby == user.id && (foo >= today(-1) && foo < today())",
      { user: { id: 1 } }
    );
    expect(ppW.createdby).toBe(1);
    expect(!!ppW.foo[0].gt).toBe(true);
    expect(!!ppW.foo[1].lt).toBe(true);
  });
  it("translates new Date()", () => {
    const todayW = jsexprToWhere("foo>=new Date()");
    const today = todayW.foo.gt;
    expect(todayW.foo.equal).toEqual(true);
    expect(today instanceof Date).toBe(true);
    expect(today.toISOString()).toMatch(/^202/);
  });
});
