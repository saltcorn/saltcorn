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
const { is_table_query } = require("../contracts");
getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);

describe("pack create", () => {
  it("creates table pack", async () => {
    const tpack = await table_pack("patients");
    expect(tpack).toStrictEqual({
      expose_api_read: true,
      expose_api_write: false,
      fields: [
        {
          attributes: {},
          fieldview: undefined,
          is_unique: false,
          label: "Name",
          name: "name",
          reftable_name: undefined,
          required: true,
          sublabel: undefined,
          type: "String"
        },
        {
          attributes: { summary_field: "author" },
          fieldview: undefined,
          is_unique: false,
          label: "Favourite book",
          name: "favbook",
          reftable_name: "books",
          required: false,
          sublabel: undefined,
          type: "Key"
        },
        {
          attributes: {},
          fieldview: undefined,
          is_unique: false,
          label: "Parent",
          name: "parent",
          reftable_name: "patients",
          required: false,
          sublabel: undefined,
          type: "Key"
        }
      ],
      min_role_read: 4,
      min_role_write: 1,
      name: "patients"
    });
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
      on_menu: true,
      on_root_page: true,
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
  it("reset the pack store cache", async () => {
    getState().deleteConfig("available_packs")
    getState().deleteConfig("available_packs_fetched_at")
  })
  it("fetches the pack store", async () => {
    const packs = await fetch_available_packs()
    expect(packs.length>0).toBe(true)
    const cache = getState().getConfig("available_packs", false);
    expect(packs).toStrictEqual(cache)

    const stored_at = getState().getConfig("available_packs_fetched_at", false);
    expect(is_stale(stored_at)).toBe(false)

    const pack = await fetch_pack_by_name(packs[0].name)
    const nopack = await fetch_pack_by_name("nosuchpack")
    expect(nopack).toBe(null)

    await getState().setConfig("available_packs", []);
    const packs1 = await fetch_available_packs()
    expect(packs1).toStrictEqual([])
  })
  it("reset the pack store cache", async () => {
  })
  it("reset the pack store cache", async () => {
    getState().deleteConfig("available_packs")
    getState().deleteConfig("available_packs_fetched_at")
  })
})
