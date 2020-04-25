
const { auto_test_plugin } = require("../plugin-testing");
const plugin = require(".");
const db = require("../db");

afterAll(db.close);

describe("base plugin", () => {
  it("passes auto test", async () => {
    await auto_test_plugin(plugin);
  });
});
