const State = require("saltcorn-data/db/state");
const basePlugin = require("saltcorn-base");

describe("base plugin", () => {
  it("registers", () => {
    basePlugin.register();
    expect(State.type_names).toStrictEqual(["String", "Integer", "Bool"]);
    expect(State.types.Integer.name).toBe("Integer");
  });
});
