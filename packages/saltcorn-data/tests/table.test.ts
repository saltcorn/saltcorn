import Table from "../models/table";
import TableConstraint from "../models/table_constraints";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import { writeFile } from "fs/promises";
import mocks from "./mocks";
const { rick_file, plugin_with_routes, mockReqRes, createDefaultView } = mocks;
import {
  assertIsSet,
  assertsIsSuccessMessage,
  assertIsErrorMsg,
  assertIsType,
} from "./assertions";
import { afterAll, describe, it, expect, beforeAll, jest } from "@jest/globals";
import {
  add_free_variables_to_joinfields,
  stateFieldsToQuery,
  stateFieldsToWhere,
} from "../plugin-helper";
import expressionModule from "../models/expression";
import { Row, sqlBinOp, sqlFun, Where } from "@saltcorn/db-common/internal";
import { ResultMessage } from "@saltcorn/types/common_types";
const { freeVariables, jsexprToWhere, add_free_variables_to_aggregations } =
  expressionModule;
import { runWithTenant } from "@saltcorn/db-common/multi-tenant";

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
jest.setTimeout(30000);

describe("TableIO", () => {
  it("should store attributes", async () => {
    const tc = await Table.create("mytesttable");
    await Field.create({
      table: tc,
      name: "foo_height1",
      label: "height1",
      type: "Integer",
      attributes: { max: 18 },
    });
    const fs = await db.selectOne("_sc_fields", { name: "foo_height1" });
    expect(fs.table_id).toBe(tc.id);
    expect(fs.table_id > 0).toBe(true);
    expect(fs.id > 0).toBe(true);
    const fields = await tc.getFields();
    expect(fields[1].attributes).toStrictEqual({ max: 18 });
  });
});
describe("Table create basic tests", () => {
  it("should create", async () => {
    const tc = await Table.create("mytable1");
    const tf = Table.findOne({ id: tc.id });
    assertIsSet(tf);
    expect(tf.external).toBe(false);
    expect(tc.external).toBe(false);
    expect(tf.name).toStrictEqual("mytable1");
    expect(tf.sql_name).toStrictEqual(
      db.isSQLite ? '"mytable1"' : '"public"."mytable1"'
    );
  });
  it("toggle bools", async () => {
    const tc = await Table.create("mytable17");

    await Field.create({
      table: tc,
      label: "Group",
      type: "Bool",
      required: true,
    });
    const tall_id = await tc.insertRow({ group: true });
    await tc.toggleBool(tall_id, "group");
    const row = await tc.getRow({ id: tall_id });
    assertIsSet(row);
    expect(row.group).toBe(false);
  });
  it("observe field min_role_write", async () => {
    const tc = await Table.create("mytable177", {
      min_role_read: 100,
      min_role_write: 100,
    });

    await Field.create({
      table: tc,
      label: "Group",
      type: "Bool",
      attributes: { min_role_write: 40 },
    });

    const err = await tc.insertRow({ group: true }, { role_id: 80 });
    expect(err).toBe("Not authorized");
    expect(await tc.countRows()).toBe(0);
    const tall_id = await tc.insertRow({ group: true }, { role_id: 20 });
    expect(tall_id).toBe(1);
    const ures = await tc.updateRow({ group: false }, tall_id, { role_id: 80 });
    expect(ures).toBe("Not authorized");
    const tall = await tc.getRow({ id: tall_id });
    expect(tall?.group).toBe(true);
  });
  it("should create required field in empty table without default", async () => {
    const mytable1 = Table.findOne({ name: "mytable1" });
    expect(!!mytable1).toBe(true);
    await Field.create({
      table: mytable1,
      name: "height1",
      label: "height1",
      type: "Integer",
      required: true,
    });
  });
  it("should insert", async () => {
    const mytable1 = Table.findOne({ name: "mytable1" });
    assertIsSet(mytable1);
    expect(mytable1.name).toBe("mytable1");
    const id = await db.insert(mytable1.name, { height1: 6 });
    expect(typeof id).toBe("number");
    expect(id > 0).toBe(true);

    const row = await db.selectOne(mytable1.name, { id });
    expect(row.height1).toBe(6);
    await db.update(mytable1.name, { height1: 7 }, id);
    const rowup = await db.selectOne(mytable1.name, { id });
    expect(rowup.height1).toBe(7);
  });
  it("should select one or zero", async () => {
    const rows = await db.select("mytable1", {});
    expect(rows.length).toBe(1);
    const row = await db.selectMaybeOne("mytable1", { id: rows[0].id });
    expect(row.height1).toBe(7);
    const norow = await db.selectMaybeOne("mytable1", { id: 789 });
    expect(norow).toBe(null);
    await expect(
      (async () => await db.selectOne("mytable1", { id: 789 }))()
    ).rejects.toThrow();
  });
  it("should get distinct values", async () => {
    const table = Table.findOne({ name: "mytable1" });
    assertIsSet(table);
    const vs = await table.distinctValues("height1");
    expect(vs).toEqual([7]);
  });
  it("should delete rows", async () => {
    const table = Table.findOne({ name: "mytable1" });
    assertIsSet(table);
    let rows = await table.getRows();
    expect(rows.length).toBe(1);
    await db.deleteWhere(table.name, { height1: { in: [6, 8, 9] } });
    rows = await table.getRows();
    expect(rows.length).toBe(1);
    await db.deleteWhere(table.name, { height1: { not: { in: [6, 8, 9] } } });
    rows = await table.getRows();
    expect(rows.length).toBe(0);
  });
  it("should count limited rows", async () => {
    const table = Table.findOne({ name: "mytable1" });
    assertIsSet(table);
    await table.insertRow({ height1: 1 });
    await table.insertRow({ height1: 1 });
    await table.insertRow({ height1: 1 });
    await table.insertRow({ height1: 1 });
    await table.insertRow({ height1: 2 });
    await table.insertRow({ height1: 3 });
    await table.insertRow({ height1: 4 });
    await table.insertRow({ height1: 5 });
    await table.insertRow({ height1: 6 });
    expect(await table.countRows({})).toBe(9);
    expect(await table.countRows({ height1: 1 })).toBe(4);
    expect(await table.countRows({}, { limit: 5 })).toBe(5);
    expect(await table.countRows({}, { limit: 500 })).toBe(9);
    expect(await table.countRows({ height1: 1 }, { limit: 3 })).toBe(3);
    expect(await table.countRows({ height1: 1 }, { limit: 100 })).toBe(4);
  });
  it("should delete", async () => {
    const table = Table.findOne({ name: "mytable1" });
    assertIsSet(table);
    await table.delete();
    const table1 = await Table.find({ name: "mytable1" });
    expect(table1.length).toBe(0);
  });
});

describe("Table get data", () => {
  it("should get rows", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const all = await patients.getRows();
    expect(all.length).toStrictEqual(2);
  });
  it("should get rows where name is Michael", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getRows({ name: "Michael Douglas" });
    assertIsSet(michaels);
    expect(michaels.length).toStrictEqual(1);
  });
  it("should get limited rows", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getRows(
      { name: { ilike: "Douglas" } },
      { limit: 1, orderBy: "id", offset: 1 }
    );
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].name).toStrictEqual("Michael Douglas");
  });
  it("should get rows by expanded key", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getRows({ favbook: 1 });
    expect(michaels.length).toStrictEqual(1);
    //expect(michaels[0].name).toStrictEqual("Michael Douglas");
    const michaels1 = await patients.getRows({ favbook: { id: 1 } });
    expect(michaels1.length).toStrictEqual(1);
    expect(michaels1[0].name).toStrictEqual(michaels[0].name);
  });
  it("should get by regex", async () => {
    if (!db.isSQLite) {
      const patients = Table.findOne({ name: "patients" });
      assertIsSet(patients);
      const michaels = await patients.getRows(
        { name: /ouglas/ },
        { limit: 1, orderBy: "id", offset: 1 }
      );
      expect(michaels.length).toStrictEqual(1);
      expect(michaels[0].name).toStrictEqual("Michael Douglas");
    }
  });
  it("should get rows by slug", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const all = await books.getRows({
      author: { slugify: "herman-melville" },
    });
    expect(all.length).toStrictEqual(1);
    expect(all[0].pages).toStrictEqual(967);
  });
  it("should get joined rows where name is Michael", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      where: { name: "Michael Douglas" },
    });
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].favbook).toBe(2);
  });
  it("should get joined rows where name is not null", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const nameds = await patients.getJoinedRows({
      where: { not: { name: null } },
    });
    expect(nameds.length).toStrictEqual(2);
  });
  it("should get rows in id range", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const rows = await patients.getRows({ id: [{ gt: 0 }, { lt: 10 }] });
    expect(rows.length).toStrictEqual(2);
  });
  it("should get rows by subselect", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const nrows = await books.countRows({
      id: {
        inSelect: {
          table: "patients",
          field: "favbook",
          where: { author: "Leo Tolstoy" },
        },
      },
    });
    expect(nrows).toStrictEqual(1);
  });

  it("should get joined rows with limit and order", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id",
    });
    expect(all.length).toStrictEqual(2);
    expect(all[1].favbook).toBe(2);
  });
  it("should get joined rows with limit and desc order", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id",
      orderDesc: true,
    });
    expect(all.length).toStrictEqual(2);
    expect(all[0].favbook).toBe(2);
  });
  it("should get joined rows with aggregations", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const arg = {
      orderBy: "id",
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg",
        },
      },
    };
    const michaels = await patients.getJoinedRows(arg);
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].avg_temp)).toBe(38);
    const { sql } = await patients.getJoinedQuery(arg);
    const schema = db.isSQLite ? "" : `"public".`;
    expect(sql).toBe(
      `SELECT a."favbook",a."id",a."name",a."parent",(select avg("temperature") from ${schema}"readings"  where "patient_id"=a."id") avg_temp FROM ${schema}"patients" a    order by "a"."id"`
    );
  });
  it("should get joined rows with limited fields", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const arg = {
      orderBy: "id",
      fields: ["id", "name"],
    };
    const { sql } = await patients.getJoinedQuery(arg);
    const schema = db.isSQLite ? "" : `"public".`;
    expect(sql).toBe(
      `SELECT a."id",a."name" FROM ${schema}"patients" a    order by "a"."id"`
    );
  });
  it("should get joined rows with filtered aggregations", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg",
          where: { normalised: true },
        },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].avg_temp)).toBe(37);
  });
  it("should get joined rows with unique count aggregations", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        ntemps: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "CountUnique",
        },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].ntemps)).toBe(2);
  });
  it("should get fkey aggregations", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const arg = {
      orderBy: "id",
      aggregations: {
        fans: {
          table: "patients",
          ref: "favbook",
          field: "parent",
          aggregate: "array_agg",
        },
      },
    };

    const rows = await books.getJoinedRows(arg);
    expect(rows.length).toStrictEqual(2);
    expect(rows[1].fans).toStrictEqual(["Kirk Douglas"]);
    const { sql } = await books.getJoinedQuery(arg);
    if (!db.isSQLite)
      expect(sql).toBe(
        'SELECT a."author",a."id",a."pages",a."publisher",(select array_agg(aggjoin."name") from "public"."patients" aggto join "public"."patients" aggjoin on aggto."parent" = aggjoin.id  where aggto."favbook"=a."id") fans FROM "public"."books" a    order by "a"."id"'
      );
    else
      expect(sql).toBe(
        'SELECT a."author",a."id",a."pages",a."publisher",(select json_group_array(aggjoin."name") from "patients" aggto join "patients" aggjoin on aggto."parent" = aggjoin.id  where aggto."favbook"=a."id") fans FROM "books" a    order by "a"."id"'
      );
  });
  it("should get array aggregations", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const arg = {
      orderBy: "id",
      aggregations: {
        fans: {
          table: "patients",
          ref: "favbook",
          field: "name",
          aggregate: "array_agg",
        },
      },
    };

    const rows = await books.getJoinedRows(arg);
    expect(rows.length).toStrictEqual(2);
    expect(rows[1].fans).toStrictEqual(["Michael Douglas"]);

    const { sql } = await books.getJoinedQuery(arg);
    if (!db.isSQLite)
      expect(sql).toBe(
        'SELECT a."author",a."id",a."pages",a."publisher",(select array_agg("name") from "public"."patients"  where "favbook"=a."id") fans FROM "public"."books" a    order by "a"."id"'
      );
    else
      expect(sql).toBe(
        'SELECT a."author",a."id",a."pages",a."publisher",(select json_group_array("name") from "patients"  where "favbook"=a."id") fans FROM "books" a    order by "a"."id"'
      );
  });
  it("should get array aggregations with order", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const arg = {
      orderBy: "id",
      aggregations: {
        fans: {
          table: "patients",
          ref: "favbook",
          field: "name",
          aggregate: "array_agg",
          orderBy: "id",
        },
      },
    };

    const rows = await books.getJoinedRows(arg);
    expect(rows.length).toStrictEqual(2);
    expect(rows[1].fans).toStrictEqual(["Michael Douglas"]);

    const { sql } = await books.getJoinedQuery(arg);
    if (!db.isSQLite)
      expect(sql).toBe(
        'SELECT a."author",a."id",a."pages",a."publisher",(select array_agg("name" order by "id") from "public"."patients"  where "favbook"=a."id") fans FROM "public"."books" a    order by "a"."id"'
      );
    else
      expect(sql).toBe(
        'SELECT a."author",a."id",a."pages",a."publisher",(select json_group_array("name" order by "id") from "patients"  where "favbook"=a."id") fans FROM "books" a    order by "a"."id"'
      );
  });
  it("should get join-aggregations", async () => {
    //how many books has my publisher published
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    if (!db.isSQLite) {
      const rows = await books.getJoinedRows({
        orderBy: "id",
        aggregations: {
          publisher_books: {
            table: "books",
            ref: "publisher",
            field: "id",
            through: "publisher",
            aggregate: "count",
          },
        },
      });

      expect(rows.length).toStrictEqual(2);
      expect(rows[1].publisher_books).toBe("1"); // TODO why string
    }
  });
  it("should get joined rows with latest aggregations", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        last_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "Latest date",
        },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].last_temp)).toBe(37);
  });
  it("should get from and of ors where formula", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const rows = await books.getJoinedRows({
      where: jsexprToWhere(
        '(author == "Leo Tolstoy" && pages ==728) || (author=="Newsome" && pages == 345)'
      ),
    });

    expect(rows.length).toStrictEqual(1);
    expect(rows[0].pages).toBe(728); // TODO why string
  });
  it("should get joined rows with earliest aggregations", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        last_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "Earliest date",
        },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].last_temp)).toBe(37);
  });
  it("should get double joined rows", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const reads = await readings.getJoinedRows({
      orderBy: "id",
      joinFields: {
        author: { ref: "patient_id", through: "favbook", target: "author" },
      },
    });
    expect(reads.length).toStrictEqual(3);
    expect(reads[0].author).toBe("Herman Melville");
  });
  it("should get triple joined rows", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const reads = await readings.getJoinedRows({
      orderBy: "id",
      joinFields: {
        publisher: {
          ref: "patient_id",
          through: ["favbook", "publisher"],
          target: "name",
        },
      },
    });
    expect(reads.length).toStrictEqual(3);
    //expect(reads[0].name).toBe("AK Press");
    expect(reads[2].publisher).toBe("AK Press");
  });
  it("should rename joined rows signly", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const pats = await patients.getJoinedRows({
      orderBy: "id",
      joinFields: {
        favbook_author: {
          ref: "favbook",
          target: "author",
          rename_object: ["favbook", "author"],
        },
      },
    });
    expect(pats.length).toStrictEqual(2);
    expect(pats[0].favbook.author).toBe("Herman Melville");
    expect(pats[0].favbook.id).toBe(1);
  });
  it("should rename joined rows doubly", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const reads = await readings.getJoinedRows({
      orderBy: "id",
      joinFields: {
        favbook_author: {
          ref: "patient_id",
          through: "favbook",
          target: "author",
          rename_object: ["patient_id", "favbook", "author"],
        },
      },
    });
    expect(reads.length).toStrictEqual(3);
    expect(reads[0].patient_id.favbook.author).toBe("Herman Melville");
  });
  it("should get joined rows with aggregations and joins", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg",
        },
      },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].avg_temp)).toBe(38);
    expect(michaels[1].author).toBe("Leo Tolstoy");
  });
  it("should get percent true aggregations", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        pcnt_norm: {
          table: "readings",
          ref: "patient_id",
          field: "normalised",
          aggregate: "Percent true",
        },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].pcnt_norm)).toBe(50);
    expect(Math.round(michaels[1].pcnt_norm)).toBe(0);
  });

  it("should support full text search", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const fields = table.getFields();
    const rows = await db.select("patients", {
      _fts: { fields, searchTerm: "Douglas" },
    });

    expect(rows.length).toBe(2);
  });
  it("should get rows from full text search with key summary", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const fields = table.getFields();

    const rows = await table.getRows({
      _fts: { fields, searchTerm: "Herman" },
    });

    expect(rows.length).toBe(1);
  });
  it("should get joined rows from full text search with key summary", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const fields = table.getFields();
    const where = stateFieldsToWhere({
      fields,
      state: { _fts_patients: "Herman" },
      table,
      prefix: "a.",
    });
    const rows = await table.getJoinedRows({
      where,
    });

    expect(rows.length).toBe(1);
  });
  it("should count rows from full text search with key summary", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const fields = table.getFields();
    const where = stateFieldsToWhere({
      fields,
      state: { _fts_patients: "Herman" },
      table,
    });
    const nrows = await table.countRows(where);

    expect(nrows).toBe(1);
  });

  it("should support full text search with calculated", async () => {
    const table = await Table.create("ftstesttable");
    await Field.create({
      table,
      label: "name",
      type: "String",
      required: true,
    });
    await Field.create({
      table,
      label: "shortname",
      type: "String",
      calculated: true,
      expression: "name.substr(0,4)",
      required: true,
    });
    await table.insertRow({ name: "Alexander" });
    const rows = await table.getRows({
      _fts: { fields: table.fields, searchTerm: "Alexander" },
    });

    expect(rows.length).toBe(1);
  });

  it("should rename", async () => {
    const table = await Table.create("notsurename");
    await Field.create({
      table,
      label: "tall",
      type: "Bool",
      required: true,
    });
    const table1 = await Table.create("refsunsure");
    await Field.create({
      table: table1,
      label: "also_tall",
      type: "Bool",
      required: true,
    });
    await Field.create({
      table: table1,
      label: "theref",
      type: "Key to notsurename",
      required: true,
    });
    const id = await table.insertRow({ tall: false });
    await table1.insertRow({ also_tall: true, theref: id });
    const joinFields = { reftall: { ref: "theref", target: "tall" } };
    const rows = await table1.getJoinedRows({ joinFields });
    expect(rows[0].theref).toBe(id);
    expect(!!rows[0].reftall).toBe(false); //for sqlite
    if (!db.isSQLite) {
      await table.rename("isthisbetter");
      const table3 = Table.findOne({ name: "refsunsure" });
      assertIsSet(table3);
      const rows1 = await table3.getJoinedRows({ joinFields });
      expect(rows1[0].theref).toBe(id);
      expect(rows1[0].reftall).toBe(false);
      const table2 = Table.findOne({ name: "isthisbetter" });
      assertIsSet(table2);
      expect(!!table2).toBe(true);
      table2.versioned = true;
      await table2.update(table2);
      await table2.rename("thisisthebestname");
    }
  });
  it("should get joined rows with arbitrary fieldnames", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      where: { name: "Michael Douglas" },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].pages).toBe(728);
    expect(michaels[0].author).toBe("Leo Tolstoy");
  });
  it("should get joined rows with one-to-one relations", async () => {
    const ratings = await Table.create("myreviews");
    assertIsSet(ratings);
    await Field.create({
      name: "book",
      label: "Book",
      type: "Key to books",
      is_unique: true,
      table: ratings,
    });
    await Field.create({
      name: "rating",
      label: "Rating",
      type: "Integer",
      table: ratings,
    });
    await ratings.insertRow({ book: 1, rating: 7 });
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    //db.set_sql_logging();
    const reads = await books.getJoinedRows({
      orderBy: "id",
      where: { author: "Herman Melville" },
      joinFields: {
        rating: { ref: "book", ontable: "myreviews", target: "rating" },
      },
    });
    expect(reads.length).toStrictEqual(1);
    expect(reads[0].rating).toBe(7);
    expect(reads[0].author).toBe("Herman Melville");
    expect(reads[0].pages).toBe(967);
  });
  it("should get null bools", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const id = await readings.insertRow({
      temperature: 38,
      normalised: null,
      patient_id: 1,
      date: new Date(),
    });
    const rows = await readings.getJoinedRows({ where: { id } });
    expect(rows[0].normalised).toBe(null);
    const rows1 = await readings.getRows({ id });
    expect(rows1[0].normalised).toBe(null);
    await readings.deleteRows({ id });
  });
});
describe("Table sorting", () => {
  const getPagesWithOrder = async (selopts: any) => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const all = await books.getRows({}, selopts);
    return all.map((b) => b.pages);
  };

  it("should get rows", async () => {
    const ps1 = await getPagesWithOrder({ orderBy: "pages" });
    expect(ps1).toStrictEqual([728, 967]);
    const ps2 = await getPagesWithOrder({ orderBy: "pages", orderDesc: true });
    expect(ps2).toStrictEqual([967, 728]);
  });
  it("should use operator", async () => {
    const ps1 = await getPagesWithOrder({
      orderBy: {
        operator: sqlFun("ABS", sqlBinOp("-", "target", "field")),
        target: 950,
        field: "pages",
      },
    });
    expect(ps1).toStrictEqual([967, 728]);
    const ps2 = await getPagesWithOrder({
      orderBy: {
        operator: sqlFun("ABS", sqlBinOp("-", "target", "field")),
        target: 750,
        field: "pages",
      },
    });
    expect(ps2).toStrictEqual([728, 967]);
  });
  it("should use operator by name", async () => {
    const ps1 = await getPagesWithOrder({
      orderBy: {
        operator: "near",
        target: 950,
        field: "pages",
      },
    });
    expect(ps1).toStrictEqual([967, 728]);
    const ps2 = await getPagesWithOrder({
      orderBy: {
        operator: "near",
        target: 750,
        field: "pages",
      },
    });
    expect(ps2).toStrictEqual([728, 967]);
  });
  it("should read with stateFieldsToQuery", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const q = stateFieldsToQuery({
      state: { _foo_sortby: "pages" },
      stateHash: "foo",
      fields: books.fields,
    });
    expect(q).toStrictEqual({ orderBy: "pages" });
  });
  it("should use operators from stateFieldsToQuery", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const q = stateFieldsToQuery({
      state: { _op_pages_near: "950" },
      stateHash: "foo",
      fields: books.fields,
    });
    expect(q).toStrictEqual({
      orderBy: {
        operator: sqlFun("ABS", sqlBinOp("-", "target", "field")),
        target: "950",
        field: "pages",
      },
    });
  });
  it("should use operators from stateFieldsToQuery from _orderBy", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const q = stateFieldsToQuery({
      state: { _orderBy: { operator: "near", field: "pages", target: 950 } },
      stateHash: "foo",
      fields: books.fields,
    });
    expect(q).toStrictEqual({
      orderBy: {
        operator: sqlFun("ABS", sqlBinOp("-", "target", "field")),
        target: 950,
        field: "pages",
      },
    });
  });
  it("should sort by joinfield", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "pages",
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg",
        },
      },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(michaels[1].author).toBe("Herman Melville");
    const michaelsDesc = await patients.getJoinedRows({
      orderBy: "pages",
      orderDesc: true,
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg",
        },
      },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaelsDesc.length).toStrictEqual(2);
    expect(michaelsDesc[1].author).toBe("Leo Tolstoy");
  });
  it("should sort by aggregation", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const michaels = await patients.getJoinedRows({
      orderBy: "avg_temp",
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg",
        },
      },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(+michaels[1].avg_temp).toBeGreaterThan(37.5);
    const michaelsDesc = await patients.getJoinedRows({
      orderBy: "avg_temp",
      orderDesc: true,
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg",
        },
      },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaelsDesc.length).toStrictEqual(2);
    expect(+michaelsDesc[1].avg_temp).toBeLessThan(37.5);
  });
});
describe("Table aggregationQuery", () => {
  it("should get avg aggregations", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const aggs = await readings.aggregationQuery({
      avg_temp: {
        field: "temperature",
        aggregate: "avg",
      },
    });
    expect(Math.round(aggs.avg_temp)).toBe(38);
  });
  it("should get filtered avg aggregations", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const aggs = await readings.aggregationQuery(
      {
        avg_temp: {
          field: "temperature",
          aggregate: "avg",
        },
      },
      { where: { normalised: true } }
    );
    expect(Math.round(aggs.avg_temp)).toBe(37);
  });
  it("should get percent true aggregations", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const aggs = await readings.aggregationQuery({
      pcnt_norm: {
        field: "normalised",
        aggregate: "Percent true",
      },
    });
    expect(Math.round(aggs.pcnt_norm)).toBe(33);
  });
  it("should get array aggregations", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    if (!db.isSQLite) {
      const aggs = await readings.aggregationQuery({
        ids: {
          field: "id",
          aggregate: "array_agg",
        },
      });
      expect(aggs.ids).toStrictEqual([1, 2, 3]);
    }
  });
  it("should get filtered array aggregations", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    if (!db.isSQLite) {
      const aggs = await readings.aggregationQuery(
        {
          ids: {
            field: "id",
            aggregate: "array_agg",
          },
        },
        { where: { normalised: true } }
      );
      expect(aggs.ids).toStrictEqual([1]);
    }
  });
  it("should get grouped aggregations", async () => {
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    if (!db.isSQLite) {
      const aggs = await readings.aggregationQuery(
        {
          temps: {
            field: "id",
            aggregate: "count",
          },
        },
        { groupBy: ["patient_id"] }
      );
      expect(aggs).toStrictEqual([
        { patient_id: 2, temps: "1" },
        { patient_id: 1, temps: "2" },
      ]);
    }
  });
  it("sets up new fields", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    await Field.create({
      table,
      name: "published",
      label: "Published",
      type: "Date",
    });

    await table.updateRow({ published: new Date("1971-05.04") }, 1);
    await table.updateRow({ published: new Date("1972-05.04") }, 2);
  });
  it("should get latest by field", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    if (!db.isSQLite) {
      const aggs = await books.aggregationQuery({
        pages: {
          field: "pages",
          aggregate: "Latest published",
        },
      });
      expect(aggs).toStrictEqual({ pages: 728 });
    }
  });
  it("should get latest by field, qualified", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    if (!db.isSQLite) {
      const aggs = await books.aggregationQuery(
        {
          pages: {
            field: "pages",
            aggregate: "Latest published",
          },
        },
        { where: { author: "Herman Melville" } }
      );
      expect(aggs).toStrictEqual({ pages: 967 });
    }
  });
  it("should get latest by field, grouped", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    if (!db.isSQLite) {
      const aggs = await books.aggregationQuery(
        {
          pages: {
            field: "pages",
            aggregate: "Latest published",
          },
        },
        { groupBy: "author" }
      );
      expect(aggs).toStrictEqual([
        { author: "Leo Tolstoy", pages: 728 },
        { author: "Herman Melville", pages: 967 },
      ]);
    }
  });
  it("should get latest by field, grouped and qualified", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    if (!db.isSQLite) {
      const aggs = await books.aggregationQuery(
        {
          pages: {
            field: "pages",
            aggregate: "Latest published",
          },
        },
        { groupBy: "author", where: { author: "Herman Melville" } }
      );
      expect(aggs).toStrictEqual([{ author: "Herman Melville", pages: 967 }]);
    }
  });
});

describe("relations", () => {
  it("get parent relations", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const rels = await table.get_parent_relations();
    expect(rels.parent_field_list).toContain("favbook.author");
    expect(rels.parent_relations.length).toBe(2);
  });

  it("get parent relations with one-to-one", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const rels = await table.get_parent_relations();
    const expected = [
      "publisher.id",
      "publisher.name",
      "myreviews.book->book",
      "myreviews.book->id",
      "myreviews.book->rating",
    ];
    expect(rels.parent_field_list).toHaveLength(expected.length);
    expect(rels.parent_field_list).toEqual(expect.arrayContaining(expected));
  });
  it("get child relations", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const rels = await table.get_child_relations();
    const expected = [
      "myreviews.book",
      "discusses_books.book",
      "patients.favbook",
    ];
    expect(rels.child_field_list).toHaveLength(expected.length);
    expect(rels.child_field_list).toEqual(expect.arrayContaining(expected));
    expect(rels.child_relations.length).toBe(3);
  });
  it("get child relations with join", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const rels = await table.get_child_relations(true);
    const expected = [
      "myreviews.book",
      "discusses_books.book",
      "patients.favbook",
      "publisher->books.publisher",
    ];
    expect(rels.child_field_list).toHaveLength(expected.length);
    expect(rels.child_field_list).toEqual(expect.arrayContaining(expected));
    expect(rels.child_relations.length).toBe(4);
  });
  it("get grandparent relations", async () => {
    const table = Table.findOne({ name: "readings" });
    assertIsSet(table);
    const rels = await table.get_parent_relations(true);

    expect(rels.parent_field_list.length).toBeGreaterThan(10);
    expect(rels.parent_field_list).toContain("patient_id.favbook.publisher");
    expect(rels.parent_field_list).toContain("patient_id.name");
    expect(rels.parent_relations.length).toBe(3);
  });
  it("get triple relations", async () => {
    const table = Table.findOne({ name: "readings" });
    assertIsSet(table);
    const rels = await table.get_parent_relations(true, true);

    expect(rels.parent_field_list.length).toBeGreaterThan(10);
    expect(rels.parent_field_list).toContain(
      "patient_id.parent.favbook.author"
    );
    expect(rels.parent_field_list).toContain(
      "patient_id.favbook.publisher.name"
    );
    expect(rels.parent_field_list).toContain("patient_id.favbook.author");
    expect(rels.parent_field_list).toContain("patient_id.name");
    expect(rels.parent_relations.length).toBe(3);
  });
});

describe("CSV import", () => {
  it("should import into existing table", async () => {
    const csv = `author,Pages
Joe Celko, 856
Gordon Kane, 217`;
    const fnm = "/tmp/test1ok.csv";
    await writeFile(fnm, csv);
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({
      success: "Imported 2 rows into table books",
      details: "",
    });
    const rows = await table.getRows({ author: "Gordon Kane" });
    expect(rows.length).toBe(1);
    expect(rows[0].pages).toBe(217);
  });
  it("should ignore extra cols when importing", async () => {
    const csv = `author,Pages,Pages1,citations
William H Press, 852,7,100
Peter Rossi, 212,9,200`;
    const fnm = "/tmp/test1ok.csv";
    await writeFile(fnm, csv);
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({
      success: "Imported 2 rows into table books",
      details: "",
    });
    const rows = await table.getRows({ author: "Peter Rossi" });

    expect(rows.length).toBe(1);
    expect(rows[0].pages).toBe(212);
  });
  it("should replace when id given", async () => {
    const csv = `id,author,Pages
1, Noam Chomsky, 540
17, David Harvey, 612`;
    const fnm = "/tmp/testreplaceid.csv";
    await writeFile(fnm, csv);
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    expect(!!table).toBe(true);
    const rowsBefore = await table.countRows();
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({
      success: "Imported 2 rows into table books",
      details: "",
    });
    const rowsAfter = await table.countRows();
    expect(rowsAfter).toBe(rowsBefore + 1);
    const row = await table.getRow({ id: 1 });
    expect(row?.pages).toBe(540);
    await table.updateRow({ author: "Herman Melville" }, 1);
  });
  it("should replace when id given in preview", async () => {
    const csv = `id,author,Pages
1, Noam Chomsky, 540
18, Cornel West, 678`;
    const fnm = "/tmp/testreplaceid.csv";
    await writeFile(fnm, csv);
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm, { no_table_write: true });
    assertsIsSuccessMessage(impres);

    const rows = impres.rows;
    assertIsSet(rows);
    expect(rows.length).toBe(2);
    const row = rows.find((r: any) => r.id == 1);
    expect(row?.pages).toBe(540);
    expect(row.author).toBe("Noam Chomsky");
    const row1 = rows.find((r: any) => r.id == 18);
    expect(row1?.pages).toBe(678);

    const rowDB = await table.getRow({ id: 1 });
    assertIsSet(rowDB);
    expect(rowDB.author).toBe("Herman Melville");
  });
  it("should insert on missing id when blank", async () => {
    const csv = `id,author,Pages
1, Noam Chomsky, 541
,Hadas Thier, 250`;
    const fnm = "/tmp/testmixedid.csv";
    await writeFile(fnm, csv);
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const impres = await table.import_csv_file(fnm, { no_table_write: true });
    assertsIsSuccessMessage(impres);

    const rows = impres.rows;
    assertIsSet(rows);
    expect(rows.length).toBe(2);

    await table.import_csv_file(fnm);

    const rowDB = await table.getRow({ id: 1 });
    assertIsSet(rowDB);
    expect(rowDB.author).toBe("Noam Chomsky");
    expect(rowDB.pages).toBe(541);
    const rowDB2 = await table.getRow({ author: "Hadas Thier" });
    assertIsSet(rowDB2);
    expect(rowDB2.pages).toBe(250);

    await table.updateRow({ author: "Herman Melville" }, 1);
  });
  it("fail on required field", async () => {
    const csv = `author,Pagez
Joe Celko, 856
Gordon Kane, 217`;
    const fnm = "/tmp/test1f.csv";
    await writeFile(fnm, csv);
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({ error: "Required field missing: Pages" });
  });
  it("fail on strings in ints", async () => {
    const csv = `author,Pages
Leonardo Boff, 99
David MacKay, ITILA`;
    const fnm = "/tmp/test1.csv";
    await writeFile(fnm, csv);
    const table = await Table.create("books_not_req_pages", {
      min_role_read: 100,
    });
    await Field.create({
      table,
      name: "author",
      label: "Author",
      type: "String",
      required: true,
    });
    await Field.create({
      table,
      name: "pages",
      label: "Pages",
      type: "Integer",
      attributes: { min: 0 },
    });
    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({
      success:
        "Imported 1 rows into table books_not_req_pages. Rejected 1 rows.",
      details:
        "Reject row 3 because: No valid value for required field pages. \n",
    });
    const rows = await table.getRows({ author: "David MacKay" });
    expect(rows.length).toBe(0);
  });

  it("CSV import fkeys as ints", async () => {
    const table = await Table.create("book_reviews", {
      min_role_read: 100,
    });
    await Field.create({
      table,
      name: "review",
      label: "Review",
      type: "String",
      required: true,
    });
    await Field.create({
      table,
      name: "author",
      label: "Author",
      type: "Key to books",
      attributes: { summary_field: "author" },
    });
    const csv = `author,review
1, Awesome
2, Stunning`;
    const fnm = "/tmp/test1.csv";
    await writeFile(fnm, csv);

    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({
      success: "Imported 2 rows into table book_reviews",
      details: "",
    });
    const row = await table.getRow({ review: "Awesome" });
    expect(row?.author).toBe(1);
  });
  it("CSV import fkeys as summary fields", async () => {
    const table = Table.findOne({ name: "book_reviews" });
    assertIsSet(table);
    const csv = `author,review
Leo Tolstoy, "Funny
as hell",  
Herman Melville, Whaley`;
    const fnm = "/tmp/test1.csv";
    await writeFile(fnm, csv);

    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({
      success: "Imported 2 rows into table book_reviews",
      details: "",
    });

    const row = await table.getRow({ review: "Funny\nas hell" });
    expect(row?.author).toBe(2);
  });
  it("CSV import fkeys as summary fields gives error message ", async () => {
    const table = Table.findOne({ name: "book_reviews" });
    assertIsSet(table);
    const csv = `author,review
    China Mieville, Scar`;
    const fnm = "/tmp/test1.csv";
    await writeFile(fnm, csv);

    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({
      success: "Imported 0 rows into table book_reviews. Rejected 1 rows.",
      details:
        'Reject row 2 because in field author value "China Mieville" not matched by a value in table books field author.\n',
    });
  });

  it("should create by importing", async () => {
    //db.set_sql_logging();
    const csv = `item,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2impok.csv";
    await writeFile(fnm, csv);
    const result = await Table.create_from_csv("Invoice", fnm);
    assertsIsSuccessMessage(result);
    const { table }: { table?: Table } = result;
    assertIsSet(table);
    const fields = table.getFields();
    const vatField = fields.find((f) => f.name === "vatable");
    assertIsSet(vatField);
    assertIsType(vatField.type);
    expect(vatField.type.name).toBe("Bool");
    const costField = fields.find((f) => f.name === "cost");
    assertIsSet(costField);
    assertIsType(costField.type);
    expect(costField.type.name).toBe("Float");
    const countField = fields.find((f) => f.name === "count");
    assertIsSet(countField);
    assertIsType(countField.type);
    expect(countField.type.name).toBe("Integer");
    const rows = await table.getRows({ item: "Pencil" });
    expect(rows.length).toBe(1);
    expect(rows[0].vatable).toBe(true);
    const allrows = await table.getRows();
    expect(allrows.length).toBe(2);
  });
  it("should fail on bad col nm", async () => {
    const csv = `item,cost,!, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice1", fnm);
    expect(res).toEqual({
      error: "Invalid column name ! - Use A-Z, a-z, 0-9, _ only",
    });
    const table = Table.findOne({ name: "Invoice1" });
    expect(table).toBe(null);
  });
  it("ignores a col on duplicate col nm", async () => {
    const csv = `item,cost,cost, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice1", fnm);
    assertsIsSuccessMessage(res);
    expect(res.table.fields.length).toEqual(4); //and id
  });
  if (!db.isSQLite) {
    it("should succeed on string pk", async () => {
      const csv = `id,cost,somenum, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
      const fnm = "/tmp/test2.csv";
      await writeFile(fnm, csv);
      const res = await Table.create_from_csv("Invoice2", fnm);
      assertsIsSuccessMessage(res);
      expect(res.table.fields.length).toEqual(4); // incl id
      const pk = res.table.fields.find((f: Field) => f.primary_key);
      assertIsSet(pk);
      expect(pk.name).toBe("id");
      expect(pk.type.name).toBe("String");
      expect(res.details).not.toContain("Reject");
      const table = Table.findOne({ name: "Invoice2" });
      assertIsSet(table);
      const rows = await table.getRows();
      expect(rows.length).toBe(2);
    });
    it("should succeed on uuid pk", async () => {
      await db.query('create extension if not exists "uuid-ossp";');

      getState().registerPlugin("mock_plugin", plugin_with_routes());
      const csv = `id,cost,somenum, vatable
179f7e88-ae48-495e-a080-68c471fac2ac, 5,4, f
d1403829-cc1e-49b5-bcdc-488973e640ba, 0.5,2, t`;
      const fnm = "/tmp/test2.csv";
      await writeFile(fnm, csv);
      const res = await Table.create_from_csv("InvoiceCsvUUID", fnm);
      assertsIsSuccessMessage(res);
      expect(res.table.fields.length).toEqual(4); // incl id
      const pk = res.table.fields.find((f: Field) => f.primary_key);
      assertIsSet(pk);
      expect(pk.name).toBe("id");
      expect(pk.type.name).toBe("UUID");
      expect(res.details).not.toContain("Reject");
      const table = Table.findOne({ name: "InvoiceCsvUUID" });
      assertIsSet(table);
      const rows = await table.getRows();
      expect(rows.length).toBe(2);
    });
  }
  it("should fail missing id", async () => {
    const csv = `id,cost,!, vatable
1, 5,4, f
, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice3", fnm);
    expect(res).toEqual({
      error: `Columns named "id" must not have missing values`,
    });
    const table = Table.findOne({ name: "Invoice3" });
    expect(table).toBe(null);
  });
  it("should succeed on good id", async () => {
    const csv = `id,cost,count, vatable
1, 5,4, f
2, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice3", fnm);
    assertsIsSuccessMessage(res);
    expect(res.table.fields.length).toEqual(4); // incl id
    const table = Table.findOne({ name: "Invoice3" });
    assertIsSet(table);
    const rows = await table.getRows();
    expect(rows.length).toBe(2);
    await table.insertRow({ cost: 0.2, count: 1, vatable: true });
    const rows3 = await table.getRows();
    expect(rows3.length).toBe(3);
  });
  it("should fail on repeat id", async () => {
    const csv = `id,cost,count, vatable
1, 5,4, f
1, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice4", fnm);
    assertIsErrorMsg(res);

    expect(res.error).toContain("Error");
    const table = Table.findOne({ name: "Invoice4" });
    expect(table).toBe(null);
  });
  it("should import with missing", async () => {
    const csv = `item,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,, t`;
    const fnm = "/tmp/test2.csv";
    await writeFile(fnm, csv);
    const result = await Table.create_from_csv("InvoiceMissing", fnm);
    assertsIsSuccessMessage(result);
    const { table }: { table?: Table } = result;
    assertIsSet(table);
    expect(!!table).toBe(true);
    const fields = table.getFields();
    const countField = fields.find((f) => f.name === "count");
    assertIsSet(countField);
    assertIsType(countField.type);
    expect(countField.type.name).toBe("Integer");
    expect(countField.required).toBe(false);
    const rows = await table.getRows({ item: "Pencil" });
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(null);
    const brows = await table.getRows({ item: "Book" });
    expect(brows[0].count).toBe(4);
  });
  it("should import with space in name", async () => {
    //db.set_sql_logging();
    const csv = `Item Name,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2impok.csv";
    await writeFile(fnm, csv);
    const result = await Table.create_from_csv("Invoice5", fnm);
    assertsIsSuccessMessage(result);
    const { table } = result;
    const fields = table.getFields();
    const nameField = fields.find((f: Field) => f.name === "item_name");
    expect(nameField.type.name).toBe("String");
    expect(nameField.label).toBe("Item Name");

    const allrows = await table.getRows();
    expect(allrows.length).toBe(2);
  });
  it("should import with underscore in name", async () => {
    //db.set_sql_logging();
    const csv = `Item_Name,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2impok.csv";
    await writeFile(fnm, csv);
    const result = await Table.create_from_csv("Invoice6", fnm);
    assertsIsSuccessMessage(result);
    const { table } = result;
    const fields = table.getFields();
    expect(fields.map((f: Field) => f.name)).toContain("item_name");
    const nameField = fields.find((f: Field) => f.name === "item_name");
    expect(nameField.type.name).toBe("String");
    expect(nameField.label).toBe("Item Name");

    const allrows = await table.getRows();
    expect(allrows.length).toBe(2);
  });
  it("should import large integers as strings", async () => {
    //db.set_sql_logging();
    if (db.isSQLite) return;

    const csv = `id,cost,count, vatable
1, 5,4, f
4084787842, 0.5,2, t`;
    const fnm = "/tmp/test2impok.csv";
    await writeFile(fnm, csv);
    const result = await Table.create_from_csv("Invoice7", fnm);
    assertsIsSuccessMessage(result);
    const { table } = result;
    const fields = table.getFields();
    expect(fields.map((f: Field) => f.name)).toContain("id");
    const nameField = fields.find((f: Field) => f.name === "id");
    expect(nameField.type.name).toBe("String");

    const allrows = await table.getRows();
    expect(allrows.length).toBe(2);
  });
  it("should import JSON columns", async () => {
    //db.set_sql_logging();
    getState().registerPlugin("mock_plugin", plugin_with_routes());

    const csv = `id,cost,count, attrs
1, 5,4, "{""foo"":5}"
3, 0.5,2, "[7]"`;
    const fnm = "/tmp/test2impok.csv";
    await writeFile(fnm, csv);
    const result = await Table.create_from_csv("Invoice8", fnm);
    assertsIsSuccessMessage(result);
    const { table } = result;
    const fields = table.getFields();
    const nameField = fields.find((f: Field) => f.name === "attrs");
    expect(nameField.type.name).toBe("JSON");

    const allrows = await table.getRows({}, { orderBy: "id" });
    expect(allrows.length).toBe(2);
    expect(allrows[0].attrs.foo).toBe(5);
    expect(allrows[1].attrs[0]).toBe(7);
  });
});

describe("Table field uppercase", () => {
  it("should create by importing", async () => {
    const csv = `Item,cost,Count,Vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test_uc.csv";
    await writeFile(fnm, csv);
    const result = await Table.create_from_csv("InvoiceUC", fnm);
    assertsIsSuccessMessage(result);
    const { table }: { table?: Table } = result;
    assertIsSet(table);
    const fields = table.getFields();
    const rows1 = await table.getJoinedRows({
      where: { item: { ilike: "East" } },
    });
    expect(rows1.length).toBe(0);
    const rows2 = await table.getJoinedRows({
      where: { count: 2 },
    });
    expect(rows2.length).toBe(1);
    const rows3 = await table.getJoinedRows({
      where: { _fts: { searchTerm: "Book", fields } },
    });
    expect(rows3.length).toBe(1);
  });
});

describe("Table unique constraint", () => {
  it("should create table with unique constraint", async () => {
    //db.set_sql_logging()
    const table = await Table.create("TableWithUniques");
    const field = await Field.create({
      table,
      name: "name",
      type: "String",
      is_unique: true,
    });
    await table.insertRow({ name: "Bill" });
    const ted_id = await table.insertRow({ name: "Ted" });
    const ins_res = await table.tryInsertRow({ name: "Bill" });
    expect(ins_res).toEqual({
      error: "Duplicate value for unique field: name",
    });
    const ins_res1 = await table.tryInsertRow({ name: "Billy" });
    assertsIsSuccessMessage(ins_res1);
    expect(typeof ins_res1.success).toEqual("number");
    const upd_res = await table.tryUpdateRow({ name: "Bill" }, ted_id);
    expect(upd_res).toEqual({
      error: "Duplicate value for unique field: name",
    });
    const upd_res1 = await table.tryUpdateRow({ name: "teddy" }, ted_id);
    assertsIsSuccessMessage(upd_res1);
    expect(upd_res1.success).toEqual(true);
    await field.update({ is_unique: false });
    const field1 = await Field.findOne({ id: field.id });
    expect(field1.is_unique).toBe(false);
    //const bill2_id = await table.insertRow({ name: "Bill" });

    await field1.update({ is_unique: true });
    const field2 = await Field.findOne({ id: field.id });
    expect(field2.is_unique).toBe(true);
    expect(field1.is_unique).toBe(true);
  });
  it("should show unique_error_msg", async () => {
    //db.set_sql_logging()
    const table = await Table.create("TableWithUniques1");
    await Field.create({
      table,
      name: "name",
      type: "String",
      is_unique: true,
      attributes: { unique_error_msg: "No same name twice" },
    });
    await table.insertRow({ name: "Bill" });
    const ted_id = await table.insertRow({ name: "Ted" });
    const ins_res = await table.tryInsertRow({ name: "Bill" });
    expect(ins_res).toEqual({
      error: "No same name twice",
    });
  });
});

describe("Table not null constraint", () => {
  it("should create table", async () => {
    //db.set_sql_logging()
    const table = await Table.create("TableWithNotNulls");
    const field = await Field.create({
      table,
      name: "name",
      type: "String",
      required: true,
    });
    await Field.create({
      table,
      name: "age",
      type: "Integer",
    });
    await table.insertRow({ name: "Bill", age: 13 });
    await table.insertRow({ name: "Bill", age: 13 });
    const ins_res = await table.tryInsertRow({ age: 17, name: null });
    assertIsErrorMsg(ins_res);
    expect(!!ins_res.error).toBe(true);
    expect(ins_res.error).toContain("name");
    if (!db.isSQLite) {
      await field.update({ required: false });
      const ted_id = await table.insertRow({ age: 17 });
      await table.deleteRows({ id: ted_id });
      await field.update({ required: true });
      const ins_res1 = await table.tryInsertRow({ age: 167 });
      assertIsErrorMsg(ins_res1);
      expect(!!ins_res1.error).toBe(true);
    }
  });
  it("should query null", async () => {
    const table = Table.findOne({ name: "TableWithNotNulls" });
    assertIsSet(table);
    await table.insertRow({ name: "Ageless", age: null });

    const rows = await table.getRows({ age: null });
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Ageless");
    const rows1 = await table.getRows({ age: null, name: "Ageless" });
    expect(rows1.length).toBe(1);
    expect(rows1[0].name).toBe("Ageless");
    const rows2 = await table.getRows({ name: "Ageless", age: null });
    expect(rows2.length).toBe(1);
    expect(rows2[0].name).toBe("Ageless");
  });
});
describe("Table with users and files", () => {
  it("should create table", async () => {
    //db.set_sql_logging()
    const rick = await rick_file();
    const table = await Table.create("TableWithUsers");
    await Field.create({
      table,
      name: "name",
      type: "String",
      is_unique: true,
    });
    await Field.create({
      table,
      name: "owner",
      type: "Key to users",
    });
    await Field.create({
      table,
      name: "mugshot",
      type: "File",
    });
    await table.insertRow({ name: "Rocket", owner: 1, mugshot: rick.filename });
    const rels = await table.get_parent_relations();
    expect(rels.parent_field_list).toEqual([
      "owner.email",
      "owner.id",
      "owner.role_id",
    ]);
    const joined = await table.getJoinedRows();
    // expect(joined).toEqual("rick.png")
    expect(joined[0].mugshot).toEqual("rick.png");
  });
});

describe("Table and view deletion ", () => {
  it("should setup", async () => {
    const tc = await Table.create("mytable19");
    await Field.create({
      table: tc,
      name: "name",
      type: "String",
      is_unique: true,
    });
    const v = await View.create({
      table_id: tc.id,
      name: "anewview",
      viewtemplate: "List",
      configuration: { columns: [], default_state: {} },
      min_role: 100,
    });
    let error;
    try {
      await tc.delete();
    } catch (e) {
      error = e;
    }
    //expect(error).toBeInstanceOf(Error); - not on SQLite
    await v.delete();
  });
  it("should delete table after view delete", async () => {
    const tc = Table.findOne({ name: "mytable19" });
    if (tc) await tc.delete();
  });
});

describe("Table with date", () => {
  it("should create table", async () => {
    //db.set_sql_logging()
    const table = await Table.create("TableWithDates");
    await Field.create({
      table,
      name: "time",
      type: "Date",
    });
    await Field.create({
      table,
      name: "theday",
      type: "Date",
      attributes: { day_only: true },
    });

    await table.insertRow({ time: new Date(), theday: "2023-11-28" });
    const rows = await table.getRows();
    var dif = new Date(rows[0].time).getTime() - new Date().getTime();

    expect(Math.abs(dif)).toBeLessThanOrEqual(1000);
  });
  it("should query days", async () => {
    const table = Table.findOne({ name: "TableWithDates" });
    assertIsSet(table);
    const rows = await table.getRows({ theday: "2023-11-28" });
    expect(rows.length).toBe(1);
    const rows0 = await table.getRows({ theday: "2023-11-29" });
    expect(rows0.length).toBe(0);
    const rows1 = await table.getRows({
      theday: { gt: "2023-11-28", day_only: true },
    });
    expect(rows1.length).toBe(0);
    const rows2 = await table.getRows({
      theday: { gt: "2023-11-28", equal: true, day_only: true },
    });
    expect(rows2.length).toBe(1);
  });
});
describe("Tables with name clashes", () => {
  it("should create tables", async () => {
    //db.set_sql_logging()
    const cars = await Table.create("TableClashCar");
    const persons = await Table.create("TableClashPerson");
    await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: cars,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: cars,
      name: "owner",
      type: "Key to TableClashPerson",
    });
    const sally = await persons.insertRow({ name: "Sally" });
    await cars.insertRow({ name: "Mustang", owner: sally });
  });
  it("should query", async () => {
    const cars = Table.findOne({ name: "TableClashCar" });
    assertIsSet(cars);

    const rows = await cars.getJoinedRows({
      joinFields: {
        owner_name: { ref: "owner", target: "name" },
      },
    });
    expect(rows[0]).toEqual({
      id: 1,
      name: "Mustang",
      owner: 1,
      owner_name: "Sally",
    });
  });

  it("should show list view", async () => {
    const cars = Table.findOne({ name: "TableClashCar" });
    assertIsSet(cars);
    const v = await View.create({
      table_id: cars.id,
      name: "patientlist",
      viewtemplate: "List",
      configuration: {
        columns: [
          { type: "Field", field_name: "name" },
          { type: "JoinField", join_field: "owner.name" },
        ],
      },
      min_role: 100,
    });
    const res = await v.run({}, mockReqRes);
    expect(res).toContain("Mustang");
    expect(res).toContain("Sally");
  });
  it("should show show view", async () => {
    const cars = Table.findOne({ name: "TableClashCar" });
    assertIsSet(cars);
    const v = await View.create({
      table_id: cars.id,
      name: "patientlist",
      viewtemplate: "Show",
      configuration: {
        columns: [
          { type: "Field", field_name: "name" },
          { type: "JoinField", join_field: "owner.name" },
        ],
        layout: {
          above: [
            { type: "field", fieldview: "show", field_name: "name" },
            { type: "join_field", join_field: "owner.name" },
          ],
        },
      },
      min_role: 100,
    });
    const res = await v.run({ id: 1 }, mockReqRes);
    expect(res).toContain("Mustang");
    expect(res).toContain("Sally");
  });
});
describe("Table joint unique constraint", () => {
  it("should create table", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    assertIsSet(table.id);
    const rows = await table.getRows();
    const { id, ...row0 } = rows[0];
    const tc = await TableConstraint.create({
      table_id: table.id,
      type: "Unique",
      configuration: {
        fields: ["author", "pages"],
        errormsg: "Bad author/pages vibes",
      },
    });
    const table1 = Table.findOne({ name: "books" });
    assertIsSet(table1);
    const res = await table1.tryInsertRow(row0);
    assertIsErrorMsg(res);
    expect(res.error).toBe("Bad author/pages vibes");
    await tc.delete();
    const table2 = Table.findOne({ name: "books" });
    assertIsSet(table2);
    const res1 = await table2.tryInsertRow(row0);
    assertIsErrorMsg(res1);
    expect(!!res1.error).toBe(false);
  });
});
describe("Table constraints", () => {
  it("should create table", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    assertIsSet(table.id);

    const row0 = {
      author: "Murphy",
      pages: 499,
    };

    const tc = await TableConstraint.create({
      table_id: table.id,
      type: "Formula",
      configuration: { formula: "pages>500", errormsg: "Too short" },
    });
    const table1 = Table.findOne({ name: "books" });
    assertIsSet(table1);

    const res = await table1.tryInsertRow(row0);

    assertIsErrorMsg(res);
    expect(res.error).toBe("Too short");

    const resup = await table1.updateRow({ pages: 355 }, 1);
    expect(resup).toBe("Too short");
    const uprow = await table1.getRow({ id: 1 });
    expect(uprow?.pages).toBeGreaterThan(400);

    await tc.delete();
    const table2 = Table.findOne({ name: "books" });
    assertIsSet(table2);
    const res1 = await table2.tryInsertRow(row0);

    assertIsErrorMsg(res1);
    expect(!!res1.error).toBe(false);
  });
  it("should prevent self-join loop", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    assertIsSet(table.id);

    const tc = await TableConstraint.create({
      table_id: table.id,
      type: "Formula",
      configuration: {
        formula: "parent != id || parent == null",
        errormsg: "No loop",
      },
    });
    const table1 = Table.findOne({ name: "patients" });
    assertIsSet(table1);

    const res = await table1.tryInsertRow({ name: "Fred" });
    assertsIsSuccessMessage(res);

    const id = res.success;

    const resup = await table1.updateRow({ parent: id }, id);
    expect(resup).toBe("No loop");
    const uprow = await table1.getRow({ id });

    expect(uprow!.parent).toBe(null);
  });
  it("should create index", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    assertIsSet(table.id);

    const con = await TableConstraint.create({
      table_id: table.id,
      type: "Index",
      configuration: { field: "author" },
    });
    await con.delete();
  });
  it("should create constraint in transaction", async () => {
    await runWithTenant("public", async () => {
      const table = Table.findOne({ name: "readings" });
      assertIsSet(table);
      assertIsSet(table.id);
      const con = await db.withTransaction(async () => {
        return await TableConstraint.create({
          table_id: table.id,
          type: "Formula",
          configuration: {
            formula: "Math.round(temperature)<100",
            errormsg: "Read error",
          },
        });
      });

      await getState().refresh_tables();
      const readings = Table.findOne({ name: "readings" });
      assertIsSet(readings);

      const result = await readings.tryInsertRow({
        patient_id: 1,
        temperature: 137,
        date: new Date(),
      });

      expect((result as any).error).toBe("Read error");

      await con.delete();
    });
  });
  it("should create constraint that is not translatable to SQL in transaction", async () => {
    await runWithTenant("public", async () => {
      const table = Table.findOne({ name: "readings" });
      assertIsSet(table);
      assertIsSet(table.id);
      expect(table.constraints.length).toBe(0);

      const con = await db.withTransaction(async () => {
        return await TableConstraint.create({
          table_id: table.id,
          type: "Formula",
          configuration: {
            formula: "temperature==='bar'",
            errormsg: "Read error",
          },
        });
      });

      await getState().refresh_tables();
      const readings = Table.findOne({ name: "readings" });
      assertIsSet(readings);
      expect(readings.constraints.length).toBe(1);
      expect(readings.constraints[0].configuration.formula).toBe(
        "temperature==='bar'"
      );

      await con.delete();
    });
  });
  it("should create full text search index", async () => {
    const table = await Table.create("TableWithFTS");
    await Field.create({
      table,
      name: "name",
      type: "String",
      required: true,
    });
    await Field.create({
      table,
      name: "bio",
      type: "String",
      required: true,
    });
    await Field.create({
      table,
      name: "age",
      type: "Integer",
    });
    await Field.create({
      table,
      name: "favbook",
      label: "Favbook",
      type: "Key to books",
      attributes: { summary_field: "author", include_fts: true },
    });
    await table.insertRow({
      name: "Tom",
      bio: "Writes saltcorns",
      age: 11,
      favbook: 1,
    });
    if (!db.isSQLite) {
      const con = await TableConstraint.create({
        table_id: table.id,
        type: "Index",
        configuration: { field: "_fts" },
      });
      const table1 = Table.findOne("TableWithFTS");
      expect(
        table1?.fields
          .filter((f) => f.name === "search_context")
          .map((f) => f.name).length
      ).toBe(1);
      await con.delete();
      await Field.create({
        table,
        name: "favpatient",
        label: "Fave Patient",
        type: "Key to patients",
        attributes: { summary_field: "name", include_fts: true },
      });
      const con1 = await TableConstraint.create({
        table_id: table.id,
        type: "Index",
        configuration: { field: "_fts" },
      });
      const table2 = Table.findOne("TableWithFTS");
      expect(table2?.getField("search_context")?.expression).toBe(
        `favbook?.author||"" + " " + favpatient?.name||""`
      );
      await con1.delete();
    }
  });
});
describe("Table with UUID pks", () => {
  if (!db.isSQLite) {
    it("should select uuid", async () => {
      await db.query('create extension if not exists "uuid-ossp";');

      const { rows } = await db.query("select uuid_generate_v4();");
      expect(rows.length).toBe(1);
      expect(typeof rows[0].uuid_generate_v4).toBe("string");
    });
    it("should create and insert stuff in table", async () => {
      getState().registerPlugin("mock_plugin", plugin_with_routes());
      const table = await Table.create("TableUUID");
      const [pk] = table.getFields();
      await pk.update({ type: "UUID" });
      // @ts-ignore
      expect(pk.type.name).toBe("UUID");

      const table1 = Table.findOne({ name: "TableUUID" });
      assertIsSet(table1);
      const flds1 = await table1.getFields();

      // @ts-ignore
      expect(flds1[0].type.name).toBe("UUID");

      const name = await Field.create({
        table: table,
        name: "name",
        type: "String",
      });

      await table.insertRow({ name: "Sam" });
      const rows = await table.getRows();
      expect(rows.length).toBe(1);
      expect(typeof rows[0].id).toBe("string");
      expect(rows[0].id.length > 10).toBe(true);
      expect(rows[0].name).toBe("Sam");

      await table.updateRow({ name: "Jim" }, rows[0].id);
      const rows1 = await table.getJoinedRows();
      expect(rows1.length).toBe(1);
      expect(typeof rows1[0].id).toBe("string");
      expect(rows1[0].id).toBe(rows[0].id);
      expect(rows1[0].name).toBe("Jim");
      const row = await table.getRow({ id: rows[0].id });
      assertIsSet(row);
      expect(row.name).toBe("Jim");
    });
    it("should import json", async () => {
      const json = [
        { name: "Alex", id: "750d07fc-943d-4afc-9084-3911bcdbd0f7" },
      ];
      const fnm = "/tmp/test1.json";
      await writeFile(fnm, JSON.stringify(json));

      await getState().refresh_tables();
      const table = Table.findOne({ name: "TableUUID" });
      assertIsSet(table);
      expect(!!table).toBe(true);
      const flds = table.getFields();
      // @ts-ignore
      expect(flds[0].type.name).toBe("UUID");
      const impres = await table.import_json_file(fnm);
      expect(impres).toEqual({
        success: "Imported 1 rows into table TableUUID",
      });
      const rows = await table.getRows();
      expect(rows.length).toBe(2);
    });
    it("should be joinable to", async () => {
      const uuidtable1 = Table.findOne({ name: "TableUUID" });
      assertIsSet(uuidtable1);

      const table = await Table.create("JoinUUID");
      await Field.create({
        table: table,
        name: "myname",
        type: "String",
      });
      //db.set_sql_logging();
      await Field.create({
        table: table,
        name: "follows",
        type: "Key to TableUUID",
      });
      const refrows = await uuidtable1.getRows({});

      await table.insertRow({ myname: "Fred", follows: refrows[0].id });
      const rows = await table.getJoinedRows({
        where: {},
        joinFields: {
          leader: { ref: "follows", target: "name" },
        },
      });
      //trying to debug intermittant CI failure
      if (rows.length === 0) {
        const allRows = await table.getRows();
        console.log(allRows);
      }
      expect(rows.length).toBe(1);
      expect(rows[0].leader).toBe("Jim");
      expect(rows[0].myname).toBe("Fred");

      await table.delete();

      await uuidtable1.delete();
    });
    it("should create and delete table", async () => {
      getState().registerPlugin("mock_plugin", plugin_with_routes());
      const table = await Table.create("TableUUID1");
      const [pk] = table.getFields();

      await pk.update({ type: "UUID" });

      const table1 = Table.findOne({ name: table.name });
      assertIsSet(table1);
      const [pk1] = await table1.getFields();
      // @ts-ignore
      expect(pk1.type?.name).toBe("UUID");
      //const [pk1] = table.getFields();
      await pk.update({ type: "Integer" });

      await table.delete();
    });
  }
});
describe("json restore", () => {
  it("should import json with json", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());

    const json = [
      { name: "Alex", id: 1, stuff: { bar: "foo" } },
      { name: "Alex1", id: 2, stuff: 1 },
      { name: "Alex2", id: 3, stuff: "hello" },
      { name: "Alex3", id: 4, stuff: [17] },
      { name: "Alex4", id: 5, stuff: null },
    ];
    const fnm = "/tmp/test1.json";
    await writeFile(fnm, JSON.stringify(json));

    await getState().refresh_tables();

    const table = await Table.create("JsonJson");
    await Field.create({
      table: table,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: table,
      name: "stuff",
      type: "JSON",
    });

    //db.set_sql_logging();
    assertIsSet(table);

    const impres = await table.import_json_file(fnm);
    expect(impres).toEqual({
      success: "Imported 5 rows into table JsonJson",
    });
    const rows = await table.getRows();
    expect(rows.length).toBe(5);
    const testValue = async (id: number, value: any) => {
      const row4 = await table.getRow({ id });
      assertIsSet(row4);
      expect(row4.stuff).toStrictEqual(value);
    };
    await testValue(3, "hello");
    await testValue(4, [17]);
    await testValue(5, null);

    const testInsert = async (name: string, val: any) => {
      await table.insertRow({ name, stuff: val });
      const row5 = await table.getRow({ name });
      assertIsSet(row5);
      expect(row5.stuff).toStrictEqual(val);
    };
    await testInsert("Baz1", { a: 1 });
    await testInsert("Baz2", 19);
    await testInsert("Bar", [15]);
    await testInsert("Baza", "baz");
    await testInsert("Bazn", null);
    const testUpdate = async (name: string, val: any) => {
      const row6 = await table.getRow({ name });
      assertIsSet(row6);
      await table.updateRow({ stuff: val }, row6.id);
      const row5 = await table.getRow({ name });
      assertIsSet(row5);
      expect(row5.stuff).toStrictEqual(val);
    };
    await testUpdate("Baz1", { a: 2 });
    await testUpdate("Baz2", 91);
    await testUpdate("Bar", [51]);
    await testUpdate("Bar", null);
    await testUpdate("Baza", "bazc");

    //test empty update
    const row7 = await table.getRow({ name: "Baz2" });
    assertIsSet(row7);
    await table.updateRow({}, row7.id);
    const row5 = await table.getRow({ name: "Baz2" });
    assertIsSet(row5);
    expect(row5.stuff).toStrictEqual(91);

    table.versioned = true;
    await table.update(table);
    await testInsert("Baz1h", { a: 1 });
    await testInsert("Baz2h", 19);
    await testInsert("Barh", [15]);
    await testInsert("Bazah", "baz");
    await testUpdate("Baz1h", { a: 2 });
    await testUpdate("Baz2h", 91);
    await testUpdate("Barh", [51]);
    await testUpdate("Bazah", "bazc");
  });
  it("should not change json on insert", async () => {
    const table = await Table.findOne("JsonJson");
    assertIsSet(table);
    const newRow = { name: "TJ", stuff: { bar: "foo" } };
    await table.insertRow(newRow);
    expect(newRow.stuff).toStrictEqual({ bar: "foo" });
  });
});

describe("external tables", () => {
  it("should register plugin", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
  });
  it("should find table", async () => {
    const table = Table.findOne({ name: "exttab" });
    expect(!!table).toBe(true);
    const notable = Table.findOne({ name: "exttnosuchab" });
    expect(!!notable).toBe(false);
    const tables = await Table.find_with_external();
    expect(tables.map((t) => t.name)).toContain("exttab");
    expect(tables.map((t) => t.name)).toContain("books");

    const etables = await Table.find_with_external({ external: true });
    expect(etables.map((t) => t.name)).toEqual(["exttab"]);
    const dbtables = await Table.find_with_external({ external: false });
    expect(dbtables.map((t) => t.name)).not.toContain("exttab");
    expect(dbtables.map((t) => t.name)).toContain("books");
  });
  it("should query", async () => {
    const table = Table.findOne({ name: "exttab" });
    assertIsSet(table);
    const rows0 = await table.getRows({ name: "Sam" });
    expect(rows0.length).toBe(1);
    expect(rows0[0].name).toBe("Sam");
    const rows1 = await table.getRows({
      or: [{ name: "Sam" }, { name: "Alex" }],
    });
    expect(rows1.length).toBe(2);
    const rows2 = await table.getRows({
      name: { in: ["Sam", "Alex"] },
    });
    expect(rows2.length).toBe(2);
  });
  it("should build view", async () => {
    const table = Table.findOne({ name: "exttab" });
    assertIsSet(table);
    const view = await createDefaultView(table, "List", 100);
    const contents = await view.run_possibly_on_page(
      {},
      mockReqRes.req,
      mockReqRes.res
    );
    expect(contents).toContain(">Sam<");
    const configFlow = await view.get_config_flow(mockReqRes.req);
    await configFlow.run(
      {
        exttable_name: view.exttable_name,
        viewname: view.name,
        ...view.configuration,
      },
      mockReqRes.req
    );
  });
});
describe("table providers", () => {
  it("should register plugin", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
  });
  it("should create table", async () => {
    await Table.create("JoeTable", {
      provider_name: "provtab",
      provider_cfg: { middle_name: "Robinette" },
    });
    await getState().refresh_tables();
  });
  it("should find", async () => {
    const [table] = await Table.find({ name: "JoeTable" });
    assertIsSet(table);
    const rows = await table.getRows({});
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Robinette");
    expect(table.fields.length).toBe(2);
  });
  it("should query", async () => {
    const table = Table.findOne({ name: "JoeTable" });
    assertIsSet(table);
    expect(table.fields.length).toBe(2);
    const rows = await table.getRows({});
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Robinette");
    expect(rows[0].age).toBe(36);
  });
  it("should change role", async () => {
    const table = Table.findOne({ name: "JoeTable" });
    assertIsSet(table);
    await table.update({ min_role_read: 40 });
  });
  it("should get role", async () => {
    const table = Table.findOne({ name: "JoeTable" });
    assertIsSet(table);
    expect(table.min_role_read).toBe(40);
  });
  it("should make keys to provider table", async () => {
    const tc = await Table.create("key_to_provider");
    await Field.create({
      table: tc,
      label: "Person",
      name: "person",
      type: "Key to JoeTable",
    });
    await tc.insertRow({ person: "Robinette" });
    //db.set_sql_logging(true);
    const rows = await tc.getJoinedRows({
      joinFields: {
        person_age: { ref: "person", target: "age" },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].person_age).toBe(36);
  });
});

describe("distance ordering", () => {
  it("should create table", async () => {
    const tc = await Table.create("geotable1");

    await Field.create({
      table: tc,
      label: "Name",
      type: "String",
      required: true,
    });
    await Field.create({
      table: tc,
      label: "Lat",
      type: "Float",
      required: true,
    });
    await Field.create({
      table: tc,
      label: "Long",
      type: "Float",
      required: true,
    });
    await tc.insertRow({ name: "Fred", lat: 10, long: 10 });
    await tc.insertRow({ name: "George", lat: 20, long: 20 });
  });
  it("should query", async () => {
    const table = Table.findOne({ name: "geotable1" });
    assertIsSet(table);

    const fred_rows = await table.getRows(
      {},
      {
        orderBy: {
          distance: { lat: 11, long: 11, latField: "lat", longField: "long" },
        },
      }
    );
    expect(fred_rows.length).toBe(2);
    expect(fred_rows[0].name).toBe("Fred");
    const george_rows = await table.getJoinedRows({
      orderBy: {
        distance: { lat: 19, long: 19, latField: "lat", longField: "long" },
      },
    });
    expect(george_rows.length).toBe(2);
    expect(george_rows[0].name).toBe("George");
  });
});

describe("getField", () => {
  it("should find own field", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const field = table.getField("name");
    expect(field?.name).toBe("name");
    expect(field?.id).toBe(8);
  });
  it("should find single join field", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const field = table.getField("favbook.pages");
    expect(field?.name).toBe("pages");
    expect(field?.id).toBe(6);
    const field1 = table.getField("favbookⱵpages");
    expect(field1?.name).toBe("pages");
    expect(field1?.id).toBe(6);
  });
  it("should find double join field", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const field = table.getField("favbook.publisher.name");
    expect(field?.name).toBe("name");
    expect(field?.id).toBe(20);
    const field1 = table.getField("favbookⱵpublisherⱵname");
    expect(field1?.name).toBe("name");
    expect(field1?.id).toBe(20);
  });
  it("should find triple join field", async () => {
    const table = Table.findOne({ name: "readings" });
    assertIsSet(table);
    const field = table.getField("patient_id.favbook.publisher.name");
    expect(field?.name).toBe("name");
    expect(field?.id).toBe(20);
    const field1 = table.getField("patient_idⱵfavbookⱵpublisherⱵname");
    expect(field1?.name).toBe("name");
    expect(field1?.id).toBe(20);
  });
  it("should find own key field", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const field = table.getField("favbook");
    expect(field?.name).toBe("favbook");
    expect(field?.is_fkey).toBe(true);
    expect(field?.id).toBe(9);
  });
  it("should find single join key field", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const field = table.getField("favbook.publisher");
    expect(field?.name).toBe("publisher");
    expect(field?.is_fkey).toBe(true);

    expect(field?.id).toBe(21);
  });
});

describe("field_options", () => {
  it("should find own fields", async () => {
    const table = Table.findOne({ name: "patients" });
    const opts = await table?.field_options();
    expect(opts).toStrictEqual(["favbook", "id", "name", "parent"]);
  });
  it("should find one-level join fields", async () => {
    const table = Table.findOne({ name: "patients" });
    const opts = await table?.field_options(1);
    expect(opts).toContain("parent.name");
    expect(opts).toContain("favbook.pages");
  });
  it("should find string fields", async () => {
    const table = Table.findOne({ name: "patients" });
    const opts = await table?.field_options(1, (f) => f.type_name === "String");
    expect(opts).toStrictEqual(["name", "favbook.author", "parent.name"]);
  });
});
describe("agg latest multiple test", () => {
  it("should get latest aggregations with the right rows", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const now = new Date();
    await readings.insertRow({ patient_id: 1, temperature: 42, date: now });
    await readings.insertRow({ patient_id: 2, temperature: 45, date: now });
    await readings.insertRow({ patient_id: 1, temperature: 42, date: now });

    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      where: { id: 2 },
      aggregations: {
        last_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "Latest date",
        },
      },
    });
    expect(Math.round(michaels[0].last_temp)).toBe(45);
  });
});

describe("Table insert/update expanded joinfields", () => {
  it("insert expanded", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const readings = Table.findOne({ name: "readings" });
    assertIsSet(readings);
    const now = new Date();
    const pid0 = await readings.insertRow({
      patient_id: 1,
      temperature: 42,
      date: now,
    });
    const prow0 = await readings.getRow({ id: pid0 });
    expect(prow0?.patient_id).toBe(1);
    const pid1 = await readings.insertRow({
      patient_id: { id: 1, name: "Foobar" },
      temperature: 42,
      date: now,
    });
    const prow1 = await readings.getRow({ id: pid1 });
    expect(prow1?.patient_id).toBe(1);

    await readings.updateRow({ patient_id: { id: 2, name: "Foobar" } }, pid1);
    const prow2 = await readings.getRow({ id: pid1 });
    expect(prow2?.patient_id).toBe(2);
    await readings.updateRow({ patient_id: 1 }, { id: pid1 } as any);
    const prow3 = await readings.getRow({ id: pid1 });
    expect(prow3?.patient_id).toBe(1);
  });
});
describe("aggregation formula", () => {
  it("gets agg without stat", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const aggregations = {};
    const freeVars = freeVariables("readings$patient_id$temperature");
    expect([...freeVars]).toStrictEqual(["readings$patient_id$temperature"]);
    add_free_variables_to_aggregations(freeVars, aggregations, patients);
    expect(aggregations).toStrictEqual({
      readingspatient_idtemperature: {
        table: "readings",
        ref: "patient_id",
        field: "temperature",
        aggregate: "array_agg",
        rename_to: "readings$patient_id$temperature",
      },
    });
  });
  it("gets agg with stat", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const aggregations = {};
    const freeVars = freeVariables("readings$patient_id$temperature$avg");
    add_free_variables_to_aggregations(freeVars, aggregations, patients);
    expect(aggregations).toStrictEqual({
      readingspatient_idtemperatureavg: {
        table: "readings",
        ref: "patient_id",
        field: "temperature",
        aggregate: "avg",
        rename_to: "readings$patient_id$temperature$avg",
      },
    });
    const row = await patients.getJoinedRow({
      where: { id: 1 },
      aggregations,
    });
    expect(Math.round(row?.readings$patient_id$temperature$avg)).toBe(41);
  });
});

describe("grandparent join", () => {
  it("should define rows", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const fields = table.getFields();

    const greatgranny = await table.insertRow({ name: "Greatgranny" });
    const granny = await table.insertRow({
      name: "Granny",
      parent: greatgranny,
    });
    const mummy = await table.insertRow({ name: "Mummy", parent: granny });
    const toddler = await table.insertRow({
      name: "Toddler",
      parent: mummy,
    });

    const joinFields = {};
    const freeVars = new Set([
      ...freeVariables("parent.name"),
      ...freeVariables("parent.parent.name"),
      ...freeVariables("parent.parent.parent.name"),
    ]);
    expect([...freeVars]).toStrictEqual([
      "parent.name",
      "parent.parent.name",
      "parent.parent.parent.name",
    ]);
    add_free_variables_to_joinfields(freeVars, joinFields, fields);
    expect(joinFields).toStrictEqual({
      parent_name: {
        ref: "parent",
        rename_object: ["parent", "name"],
        target: "name",
      },
      parent_parent_name: {
        ref: "parent",
        rename_object: ["parent", "parent", "name"],
        target: "name",
        through: "parent",
      },
      parent_parent_parent_name: {
        ref: "parent",
        rename_object: ["parent", "parent", "parent", "name"],
        target: "name",
        through: ["parent", "parent"],
      },
    });
    const rows = await table.getJoinedRows({
      where: { id: toddler },
      joinFields,
    });

    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      favbook: null,
      id: toddler,
      name: "Toddler",
      parent: {
        id: mummy,
        name: "Mummy",
        parent: { name: "Granny", parent: { name: "Greatgranny" } },
      },
      parent_name: "Mummy",
      parent_parent_name: "Granny",
      parent_parent_parent_name: "Greatgranny",
    });
  });
});

// Testing slug_options method
describe("Table slug options", () => {
  it("should return slug options for unique string fields", async () => {
    const table = await Table.create("slug_test_table");
    await Field.create({
      table,
      name: "title",
      label: "Title",
      type: "String",
      is_unique: true,
    });
    await Field.create({
      table,
      name: "description",
      label: "Description",
      type: "String",
    });

    const options = await table.slug_options();
    expect(options).toEqual([
      { label: "", steps: [] },
      {
        label: "/:id",
        steps: [{ field: "id", unique: true, transform: null }],
      },
      {
        label: "/slugify-title",
        steps: [{ field: "title", unique: true, transform: "slugify" }],
      },
    ]);
  });

  it("should return the default option with id if no unique string fields exist", async () => {
    const table = await Table.create("slug_test_table_no_unique");
    await Field.create({
      table,
      name: "description",
      label: "Description",
      type: "String",
    });
    await Field.create({
      table,
      name: "age",
      label: "Age",
      type: "Integer",
      is_unique: false,
    });

    const options = await table.slug_options();
    expect(options).toEqual([
      { label: "", steps: [] },
      {
        label: "/:id",
        steps: [{ field: "id", unique: true, transform: null }],
      },
    ]);
  });

  it("should handle tables with no fields", async () => {
    const table = await Table.create("slug_test_table_empty");
    const options = await table.slug_options();
    expect(options).toEqual([
      { label: "", steps: [] },
      {
        label: "/:id",
        steps: [{ field: "id", unique: true, transform: null }],
      },
    ]);
  });

  it("should handle tables with non-string unique fields", async () => {
    const table = await Table.create("slug_test_table_non_string");
    await Field.create({
      table,
      name: "age",
      type: "Integer",
      is_unique: true,
    });
    await Field.create({
      table,
      name: "created_at",
      type: "Date",
      is_unique: true,
    });

    const options = await table.slug_options();
    expect(options).toEqual([
      { label: "", steps: [] },
      {
        label: "/:id",
        steps: [{ field: "id", unique: true, transform: null }],
      },
      {
        label: "/:age",
        steps: [{ field: "age", unique: true, transform: null }],
      },
      {
        label: "/:created_at",
        steps: [{ field: "created_at", unique: true, transform: null }],
      },
    ]);
  });
});

describe("Table recursive query", () => {
  beforeAll(async () => {
    const table = await Table.create("recur_projects");
    await Field.create({
      table,
      name: "name",
      label: "Name",
      type: "String",
    });
    await Field.create({
      table,
      name: "parent",
      label: "Parent",
      type: "Key to recur_projects",
    });
    await Field.create({
      table,
      name: "assignee",
      label: "Assignee",
      type: "Key to users",
    });
    await Field.create({
      table,
      name: "difficulty",
      label: "Difficulty",
      type: "Integer",
    });
    const homework = await table.insertRow({ name: "Homework", difficulty: 2 });
    const french = await table.insertRow({
      name: "French",
      parent: homework,
      difficulty: 1,
    });
    const biology = await table.insertRow({
      name: "Biology",
      parent: homework,
      difficulty: 2,
    });
    await table.insertRow({
      name: "Learn about the birds",
      parent: biology,
      difficulty: 1,
    });
    await table.insertRow({
      name: "Verb conjugations",
      parent: french,
      assignee: 2,
    });
    await table.insertRow({
      name: "Literature",
      parent: french,
    });
    await table.insertRow({
      name: "Learn about the bees",
      parent: biology,
      assignee: 1,
      difficulty: 2,
    });
  });
  if (!db.isSQLite) {
    it("getRows tree sort by id", async () => {
      const table = Table.findOne("recur_projects");
      assertIsSet(table);
      const rows = await table.getRows(
        {},
        { tree_field: "parent", orderBy: "id" }
      );
      expect(rows.length).toEqual(7);
      //console.log(rows.map((r) => r.name));
      expect(rows[2].name).toBe("Verb conjugations");
    });
    it("getRows tree sort by name", async () => {
      const table = Table.findOne("recur_projects");
      assertIsSet(table);
      //db.set_sql_logging(true);
      const rows = await table.getRows(
        {},
        { tree_field: "parent", orderBy: "name" }
      );
      expect(rows.length).toEqual(7);
      //console.log(rows.map((r) => r.name));
      expect(rows[2].name).toBe("Learn about the bees");
      expect(rows[2]._level).toBe(2);
      expect(rows[1]._level).toBe(1);
      expect(rows[0]._level).toBe(0);
    });
    it("getRows tree sort by name desc", async () => {
      const table = Table.findOne("recur_projects");
      assertIsSet(table);
      //db.set_sql_logging(true);
      const rows = await table.getRows(
        {},
        { tree_field: "parent", orderBy: "name", orderDesc: true }
      );
      expect(rows.length).toEqual(7);
      //console.log(rows.map((r) => r.name));
      expect(rows[2].name).toBe("Verb conjugations");
      expect(rows[2]._level).toBe(2);
      expect(rows[1]._level).toBe(1);
      expect(rows[0]._level).toBe(0);
    });
    it("getRows tree no sort", async () => {
      const table = Table.findOne("recur_projects");
      assertIsSet(table);
      //db.set_sql_logging(true);
      const rows = await table.getRows({}, { tree_field: "parent" });
      expect(rows.length).toEqual(7);
      //console.log(rows.map((r) => r.name));
      expect(rows[0].name).toBe("Homework");
      expect(["French", "Biology"].includes(rows[1].name)).toBe(true);
      expect(rows[1]._level).toBe(1);
      expect(rows[0]._level).toBe(0);
    });
    it("getRows tree with where", async () => {
      const table = Table.findOne("recur_projects");
      assertIsSet(table);
      //db.set_sql_logging(true);
      const rows = await table.getRows(
        { difficulty: 2 },
        { tree_field: "parent", orderBy: "name" }
      );
      //console.log(rows.map((r) => r.name));
      expect(rows.length).toEqual(3);
      expect(rows[2].name).toBe("Learn about the bees");
      expect(rows[2]._level).toBe(2);
      expect(rows[1]._level).toBe(1);
      expect(rows[0]._level).toBe(0);
    });
  } else
    it("doesnt work", async () => {
      expect(2 + 2).toBe(4);
    });
});
