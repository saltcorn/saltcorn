/**
 * Tests for discovery.ts
 */
import discovery from "../models/discovery";
const { discoverable_tables, discover_tables, implement_discovery } = discovery;
const { getState } = require("../db/state");
import db from "../db";
import Table from "../models/table";

import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { Row } from "@saltcorn/db-common/internal";

getState().registerPlugin("base", require("../base-plugin"));

// todo do we need to delete tables after tests?
afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
jest.setTimeout(30000);
// todo tests with forgotten tables
// todo more sql types
// [+done] more complex relationships between tables
// [+done] tests with names with spaces
// [+done] test cases about table with history
// todo partly discovering (not all tables in one discovery)
describe("Table Discovery", () => {
  if (!db.isSQLite) {
    it("should create tables", async () => {
      // this is simple ref table
      await db.query(
        `create table "disc breed"(id serial primary key, name text, rating smallint, population bigint );`
      );
      // this table has FK to users!
      await db.query(
        `create table discperson(
id serial primary key, 
name text, 
age integer not null, 
"user" int references users(id)
);`
      );
      // this table has 2 FK and column with space in name
      await db.query(
        `create table discdog(
id serial primary key, 
name text,
"birth date" date, 
owner int references discperson(id), 
breed int references "disc breed"(id));`
      );
      // this table added to check that *_history tables are not discovered
      const table = await Table.create("table_with_history");
      await table.update({ versioned: true });
    });
    it("should list tables", async () => {
      const tbls = await discoverable_tables();
      expect(tbls.map((t: Row) => t.table_name).sort()).toStrictEqual([
        "disc breed",
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
              {
                label: "user",
                name: "user",
                refname: "id",
                reftable_name: "users",
                reftype: "Integer",
                required: false,
                type: "Key",
              },
            ],
            name: "discperson",
            min_role_read: 1,
            min_role_write: 1,
          },
        ],
      });
    });
    it("should make and implement pack with fkey", async () => {
      const pack = await discover_tables([
        "disc breed",
        "discperson",
        "discdog",
      ]);
      expect(pack).toStrictEqual({
        tables: [
          // disc breed
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
                label: "rating",
                name: "rating",
                required: false,
                type: "Integer",
              },
              {
                label: "population",
                name: "population",
                required: false,
                type: "Integer",
              },
            ],
            name: "disc breed",
            min_role_read: 1,
            min_role_write: 1,
          },
          // discperson
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
              {
                label: "user",
                name: "user",
                refname: "id",
                reftable_name: "users",
                reftype: "Integer",
                required: false,
                type: "Key",
              },
            ],
            name: "discperson",
            min_role_read: 1,
            min_role_write: 1,
          },
          // discdog
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
                label: "birth date",
                name: "birth date",
                required: false,
                type: "Date",
              },
              {
                label: "owner",
                name: "owner",
                required: false,
                refname: "id",
                reftable_name: "discperson",
                reftype: "Integer",
                type: "Key",
              },
              {
                label: "breed",
                name: "breed",
                required: false,
                refname: "id",
                reftable_name: "disc breed",
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
