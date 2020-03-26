const State = require("saltcorn-data/db/state");
const basePlugin = require("saltcorn-base-plugin");

describe("base plugin", () => {
  it("registers", () => {
    const { types } = basePlugin;
    //expect(State.type_names).toStrictEqual(["String", "Integer", "Bool"]);
    expect(types.length).toBe(3);
  });
});
