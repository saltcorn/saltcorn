const { auto_test_plugin } = require("saltcorn-data/plugin-testing");
const plugin = require(".");

describe("sbadmin2 plugin", () => {
  it("passes auto test", async () => {
    await auto_test_plugin(plugin);
  });
});
