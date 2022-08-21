import View from "../models/view";
import db from "../db";
import Table from "../models/table";

const {
  get_parent_views,
  get_child_views,
  stateFieldsToWhere,
  field_picker_fields,
} = require("../plugin-helper");
const { getState } = require("../db/state");
const { satisfies } = require("../utils");

import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import mocks from "./mocks";
const { mockReqRes } = mocks;

getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("plugin helper", () => {
  it("get parent views", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const x = await get_parent_views(patients, "foobar");
    expect(x[0].views.map((v: View) => v.name)).toStrictEqual([
      "authoredit",
      "authorshow",
    ]);
  });
  it("get child views", async () => {
    const books = await Table.findOne({ name: "books" });
    const x = await get_child_views(books, "foobar");
    expect(x[1].views.map((v: View) => v.name)).toStrictEqual(["patientlist"]);
  });
});
describe("stateFieldsToWhere", () => {
  const fields = [
    { name: "astr", type: { name: "String" } },
    { name: "age", type: { name: "Integer" } },
    { name: "props", type: { name: "JSON" } },
    {
      name: "attrs",
      type: { name: "JSON" },
      attributes: {
        hasSchema: true,
        schema: [{ key: "name", type: "String" }],
      },
    },
  ];
  it("normal field", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { astr: "foo", bstr: "bar" },
    });
    expect(w).toStrictEqual({ astr: { ilike: "foo" } });
  });
  it("int field bounds", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { _gte_age: 5, _lte_age: 15 },
    });
    expect(w).toStrictEqual({
      age: [
        { equal: true, gt: 5 },
        { equal: true, lt: 15 },
      ],
    });
  });
  it("normal field not approx", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { astr: "foo" },
      approximate: false,
    });
    expect(w).toStrictEqual({ astr: "foo" });
  });
  it("json field", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { props: { name: "Tom" } },
    });
    expect(w).toStrictEqual({ props: [{ json: { name: "Tom" } }] });
  });
  it("json field schema string", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { attrs: { name: "Tom" } },
    });
    expect(w).toStrictEqual({ attrs: [{ json: { name: { ilike: "Tom" } } }] });
  });
  it("json field int bounds", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { attrs: { cars__gte: 2, cars__lte: 4 } },
    });
    expect(w).toStrictEqual({
      attrs: [{ json: { cars: { gte: 2, lte: 4 } } }],
    });
  });
  it("join field", async () => {
    const table = Table.findOne({ name: "patients" });
    const myFields = await table?.getFields();
    const w = stateFieldsToWhere({
      fields: myFields,
      state: { "favbook.books->author": "Herman" },
    });
    if (db.isSQLite)
      expect(w).toStrictEqual({
        favbook: [
          {
            inSelect: {
              field: "id",
              table: '"books"',
              where: { author: { ilike: "Herman" } },
            },
          },
        ],
      });
    else
      expect(w).toStrictEqual({
        favbook: [
          {
            inSelect: {
              field: "id",
              table: '"public"."books"',
              where: { author: { ilike: "Herman" } },
            },
          },
        ],
      });
  });
});
describe("satisfies", () => {
  it("works", async () => {
    expect(satisfies({ x: 5 })({ x: 5 })).toBe(true);
    expect(satisfies({ x: 5 })({ x: 5, y: 7 })).toBe(true);
    expect(satisfies({ x: 5 })({ x: 6 })).toBe(false);
    expect(satisfies({ x: 5 })({ y: 6 })).toBe(false);
    expect(satisfies({})({ y: 6 })).toBe(true);
    expect(satisfies()({ y: 6 })).toBe(true);
    expect(satisfies({ x: { or: [5, 6] } })({ x: 5 })).toBe(true);
    expect(satisfies({ x: { or: [5, 6] } })({ x: 8 })).toBe(false);
    expect(satisfies({ x: { or: [5, 6] } })({ y: 8 })).toBe(false);
    expect(satisfies({ x: { in: [5, 6] } })({ x: 5 })).toBe(true);
    expect(satisfies({ x: { in: [5, 6] } })({ x: 8 })).toBe(false);
    expect(satisfies({ x: { in: [5, 6] } })({ y: 8 })).toBe(false);

    expect(satisfies({ x: 5, y: 7 })({ x: 5, y: 7 })).toBe(true);
    expect(satisfies({ x: 5, y: 8 })({ x: 5, y: 7 })).toBe(false);
    expect(satisfies({ x: 4, y: 8 })({ x: 5, y: 7 })).toBe(false);
  });
});
describe("plugin helper", () => {
  it("field_picker_fields", async () => {
    const table = Table.findOne({ name: "patients" });
    const flds = await field_picker_fields({
      table,
      viewname: "myView",
      req: mockReqRes.req,
    });
    expect(flds.length).toBeGreaterThan(1);
  });
});
