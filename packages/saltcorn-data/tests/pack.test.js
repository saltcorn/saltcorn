//const Plugin = require("../models/plugin");
const db = require("../db/index.js");

const {
  table_pack,
  view_pack,
  plugin_pack,
  fetch_available_packs,
  fetch_pack_by_name,
  is_stale
} = require("../models/pack");
const { getState } = require("../db/state");

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
jest.setTimeout(30000);

describe("pack create", () => {
  it("creates table pack", async () => {
    const tpack = await table_pack("patients");
    expect(tpack.fields.length > 1).toBe(true);
    expect(tpack.name).toBe("patients");
  });
  it("creates view pack", async () => {
    const vpack = await view_pack("authorlist");
    expect(vpack).toStrictEqual({
      configuration: {
        columns: [
          { field_name: "author", state_field: "on", type: "Field" },
          { type: "ViewLink", view: "Own:authorshow" },
          { action_name: "Delete", type: "Action" },
          {
            agg_field: "name",
            agg_relation: "patients.favbook",
            stat: "Count",
            type: "Aggregation"
          }
        ]
      },
      is_public: true,
      name: "authorlist",
      table: "books",
      viewtemplate: "List"
    });
  });
  it("creates view pack", async () => {
    const ppack = await plugin_pack("base");
    expect(ppack).toStrictEqual({
      location: "@saltcorn/base-plugin",
      name: "base",
      source: "npm"
    });
  });
});

describe("pack store", () => {
  var packs;
  it("reset the pack store cache", async () => {
    getState().deleteConfig("available_packs");
    getState().deleteConfig("available_packs_fetched_at");
  });
  it("fetches the pack store", async () => {
    packs = await fetch_available_packs();
    expect(packs.length > 0).toBe(true);
    const cache = getState().getConfig("available_packs", false);
    expect(packs).toStrictEqual(cache);
  });
  it("fetches packs from the pack store", async () => {
    const pack = await fetch_pack_by_name(packs[0].name);
  });
  it("tries to fetch dummy pack from the pack store", async () => {
    const nopack = await fetch_pack_by_name("nosuchpack");
    expect(nopack).toBe(null);
  });
  it("caches the pack store", async () => {
    const stored_at = getState().getConfig("available_packs_fetched_at", false);
    expect(is_stale(stored_at)).toBe(false);
    await getState().setConfig("available_packs", []);
    const packs1 = await fetch_available_packs();
    expect(packs1).toStrictEqual([]);
  });
  it("reset the pack store cache", async () => {
    getState().deleteConfig("available_packs");
    getState().deleteConfig("available_packs_fetched_at");
  });
});
