const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const View = require("saltcorn-data/models/view");
const db = require("saltcorn-data/db");

const State = require("../db/state");
State.registerPlugin(require('../base-plugin'))

afterAll(db.close);

describe("View", () => {
  it("should run with no query", async done => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({});
    expect(res.length > 0).toBe(true);
    done();
  });
  it("should run with string query", async done => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ author: "Mel" });

    expect(res.length > 0).toBe(true);
    done();
  });
  it("should run with integer query as int", async done => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: 967 });

    expect(res.length > 0).toBe(true);
    done();
  });
  it("should run with integer query as string", async done => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: "967" });
    expect(res.length > 0).toBe(true);
    done();
  });
  it("should find", async done => {
    const link_views = await View.find({
      table_id: 1
    });
    expect(link_views.length).toBe(2);
    done();
  });
});
