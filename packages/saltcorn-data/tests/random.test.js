const { random_table } = require("../models/random");
const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { set_seed } = require("chaos-guinea-pig");

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
const seed = set_seed();

describe("Random table", () => {
  it("can create with seed " + seed, async () => {
    for (let index = 0; index < 10; index++) {
      db.set_sql_logging(true);
      const table = await random_table();
    }
  });
});
