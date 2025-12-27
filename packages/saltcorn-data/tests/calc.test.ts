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
  identifiersInCodepage,
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
import { afterAll, describe, it, expect, beforeAll, jest } from "@jest/globals";
import utils from "../utils";
import PlainDate from "@saltcorn/plain-date";
const { interpolate, mergeIntoWhere } = utils;

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
jest.setTimeout(30000);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("identifiersInCodepage", () => {
  it("gets Function", () => {
    const ids = identifiersInCodepage(
      `function foobar(){};async function baz(){}`
    );
    expect(ids).toEqual(new Set(["foobar", "baz"]));
  });
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
  it("uses moment with plain date", () => {
    expect(
      eval_expression("moment(mydate).format('DD.MM.YYYY')", {
        mydate: new PlainDate("2026-10-04"),
      })
    ).toBe("04.10.2026");
  });

  it("evaluates with null row", () => {
    expect(eval_expression("5+2", undefined)).toBe(7);
    expect(eval_expression("5+2", null)).toBe(7);
    expect(eval_expression("5+2")).toBe(7);
  });
});

describe("code pages in eval", () => {
  it("sync codepages", async () => {
    await getState().setConfig("function_code_pages", {
      mypage: `function add59(x){return x+59};
      globalThis.fooconst = 13;
      `,
    });
    await getState().refresh_codepages();

    expect(eval_expression("add59(fooconst)", {})).toBe(59 + 13);
  });
  it("async codepages", async () => {
    await getState().setConfig("function_code_pages", {
      mypage: `
      globalThis.barconst = 17;
      function add8(x){return x+8}
      runAsync(async () => {
        const book = await Table.findOne("books").getRow({id:1});
        globalThis.bookpages = book.pages;      
      })
      globalThis.bazconst = 12;
      `,
    });
    await getState().refresh_codepages();

    expect(eval_expression("bookpages", {})).toBe(967);
    expect(eval_expression("barconst", {})).toBe(17);
    expect(eval_expression("bazconst", {})).toBe(12);
    expect(eval_expression("add8(bazconst)", {})).toBe(20);

  });
  it("user driven constant change in codepages", async () => {
    const table = Table.findOne("books");
    assertIsSet(table);
    await getState().setConfig("function_code_pages", {
      mypage: `
      runAsync(async () => {
        const books = await Table.findOne("books").getRows({});
        let sum = 0
        for(const b of books) sum += b.pages
        globalThis.sumbookpages = sum;
      })
      `,
    });
    await getState().refresh_codepages();

    expect(eval_expression("sumbookpages", {})).toBe(1695);
    const tr = await Trigger.create({
      action: "run_js_code",
      table_id: table.id,
      when_trigger: "Insert",
      configuration: {
        code: `await refreshSystemCache("codepages");`,
      },
    });
    const id = await table.insertRow({ author: "Giuseppe Tomasi", pages: 209 });
    expect(eval_expression("sumbookpages", {})).toBe(1695 + 209);
    await table.deleteRows({ id });
    await sleep(500);
    await tr.delete()
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
  it("avoid nans in integer fields", async () => {
    const table = await Table.create("withcalcsintnans");
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

    await Field.create({
      table,
      label: "z",
      type: "Integer",
      calculated: true,
      expression:
        "moment(null).startOf('day').diff(moment(null).startOf('day'), 'days') + 1",
      stored: true,
    });
    await Field.create({
      table,
      label: "fz",
      type: "Float",
      calculated: true,
      expression:
        "moment(null).startOf('day').diff(moment(null).startOf('day'), 'days') + 1",
      stored: true,
    });
    await table.update({ versioned: true });

    const id1 = await table.insertRow({ x: 7, y: 2 });

    const row0 = await table.getRow({ id: id1 });
    assertIsSet(row0);
    expect(row0.x).toBe(7);
    expect(row0.z).toBe(null);
    //seems some differences in pg or node versions
    expect(isNaN(row0.fz) || row0.fz === null).toBe(true);
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
    await Field.create({
      table,
      label: "td",
      type: "Date",
      calculated: true,
      expression: "today(-5)",
      stored: true,
    });

    const id = await table.insertRow({ x: 14 });
    const row0 = await table.getRow({});
    assertIsSet(row0);
    expect(row0.z).toBe(17);
    await table.updateRow({ x: 15 }, id);
    const rows = await table.getRows({});
    expect(rows[0].z).toBe(18);
    if (!db.isSQLite) expect(rows[0].td instanceof Date).toBe(true);
  });
});
describe("single joinfields in stored calculated fields", () => {
  it("creates", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const f = await Field.create({
      table: patients,
      label: "favpages",
      type: "Integer",
      calculated: true,
      expression: "favbook?.pages",
      stored: true,
    });
    expect(f.attributes.calc_joinfields.length).toBe(1);
    expect(f.attributes.calc_joinfields[0].targetTable).toBe("books");
    expect(f.attributes.calc_joinfields[0].field).toBe("favbook");
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
  it("recalculates", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const patient = await patients.getRow({ id: 1 });
    assertIsSet(patient);

    expect(patient.favbook).toBe(2);
    expect(patient.favpages).toBe(728);
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const book = await books.getRow({ id: patient.favbook });
    assertIsSet(book);
    expect(book.pages).toBe(728);
    await books.updateRow({ pages: 729 }, book.id);
    //await recalculate_for_stored(patients, { id: 1 });

    const patient1 = await patients.getRow({ id: 1 });
    assertIsSet(patient1);

    expect(patient1.favpages).toBe(729);

    await books.updateRow({ pages: 728 }, book.id);
  });
  it("add reciprocal field for looped updates ", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await Field.create({
      table: books,
      label: "Number of fans",
      type: "Integer",
      calculated: true,
      expression: "__aggregation",
      attributes: {
        aggregate: "Count",
        aggwhere: "",
        agg_field: "id@Integer",
        agg_relation: "patients.favbook",
        table: "patients",
        ref: "favbook",
      },
      stored: true,
    });
    await Field.create({
      table: books,
      label: "idp1",
      type: "Integer",
      calculated: true,
      expression: "id+1",
      stored: false,
    });
    await Field.create({
      table: books,
      label: "storedsum",
      type: "Integer",
      calculated: true,
      expression: "number_of_fans+idp1",
      stored: true,
    });
  });
  it("change value without triggering infinite loop", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const patient = await patients.getRow({ id: 1 });
    assertIsSet(patient);

    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const book = await books.getRow({ id: patient.favbook });
    assertIsSet(book);

    expect(book.pages).toBe(728);
    await books.updateRow({ pages: 729 }, book.id);
    await books.updateRow({ pages: 728 }, book.id);
    const bid = await books.insertRow({ author: "Terry Eagleton", pages: 456 });
    const book1 = await books.getRow({ id: bid });
    assertIsSet(book1);  
    expect(book1.storedsum).toBe(bid+1);

    await books.getField("number_of_fans")!.delete();
    await books.getField("idp1")!.delete();
    await books.getField("storedsum")!.delete();
    await books.deleteRows({ id: bid });
  });
});

describe("bool arrays in stored calculated JSON fields", () => {
  it("creates", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    await Field.create({
      name: "normalised_readings",
      label: "normalised_readings",
      calculated: true,
      stored: true,
      expression: "__aggregation",
      type: "JSON",
      attributes: {
        ref: "patient_id",
        table: "readings",
        aggwhere: "",
        agg_field: "normalised@Bool",
        aggregate: "Array_Agg",
        agg_order_by: "",
        agg_relation: "readings.patient_id",
        unique_error_msg: null,
      },
      required: false,

      table: patients,
    });
    // need this to avoid race condition with next test
    await recalculate_for_stored(patients);
  });
  it("has array content", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const pat = await patients.getRow({ id: 1 });
    assertIsSet(pat);
    expect(Array.isArray(pat.normalised_readings)).toBe(true);
    if (!db.isSQLite) expect(typeof pat.normalised_readings[0]).toBe("boolean");
  });
  it("updates on changes", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);

    const pat = await patients.getRow({ id: 1 });
    assertIsSet(pat);
    if (!db.isSQLite) expect(typeof pat.normalised_readings[0]).toBe("boolean");
    const reads = await readings.getRows({ patient_id: 1 });
    for (const read of reads)
      await readings.updateRow({ normalised: false }, read.id);
    const pat1 = await patients.getRow({ id: 1 });
    assertIsSet(pat1);
    expect(Array.isArray(pat1.normalised_readings)).toBe(true);
    if (!db.isSQLite)
      expect(typeof pat1.normalised_readings[0]).toBe("boolean");
    if (db.isSQLite) expect(!!pat1.normalised_readings[0]).toBe(false);
    else expect(pat1.normalised_readings[0]).toBe(false);
  });
  it("updates on insert", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const pat0 = await patients.getRow({ id: 1 });

    assertIsSet(pat0);
    expect(Array.isArray(pat0.normalised_readings)).toBe(true);
    expect(pat0.normalised_readings.length).toBe(2);
    await readings.insertRow({
      normalised: true,
      patient_id: 1,
      temperature: 39,
    });
    const pat1 = await patients.getRow({ id: 1 });
    assertIsSet(pat1);
    expect(Array.isArray(pat1.normalised_readings)).toBe(true);
    if (!db.isSQLite)
      expect(typeof pat1.normalised_readings[0]).toBe("boolean");
    expect(pat1.normalised_readings.length).toBe(3);
  });
});

describe("double joinfields in stored calculated fields", () => {
  it("creates", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const f = await Field.create({
      table: readings,
      label: "favpages",
      type: "Integer",
      calculated: true,
      expression: "patient_id?.favbook?.pages",
      stored: true,
    });
    //console.log(f.attributes.calc_joinfields)
  });
  it("recalculates if final value changes", async () => {
    const readings = Table.findOne({ name: "readings" });

    assertIsSet(readings);

    const patients = Table.findOne({ name: "patients" });

    assertIsSet(patients);

    const patid = await patients.insertRow({ name: "Stephen Few", favbook: 2 });

    const readid = await readings.insertRow({
      patient_id: patid,
      temperature: 37,
    });

    const reading = await readings.getRow({ id: readid });
    expect(reading?.favpages).toBe(728);

    const patient = await patients.getRow({ id: patid });
    assertIsSet(patient);
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const book = await books.getRow({ id: patient.favbook });

    expect(book?.pages).toBe(728);
    await books.updateRow({ pages: 729 }, book?.id);
    //await recalculate_for_stored(patients, { id: 1 });

    const reading1 = await readings.getRow({ id: readid });
    expect(reading1?.favpages).toBe(729);

    await books.updateRow({ pages: 728 }, book?.id);
  });
  it("recalculates if intermediate value changes", async () => {
    const readings = Table.findOne({ name: "readings" });

    assertIsSet(readings);

    const patients = Table.findOne({ name: "patients" });

    assertIsSet(patients);

    const patid = await patients.insertRow({
      name: "Stephen Many",
      favbook: 2,
    });

    const readid = await readings.insertRow({
      patient_id: patid,
      temperature: 37,
    });

    const reading = await readings.getRow({ id: readid });
    expect(reading?.favpages).toBe(728);

    await patients.updateRow({ favbook: 1 }, patid);
    //await recalculate_for_stored(readings, { id: readid });

    const reading1 = await readings.getRow({ id: readid });
    expect(reading1?.favpages).toBe(967);
  });
});

describe("Simple aggregations in stored calculated fields", () => {
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
    //await recalculate_for_stored(publisher, { id: hid });
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
  it("moves from one parent to another", async () => {
    const publisher = Table.findOne({ name: "publisher" });
    assertIsSet(publisher);

    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const ps = await publisher.getRows({}, { orderBy: "id" });
    //console.log("ps", ps);

    expect(ps[1].number_of_books).toBe(0);
    expect(ps[2].number_of_books).toBe(2);
    const cbook = await books.getRow({ publisher: 3 });
    assertIsSet(cbook);
    //await getState().setConfig("log_level", 6);
    await books.updateRow({ publisher: 2 }, cbook.id);
    //await recalculate_for_stored(publisher, {});
    //await getState().setConfig("log_level", 1);

    const ps1 = await publisher.getRows({}, { orderBy: "id" });
    //onsole.log("ps1", ps1);

    expect(ps1[1].number_of_books).toBe(1);
    expect(ps1[2].number_of_books).toBe(1);
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
    const bid = await books.insertRow({
      pages: 11,
      publisher: 1,
      author: "Fizz Buzz",
    });
    const hrow5 = await publisher.getRow({ id: 1 });
    expect(hrow5?.sum_of_pages).toBe(740);
    await books.deleteRows({ id: bid });
  });
});
describe("Sum-where aggregations in stored calculated fields", () => {
  it("creates and updates sum field", async () => {
    const publisher = Table.findOne({ name: "publisher" });
    assertIsSet(publisher);
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await Field.create({
      table: books,
      label: "Interesting",
      type: "Bool",
    });
    await Field.create({
      table: publisher,
      label: "Sum of pages2",
      type: "Integer",
      calculated: true,
      expression: "__aggregation",
      attributes: {
        aggregate: "Sum",
        aggwhere: "interesting == true",
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

    const book = await books.getRow({ publisher: 1 });
    assertIsSet(book);
    const bookid = await books.insertRow({
      pages: 12,
      publisher: 1,
      author: "Fizz Buzz",
      interesting: true,
    });
    const hrow4 = await publisher.getRow({ id: 1 });
    expect(hrow4?.sum_of_pages2).toBe(12);
    await books.updateRow({ pages: 14 }, bookid);
    const hrow6 = await publisher.getRow({ id: 1 });
    expect(hrow6?.sum_of_pages2).toBe(14);

    const bid2 = await books.insertRow({
      pages: 11,
      publisher: 1,
      author: "Fizz Buzz",
      interesting: true,
    });
    const hrow5 = await publisher.getRow({ id: 1 });
    expect(hrow5?.sum_of_pages2).toBe(25);
    await books.deleteRows({ id: bookid });
    await books.deleteRows({ id: bid2 });
  });
});

describe("join-aggregations in stored calculated fields", () => {
  it("creates", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await Field.create({
      table: books,
      name: "books_same_pub",
      label: "books_same_pub",
      calculated: true,
      stored: true,
      expression: "__aggregation",
      type: "Integer",
      attributes: {
        ref: "publisher",
        table: "publisher->books",
        aggwhere: "",
        agg_field: "id@Integer",
        aggregate: "Count",
        agg_order_by: null,
        agg_relation: "publisher->books.publisher",
        unique_error_msg: null,
      },
    });
    await recalculate_for_stored(books);
  });

  it("check", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const bookrow = await books.getRow({ id: 2 });

    expect(bookrow?.books_same_pub).toBe(1);
    await books.insertRow({ author: "Boring bloke", pages: 54, publisher: 1 });
    const bookrow1 = await books.getRow({ id: 2 });

    expect(bookrow1?.books_same_pub).toBe(2);
  });
});
describe("join-aggregations in stored calculated fields again", () => {
  it("creates", async () => {
    const sumtable = await Table.create("DateSummary");
    const banktable = await Table.create("Bank");
    const xacttable = await Table.create("Transaction");
    await Field.create({
      table: banktable,
      name: "name",
      label: "Name",
      type: "String",
    });
    await Field.create({
      table: sumtable,
      name: "bankid",
      label: "BankID",
      type: "Key to Bank",
    });
    await Field.create({
      table: xacttable,
      name: "tbankid",
      label: "TBankID",
      type: "Key to Bank",
    });
    await Field.create({
      table: xacttable,
      name: "amount",
      label: "Amount",
      type: "Integer",
    });
    await Field.create({
      table: sumtable,
      name: "sumamount",
      label: "SumAmount",
      type: "Integer",
      calculated: true,
      stored: true,
      expression: "__aggregation",
      attributes: {
        ref: "tbankid",
        table: "bankid->Transaction",
        aggwhere: "", //"transactiondate == summarydate",
        agg_field: "amount@Integer",
        aggregate: "Sum",
        agg_relation: "bankid->Transaction.tbankid",
      },
    });
    await banktable.insertRow({ name: "Lloyds" });
    await banktable.insertRow({ name: "Starling" });
    await banktable.insertRow({ name: "HSBC" });
    await sumtable.insertRow({ bankid: 2 });
    await sumtable.insertRow({ bankid: 1 });
    await sumtable.insertRow({ bankid: 3 });
    await xacttable.insertRow({ tbankid: 2, amount: 10 });
    //await recalculate_for_stored(sumtable);
    const sumrow = await sumtable.getRow({ id: 1 });

    expect(sumrow?.sumamount).toBe(10);
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
    expect([...freeVariables("Math.floor(x.k)")]).toEqual(["Math", "x.k"]);
    expect([...freeVariables("Math.floor(x)")]).toEqual(["Math", "x"]);
    expect([...freeVariables("Math.floor(x.k.y)")]).toEqual(["Math", "x.k.y"]);
    expect([...freeVariables("Math.floor(x.k.y.w)")]).toEqual([
      "Math",
      "x.k.y.w",
    ]);
  });
  it("does not include match function calls", () => {
    expect([...freeVariables("x.k.match(/xx/)")]).toEqual(["x.k"]);
    expect([...freeVariables("x.k.map(g).includes(y)")]).toContain("x.k");
    expect([...freeVariables("myFun(k)")]).toEqual(["myFun", "k"]);
    expect([...freeVariables("myFun(x.k)")]).toEqual(["myFun", "x.k"]);
    expect([...freeVariables("Foo.myFun(x.k)")]).toEqual(["Foo", "x.k"]);
    expect([...freeVariables("foo.match(/xx/)")]).toEqual(["foo"]);
    expect([...freeVariables("foo[0]")]).toEqual(["foo"]);
    expect([...freeVariables("x.k.map(g)")]).toEqual(["x.k", "g"]);
  });
  it("does not include length", () => {
    expect([...freeVariables("x.k.length")]).toEqual(["x.k"]);
    expect([...freeVariables("x.length")]).toEqual(["x"]);
  });

  it("chain record access", () => {
    expect([...freeVariables("1+x?.k")]).toEqual(["x.k"]);
  });
  it("user ownership with group", () => {
    expect([
      ...freeVariables("user.books_by_editor.map(b=>b.id).includes(id)"),
    ]).toContain("user.books_by_editor");
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
    expect(jsexprToSQL("foo==4")).toEqual("(foo)=(4)");
  });
  it("translates string equality", () => {
    expect(jsexprToSQL('foo=="bar"')).toEqual("(foo)=('bar')");
    expect(jsexprToSQL('foo!="bar"')).toEqual("(foo)!=('bar')");
    expect(jsexprToSQL('!(foo=="bar")')).toEqual("not ((foo)=('bar'))");
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
  it("translates and", () => {
    expect(jsexprToSQL("foo==true && x==2")).toEqual(
      "(foo is true)and((x)=(2))"
    );
  });
  it("translates something mildly complex", () => {
    expect(jsexprToSQL('!(name==="roderick" && phone==null)')).toEqual(
      "not (((name)=('roderick'))and(phone is null))"
    );
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
  /* TODO

  it("double exclamation", () => {
    const w = jsexprToWhere("!!group", {});
    console.log(w);
    
    expect(w).toEqual({ not: { group: null } });

    const { where } = mkWhere(w);
    expect(where).toEqual('where not ("group" is null)');
  }); */
  it("translates greater than", () => {
    expect(jsexprToWhere("foo>4")).toEqual({ foo: { gt: 4 } });
  });
  it("translates lte", () => {
    expect(jsexprToWhere("foo<=4")).toEqual({ foo: { lt: 4, equal: true } });
  });
  it("translates join field", async () => {
    const books = Table.findOne({ name: "books" });
    const fields = books?.getFields();
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
  it("translates double join field", async () => {
    const patients = Table.findOne({ name: "patients" });
    expect(
      jsexprToWhere("favbook.publisher.name=='AK Press'", {}, patients?.fields)
    ).toEqual({
      favbook: {
        inSelect: {
          field: "publisher",
          table: "books",
          tenant: "public",
          through: "publisher",
          through_pk: "id",
          valField: "id",
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
  it("jsexprToWhere equate constant", () => {
    expect(
      jsexprToWhere("user.clearance==5", { user: { clearance: 5 } })
    ).toEqual({ eq: [5, 5] });
    expect(
      jsexprToWhere('user.clearance=="ALL"', { user: { clearance: "ALL" } })
    ).toEqual({ eq: ["ALL", "ALL"] });
    expect(
      jsexprToWhere("user.clearance==5", { user: { clearance: 6 } })
    ).toEqual({ eq: [6, 5] });
    expect(
      jsexprToWhere('user.clearance=="ALL"', { user: { clearance: "NONE" } })
    ).toEqual({ eq: ["NONE", "ALL"] });
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
