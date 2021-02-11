const { random_table, fill_table_row, all_views } = require("../models/random");
const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { set_seed } = require("chaos-guinea-pig");
const is = require("contractis/is");
const Form = require("../models/form");
const User = require("../models/user");

const { renderForm } = require("@saltcorn/markup");
const fs = require("fs").promises;
const {
  create_backup,
  restore,
  create_csv_from_rows,
} = require("../models/backup");
const reset = require("../db/reset_schema");
const { mockReqRes, plugin_with_routes } = require("./mocks");
const Table = require("../models/table");
const tmp = require("tmp-promise");
const path = require("path");

jest.setTimeout(60000);

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
  getState().registerPlugin("mock_plugin", plugin_with_routes);
});
const seed = set_seed();
const one_of = (xs) => is.one_of(xs).generate();
describe("Random tables", () => {
  let fnm;
  let tableCounts = [];
  it("can create with seed " + seed, async () => {
    let has_rows = false;
    for (let index = 0; index < 20; index++) {
      //db.set_sql_logging(true);
      const table = await random_table();
      const rows = await table.getJoinedRows({});
      const fields = await table.getFields();
      const nonFkey = fields.filter((f) => !f.is_fkey && !f.primary_key);
      expect(rows.length > -1).toBe(true);
      //enable versioning
      if (is.bool.generate()) await table.update({ versioned: true });
      //update a row
      let id;
      if (rows.length > 0) {
        has_rows = true;
        id = one_of(rows.map((r) => r.id));
        const row = await table.getRow({ id });

        if (nonFkey.length > 0) {
          const f = one_of(nonFkey);
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

    await User.create({
      email: "admin@foo.com",
      password: "AhGGr6rhu45",
      role_id: 1,
    });
    const restoreres = await restore(fnm, (p) => {});
    for (const [oldtable, n] of tableCounts) {
      const table = await Table.findOne({ name: oldtable.name });
      expect(!!table).toBe(true);
      const count = await table.countRows();
      expect([table.name, count]).toEqual([oldtable.name, n]);
      expect(await table.owner_fieldname()).toEqual(
        await oldtable.owner_fieldname()
      );
    }

    expect(restoreres).toBe(undefined);
    await fs.unlink(fnm);
  });
});
describe("Random table CSV io", () => {
  it("can create with seed " + seed, async () => {
    for (let index = 0; index < 20; index++) {
      const dir = await tmp.dir({ unsafeCleanup: false });
      await reset();

      await User.create({
        email: "admin@foo.com",
        password: "AhGGr6rhu45",
        role_id: 1,
      });
      await random_table();
      const table = await random_table({ force_int_pk: true });
      const rows1 = await table.getRows({}, { orderBy: "id" });
      if (rows1.length > 0) {
        const fnm = path.join(dir.path, table.name + ".csv");
        await create_csv_from_rows(rows1, fnm);
        const crres = await Table.create_from_csv("replica", fnm);
        expect(crres.error).toBe(undefined);
        const rows2 = await crres.table.getRows({}, { orderBy: "id" });
        expect(rows2.length).toBe(rows1.length);
        //expect(rows2).toEqual(rows1);
      }
    }
  });
});
