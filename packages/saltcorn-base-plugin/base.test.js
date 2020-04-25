
const { auto_test_plugin } = require("saltcorn-data/plugin-testing");
const plugin = require("saltcorn-data/base-plugin");
const db = require("saltcorn-data/db");

afterAll(db.close);

describe("base plugin", () => {
  it("passes auto test", async () => {
    await auto_test_plugin(plugin);
  });
});
