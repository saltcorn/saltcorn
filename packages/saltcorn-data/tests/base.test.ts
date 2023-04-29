import db from "../db";

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

/*describe("base plugin", () => {
  const plugin = require("../base-plugin");
  const { auto_test_plugin } = require("../plugin-testing");
  it("passes auto test", async () => {
    await auto_test_plugin(plugin);
  });
});*/

describe("float read", () => {
  const plugin = require("../base-plugin");

  const float = plugin.types.find((t: any) => t.name === "Float");
  it("passes auto test", async () => {
    expect(float.read("3.4")).toBe(3.4);
    expect(float.read("3")).toBe(3);
    expect(float.read("$3.4")).toBe(3.4);
    expect(float.read("-14.5e-3")).toBe(-14.5e-3);
    expect(float.read("blah")).toBe(undefined);
  });
});
