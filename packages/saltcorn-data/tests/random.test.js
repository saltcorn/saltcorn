const { random_table } = require("../models/random");
const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { set_seed } = require("chaos-guinea-pig");
const is = require("contractis/is");
const Form = require("../models/form");
const User = require("../models/user");

const { renderForm } = require("@saltcorn/markup");
const fs = require("fs").promises;
const { create_backup, restore } = require("../models/backup");
const reset = require("../db/reset_schema");

jest.setTimeout(30000);

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
const seed = set_seed();

describe("Random table", () => {
  it("can create with seed " + seed, async () => {
    let has_rows = false;
    for (let index = 0; index < 20; index++) {
      //db.set_sql_logging(true);
      const table = await random_table();
      const rows = await table.getJoinedRows({});
      const fields = await table.getFields();
      const nonFkey = fields.filter((f) => !f.is_fkey);
      expect(rows.length > -1).toBe(true);
      //enable versioning
      //if(is.bool.generate())
      await table.update({ versioned: true });
      //update a row
      if (rows.length > 0) {
        has_rows = true;
        const ids = rows.map((r) => r.id);
        const id = is.one_of(ids).generate();
        const row = await table.getRow({ id });

        if (nonFkey.length > 0) {
          const f = is.one_of(nonFkey).generate();
          row[f.name] = await f.generate();
          await table.tryUpdateRow(row, row.id);
        }
      }
      //toggle bool
      const prels = await table.get_parent_relations();
      const crels = await table.get_child_relations();

      // add non-required field

      const form = new Form({ action: "/", fields });
      await form.fill_fkey_options();
      const rendered = renderForm(form, "123");
      expect(rendered).toContain("<form");
    }
    expect(has_rows).toBe(true);
  });
  let fnm;
  it("can backup random tables with seed " + seed, async () => {
    fnm = await create_backup();
  });
  it("can restore random tables with seed " + seed, async () => {
    await reset();
    await User.create({
      email: "admin@foo.com",
      password: "secret",
      role_id: 1,
    });
    await restore(fnm, (p) => {});
    await fs.unlink(fnm);
  });
});
