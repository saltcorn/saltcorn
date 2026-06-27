import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sc_base_plugin = () => (require("../base-plugin/index.js") as any).default;
import db from "../db/index.js";
import { afterAll, describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";

afterAll(db.close);


describe("float read", () => {
  const plugin = _sc_base_plugin();

  const float = plugin.types.find((t: any) => t.name === "Float");
  it("passes auto test", async () => {
    expect(float.read("3.4")).toBe(3.4);
    expect(float.read("3")).toBe(3);
    expect(float.read("$3.4")).toBe(3.4);
    expect(float.read("-14.5e-3")).toBe(-14.5e-3);
    expect(float.read("blah")).toBe(undefined);
  });
});
