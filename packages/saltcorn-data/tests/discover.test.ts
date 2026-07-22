/**
 * Tests for discovery.ts
 */
import * as discovery from "../models/discovery.js";
import { getState } from "../db/state.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
const {
  discoverable_tables,
  discover_tables,
  implement_discovery,
  reconcile_table,
} = discovery;
import db from "../db/index.js";
import Table from "../models/table.js";
import Field from "../models/field.js";
import { afterAll, describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";
import { Row } from "@saltcorn/db-common/internal";
import { assertIsSet } from "./assertions.js";

getState()!.registerPlugin("base", basePluginMod);

// todo do we need to delete tables after tests?
afterAll(db.close);

beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
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
      // this table has FK to users! Table-level FOREIGN KEY: MySQL 8 ignores
      // inline column-level REFERENCES, so no constraint would be created.
      await db.query(
        `create table discperson(
id serial primary key,
name text,
age integer not null,
"user" int,
foreign key ("user") references users(id)
);`
      );
      // this table has 2 FK and column with space in name
      await db.query(
        `create table discdog(
id serial primary key,
name text,
"birth date" date,
owner int,
breed int,
foreign key (owner) references discperson(id),
foreign key (breed) references "disc breed"(id));`
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

describe("Repair primary key", () => {
  if (!db.isSQLite) {
    it("creates table", async () => {
      await db.query(
        `create table twoprimkeys(
        the_x integer,
        the_y integer,
        primary key(the_x,the_y)
      );`
      );
    });
    it("should list tables", async () => {
      const tbls = await discoverable_tables();
      expect(tbls.map((t: Row) => t.table_name)).toContain("twoprimkeys");
    });
    it("should discover", async () => {
      const pack = await discover_tables(["twoprimkeys"]);
      await implement_discovery(pack);
    });
    it("should repair", async () => {
      const table = Table.findOne("twoprimkeys")!;
      assertIsSet(table);
      await table.repairCompositePrimary();
    });
    it("should have an int primary key", async () => {
      const table = Table.findOne("twoprimkeys")!;
      assertIsSet(table);
      expect(table.fields.length).toBe(3);
      expect(table.pk_name).toBe("id");
    });
  } else {
    it("doesnt run on sqlite", async () => {
      expect(2 + 2).toBe(4);
    });
  }
});

describe("reconcile_table", () => {
  if (!db.isSQLite) {
    it("should report all matches for a healthy table", async () => {
      const books = Table.findOne("books")!;
      assertIsSet(books);
      const result = await reconcile_table(books);
      expect(result.ghost_count).toBe(0);
      expect(result.orphan_count).toBe(0);
      expect(result.match_count).toBeGreaterThan(0);
      // All fields should be match
      for (const f of result.fields) {
        expect(f.status).toBe("match");
      }
    });

    it("should detect ghost fields", async () => {
      // Create a table with Saltcorn
      const table = await Table.create("reconcile_test");
      await Field.create({
        table,
        name: "mycol",
        label: "My Column",
        type: "String",
      });
      await Field.create({
        table,
        name: "mycol2",
        label: "My Column 2",
        type: "Integer",
      });

      // Drop the column directly from DB
      await db.query(
        `ALTER TABLE "reconcile_test" DROP COLUMN "mycol"`
      );

      // Refresh table in-memory fields
      const freshTable = Table.findOne("reconcile_test")!;
      assertIsSet(freshTable);
      const result = await reconcile_table(freshTable);

      expect(result.ghost_count).toBe(1);
      const ghost = result.fields.find((f) => f.status === "ghost");
      expect(ghost).toBeDefined();
      expect(ghost!.name).toBe("mycol");

      // mycol2 should still match
      const match = result.fields.find((f) => f.name === "mycol2");
      expect(match).toBeDefined();
      expect(match!.status).toBe("match");
    });

    it("should detect orphan columns", async () => {
      // Add a column directly to DB
      await db.query(
        `ALTER TABLE "reconcile_test" ADD COLUMN "orphan_col" text`
      );

      const freshTable = Table.findOne("reconcile_test")!;
      assertIsSet(freshTable);
      const result = await reconcile_table(freshTable);

      expect(result.orphan_count).toBeGreaterThanOrEqual(1);
      const orphan = result.fields.find((f) => f.status === "orphan");
      expect(orphan).toBeDefined();
      expect(orphan!.name).toBe("orphan_col");
    });

    it("should not report transient calculated fields as ghosts", async () => {
      const table = Table.findOne("reconcile_test")!;
      assertIsSet(table);
      // Add a transient calculated field (calculated=true, stored=false)
      await Field.create({
        table,
        name: "calc_transient",
        label: "Calc Transient",
        type: "String",
        calculated: true,
        stored: false,
        expression: "'hello'",
      });

      // Refresh and reconcile
      const freshTable = Table.findOne("reconcile_test")!;
      assertIsSet(freshTable);
      const result = await reconcile_table(freshTable);

      // The transient field should be a match, not a ghost
      const transient = result.fields.find(
        (f) => f.name === "calc_transient"
      );
      expect(transient).toBeDefined();
      expect(transient!.status).toBe("match");
    });
  } else {
    it("doesnt run on sqlite", async () => {
      expect(2 + 2).toBe(4);
    });
  }
});
