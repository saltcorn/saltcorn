const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const View = require("saltcorn-data/models/view");
const db = require("saltcorn-data/db");

const { getState } = require("../db/state");
getState().registerPlugin("base",require("../base-plugin"));

afterAll(db.close);

describe("View", () => {
  it("should run with no query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({});
    expect(res.length > 0).toBe(true);
  });
  it("should run with string query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ author: "Mel" });

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as int", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: 967 });

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as string", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: "967" });
    expect(res.length > 0).toBe(true);
  });
  it("should find", async () => {
    const link_views = await View.find({
      table_id: 1
    });
    expect(link_views.length).toBe(2);
  });
});
