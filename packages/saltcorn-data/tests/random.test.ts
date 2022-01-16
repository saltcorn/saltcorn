const { random_table, fill_table_row, all_views } = require("../models/random");
import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { set_seed } = require("chaos-guinea-pig");
const is = require("contractis/is");
import generators from "@saltcorn/types/generators";
const { oneOf } = generators;
import Form from "../models/form";
import User from "../models/user";

import markup from "@saltcorn/markup";
const { renderForm } = markup;
import { unlink } from "fs/promises";
import backup from "../models/backup";
const { create_backup, restore, create_csv_from_rows } = backup;
const reset = require("../db/reset_schema");
import mocks from "./mocks";
const { mockReqRes, plugin_with_routes } = mocks;
import Table from "../models/table";
import Field from "../models/field";
import { dir } from "tmp-promise";
import { join } from "path";
import { Row } from "@saltcorn/db-common/internal";
import { assertIsSet, assertsIsSuccessMessage } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

jest.setTimeout(80000);

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
  getState().registerPlugin("mock_plugin", plugin_with_routes);
});
const seed = set_seed();

describe("Random tables", () => {
  let fnm: string;
  let tableCounts = new Array<[table: Table, count: number]>();
  it("can create with seed " + seed, async () => {
    if (!db.isSQLite)
      await db.query('create extension if not exists "uuid-ossp";');
    let has_rows = false;
    for (let index = 0; index < 20; index++) {
      //db.set_sql_logging(true);
      const table = await random_table();
      const rows = await table.getJoinedRows({});
      const fields = await table.getFields();
      const nonFkey = fields.filter((f: Field) => !f.is_fkey && !f.primary_key);
      expect(rows.length > -1).toBe(true);
      //enable versioning
      if (is.bool.generate()) await table.update({ versioned: true });
      //update a row
      let id;
      if (rows.length > 0) {
        has_rows = true;
        id = oneOf(rows.map((r: Row) => r.id));
        const row = await table.getRow({ id });

        if (nonFkey.length > 0) {
          const f = oneOf(nonFkey);
          row[f.name] = await f.generate();
          await table.tryUpdateRow(row, row.id);
        }
      }

      //insert
      await fill_table_row(table);

      //toggle bool
      const prels = await table.get_parent_relations();
      const crels = await table.get_child_relations();

      // add non-required field

      const form = new Form({ action: "/", fields });
      await form.fill_fkey_options();
      const rendered = renderForm(form, "123");
      expect(rendered).toContain("<form");

      const { list, show, edit } = await all_views(table, "List");
      const listres = await list.run({}, mockReqRes);
      expect(listres).toContain("<table");
      const editres = await edit.run({}, mockReqRes);
      expect(editres).toContain("<form");
      if (id) {
        const showres = await show.run({ id }, mockReqRes);
        if (fields.length > 1 && showres !== "<br /><br />")
          expect(showres).toContain("<div");
        const editres1 = await edit.run({ id }, mockReqRes);
        expect(editres1).toContain("<form");
      }
    }
    expect(has_rows).toBe(true);
  });

  it("can backup random tables with seed " + seed, async () => {
    const tables = await Table.find({});
    for (const table of tables) {
      const count = await table.countRows();
      await table.getFields();
      tableCounts.push([table, count]);
    }

    fnm = await create_backup();
  });
  it("can restore random tables with seed " + seed, async () => {
    await reset();
    if (!db.isSQLite)
      await db.query('create extension if not exists "uuid-ossp";');
    await User.create({
      email: "admin@foo.com",
      password: "AhGGr6rhu45",
      role_id: 1,
    });
    const restoreres = await restore(fnm, (p) => {});
    for (const [oldtable, n] of tableCounts) {
      const table = await Table.findOne({ name: oldtable.name });
      assertIsSet(table);
      expect(!!table).toBe(true);
      const count = await table.countRows();
      expect([table.name, count]).toEqual([oldtable.name, n]);
      expect(await table.owner_fieldname()).toEqual(
        await oldtable.owner_fieldname()
      );
    }

    expect(restoreres).toBe(undefined);
    await unlink(fnm);
  });
});
describe("Random table CSV io", () => {
  it("can create with seed " + seed, async () => {
    for (let index = 0; index < 20; index++) {
      const newDir = await dir({ unsafeCleanup: false });
      await reset();
      if (!db.isSQLite)
        await db.query('create extension if not exists "uuid-ossp";');
      await User.create({
        email: "admin@foo.com",
        password: "AhGGr6rhu45",
        role_id: 1,
      });
      await random_table();
      const table = await random_table({ force_int_pk: true });
      const rows1 = await table.getRows({}, { orderBy: "id" });
      if (rows1.length > 0) {
        const fnm = join(newDir.path, table.name + ".csv");
        await create_csv_from_rows(rows1, fnm);
        const crres = await Table.create_from_csv("replica", fnm);
        assertsIsSuccessMessage(crres);
        const rows2 = await crres.table.getRows({}, { orderBy: "id" });
        expect(rows2.length).toBe(rows1.length);
        //expect(rows2).toEqual(rows1);
      }
    }
  });
});
