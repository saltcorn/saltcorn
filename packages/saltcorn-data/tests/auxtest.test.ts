import View from "../models/view";
import db from "../db/index";
import Table from "../models/table";

const { get_parent_views, get_child_views } = require("../plugin-helper");
const { getState } = require("../db/state");
const { satisfies } = require("../utils");

import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

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
