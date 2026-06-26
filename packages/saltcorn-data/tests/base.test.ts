import db from "../db";
import { afterAll, describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";

afterAll(db.close);


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
