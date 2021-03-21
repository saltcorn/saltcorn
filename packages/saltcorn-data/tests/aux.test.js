const View = require("../models/view");
const db = require("../db/index.js");
const Table = require("../models/table");

const { get_parent_views, get_child_views } = require("../plugin-helper");
const { getState } = require("../db/state");

getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("plugin helper", () => {
  it("get parent views", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const x = await get_parent_views(patients, "foobar")
    expect(x[0].views.map(v=>v.name)).toStrictEqual(["authoredit", "authorshow"])
  });
  it("get child views", async () => {
    const books = await Table.findOne({ name: "books" });
    const x = await get_child_views(books, "foobar")
    expect(x[0].views.map(v=>v.name)).toStrictEqual(["patientlist"])
  });
});
