const State = require("saltcorn-data/db/state");
const basePlugin = require("saltcorn-base-plugin");
const { auto_test_plugin } = require("saltcorn-data/plugin-testing");
const plugin = require(".");
const db = require("saltcorn-data/db");

afterAll(db.close);

describe("base plugin", () => {
  it("passes auto test", async () => {
    await auto_test_plugin(plugin);
  });
});
