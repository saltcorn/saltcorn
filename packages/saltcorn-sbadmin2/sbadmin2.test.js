const State = require("saltcorn-data/db/state");
const plugin = require(".");

describe("base plugin", () => {
  it("registers", () => {
    plugin.register();
    //expect(State.types.Integer.name).toBe("Integer");
  });
});
