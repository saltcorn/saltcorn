const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");
const db = require("../db");
const { plugin_with_routes, mockReqRes } = require("./mocks");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

const test_show = async ({ columns, layout, response }) => {
  const table = await Table.findOne({ name: "books" });

  const v = await View.create({
    table_id: table.id,
    name: "anewview",
    viewtemplate: "Show",
    configuration: { columns, layout },
    min_role: 10,
    on_root_page: true,
  });

  const res = await v.run({ id: 1 }, mockReqRes);
  expect(res).toBe(response);
  await v.delete();
};

describe("Show view", () => {
  it("should render exactly", async () => {
    await test_show({
      layout: { type: "blank", contents: "Hello world", isFormula: {} },
      columns: [],
      response: `Hello world`,
    });
  });
});
