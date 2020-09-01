const { auto_test_plugin } = require("../plugin-testing");
const plugin = require(".");
const db = require("../db");

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("base plugin", () => {
  it("passes auto test", async () => {
    await auto_test_plugin(plugin);
  });
});
