//const Plugin = require("../models/plugin");
const db = require("../db/index.js");

const {
  table_pack,
  view_pack,
  plugin_pack,
  fetch_available_packs,
  fetch_pack_by_name,
  is_stale,
  install_pack,
  can_install_pack
} = require("../models/pack");
const { getState } = require("../db/state");
const Table = require("../models/table.js");

getState().registerPlugin("base", require("../base-plugin"));

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();

  await db.close();
});
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

const todoPack = {
  views: [
    {
      name: "EditTodo",
      table: "TodoItems",
      on_menu: false,
      is_public: true,
      on_root_page: false,
      viewtemplate: "Edit",
      configuration: {
        fixed: { done: false },
        layout: {
          above: [
            {
              aligns: ["left", "left"],
              widths: [2, 10],
              besides: [
                {
                  above: [
                    null,
                    {
                      type: "blank",
                      block: false,
                      contents: "Description",
                      textStyle: ""
                    }
                  ]
                },
                {
                  above: [
                    null,
                    {
                      type: "field",
                      block: false,
                      fieldview: "edit",
                      textStyle: "",
                      field_name: "description"
                    }
                  ]
                }
              ]
            },
            { type: "line_break" },
            { type: "action", block: false, minRole: 10, action_name: "Save" }
          ]
        },
        columns: [
          { type: "Field", fieldview: "edit", field_name: "description" },
          { type: "Action", minRole: 10, action_name: "Save" }
        ],
        viewname: "EditTodo",
        view_when_done: "List Todos"
      }
    },
    {
      name: "List Todos",
      table: "TodoItems",
      on_menu: true,
      is_public: true,
      on_root_page: true,
      viewtemplate: "List",
      configuration: {
        columns: [
          {
            stat: "Count",
            type: "Field",
            view: "Own:EditTodo",
            fieldview: "as_text",
            field_name: "description",
            join_field: "",
            action_name: "Delete",
            state_field: "on",
            agg_relation: ""
          },
          {
            stat: "Count",
            type: "Field",
            view: "Own:EditTodo",
            fieldview: "show",
            field_name: "done",
            join_field: "",
            action_name: "Delete",
            state_field: "on",
            agg_relation: ""
          },
          {
            stat: "Count",
            type: "Action",
            view: "Own:EditTodo",
            fieldview: "as_text",
            field_name: "description",
            join_field: "",
            action_name: "Toggle done",
            state_field: "on",
            agg_relation: ""
          }
        ],
        viewname: "List Todos",
        default_state: { done: false, description: "" },
        view_to_create: "EditTodo"
      }
    }
  ],
  tables: [
    {
      name: "TodoItems",
      fields: [
        {
          name: "description",
          type: "String",
          label: "Description",
          required: true,
          is_unique: false,
          attributes: { options: "" }
        },
        {
          name: "done",
          type: "Bool",
          label: "Done",
          required: true,
          is_unique: false,
          attributes: {}
        }
      ],
      min_role_read: 1,
      min_role_write: 1,
      expose_api_read: false,
      expose_api_write: false
    }
  ],
  pages: [
    {
      name: "FooPage",
      title: "Foo",
      description: "Foo",
      layout: {},
      min_role: 10
    }
  ],
  plugins: []
};

describe("pack install", () => {
  it("installs pack", async () => {
    await install_pack(todoPack, "", () => {});
    const tbl = await Table.findOne({ name: "TodoItems" });
    expect(!!tbl).toBe(true);
  });
  it("cannot install pack again", async () => {
    const can = await can_install_pack(todoPack);
    expect(can).toStrictEqual({ error: "Tables already exist: todoitems" });
  });
  it("warns about duplicates", async () => {
    const { tables, ...restOfPack } = todoPack;
    restOfPack.tables = [];
    restOfPack.pages = [{ name: "FooPage" }];
    const can = await can_install_pack(restOfPack);
    expect(can).toStrictEqual({
      warning:
        "Clashing view EditTodo. Clashing view List Todos. Clashing page FooPage."
    });
  });
});
