const State = require("saltcorn-data/db/state");
const basePlugin = require("saltcorn-base-plugin");
const { auto_test_plugin } = require("saltcorn-data/plugin-testing");
const plugin = require(".");

describe("base plugin", () => {
  it("registers", () => {
    const { types } = basePlugin;
    //expect(State.type_names).toStrictEqual(["String", "Integer", "Bool"]);
    expect(types.length).toBe(3);
  });
  it("passes auto test", async () => {
    await auto_test_plugin(plugin);
  });
});
