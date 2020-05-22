const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const db = require("@saltcorn/data/db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { getConfig, getAllConfig, setConfig } = require("../models/config");
afterAll(db.close);

describe("Config", () => {
  it("should get default", async () => {
    const d = await getConfig("noval", 5);
    expect(d).toBe(5);
  });
  it("should set value", async () => {
    await setConfig("cfg1", 8);
    const d = await getConfig("cfg1", 5);
    expect(d).toBe(8);
    await setConfig("cfg1", 9);
    const x = await getConfig("cfg1", 5);
    expect(x).toBe(9);
  });
  it("should set list int", async () => {
    await setConfig("list_ints", [8]);
    const d = await getConfig("list_ints", 5);
    expect(d).toStrictEqual([8]);
  });
  it("should set list strings", async () => {
    await setConfig("list_strs", ["hello", "World"]);
    const d = await getConfig("list_strs", 5);
    expect(d).toStrictEqual(["hello", "World"]);
  });
  it("should get all value", async () => {
    const d = await getAllConfig();
    expect(d.cfg1).toBe(9);
  });
});
