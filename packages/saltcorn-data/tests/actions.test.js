const Table = require("../models/table");
const Field = require("../models/field");
const Trigger = require("../models/trigger");
const db = require("../db");
const { getState } = require("../db/state");
const {
  plugin_with_routes,
  getActionCounter,
  resetActionCounter,
} = require("./mocks");

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("Action", () => {
  it("should add trigger", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    const table = await Table.findOne({ name: "patients" });

    await Trigger.create({
      action: "incrementCounter",
      table_id: table.id,
      when_trigger: "Insert",
    });
    expect(getActionCounter()).toBe(0);
    await table.insertRow({ name: "Don Fabrizio" });
    expect(getActionCounter()).toBe(1);
  });
});
