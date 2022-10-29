import discovery from "../models/discovery";
const { discoverable_tables, discover_tables, implement_discovery } = discovery;
const { getState } = require("../db/state");
import db from "../db";
import Table from "../models/table";

import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { Row } from "@saltcorn/db-common/internal";

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
jest.setTimeout(30000);

describe("Table Discovery", () => {
  if (!db.isSQLite) {
    it("should create tables", async () => {
      await db.query(
        `create table discperson(id serial primary key, name text, age integer not null);`
      );
      await db.query(
        `create table discdog(id serial primary key, name text, owner int references discperson(id));`
      );
      const table = await Table.create("table_with_history");
      await table.update({ versioned: true });
    });
    it("should list tables", async () => {
      const tbls = await discoverable_tables();
      expect(tbls.map((t: Row) => t.table_name).sort()).toStrictEqual([
        "discdog",
        "discperson",
      ]);
    });
    it("should make simple pack", async () => {
      const pack = await discover_tables(["discperson"]);
      expect(pack).toStrictEqual({
        tables: [
          {
            fields: [
              {
                label: "id",
                name: "id",
                required: true,
                type: "Integer",
                primary_key: true,
                is_unique: true,
              },
              { label: "name", name: "name", required: false, type: "String" },
              { label: "age", name: "age", required: true, type: "Integer" },
            ],
            name: "discperson",
            min_role_read: 1,
            min_role_write: 1,
          },
        ],
      });
    });
    it("should make and implement pack with fkey", async () => {
      const pack = await discover_tables(["discperson", "discdog"]);
      expect(pack).toStrictEqual({
        tables: [
          {
            fields: [
              {
                label: "id",
                name: "id",
                required: true,
                type: "Integer",
                primary_key: true,
                is_unique: true,
              },
              { label: "name", name: "name", required: false, type: "String" },
              { label: "age", name: "age", required: true, type: "Integer" },
            ],
            name: "discperson",
            min_role_read: 1,
            min_role_write: 1,
          },
          {
            fields: [
              {
                label: "id",
                name: "id",
                required: true,
                type: "Integer",
                primary_key: true,
                is_unique: true,
              },
              { label: "name", name: "name", required: false, type: "String" },
              {
                label: "owner",
                name: "owner",
                required: false,
                refname: "id",
                reftable_name: "discperson",
                reftype: "Integer",
                type: "Key",
              },
            ],
            name: "discdog",
            min_role_read: 1,
            min_role_write: 1,
          },
        ],
      });
      await implement_discovery(pack);
    });
  } else {
    it("doesnt run on sqlite", async () => {
      expect(2 + 2).toBe(4);
    });
  }
});
