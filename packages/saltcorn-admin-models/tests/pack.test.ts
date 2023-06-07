import db from "@saltcorn/data/db/index";
import pack from "../models/pack";
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  library_pack,
  trigger_pack,
  role_pack,
  fetch_available_packs,
  fetch_pack_by_name,
  install_pack,
  can_install_pack,
  uninstall_pack,
} = pack;
const { isStale } = require("@saltcorn/data/utils");
const { getState } = require("@saltcorn/data/db/state");
import Table from "@saltcorn/data/models/table";
import { Pack } from "@saltcorn/types/base_types";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import Trigger from "@saltcorn/data/models/trigger";
//import Trigger from "@saltcorn/data/models/trigger";

getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));

beforeAll(async () => {
  await require("@saltcorn/data/db/reset_schema")();
  await require("@saltcorn/data/db/fixtures")();
});

afterAll(async () => {
  await require("@saltcorn/data/db/reset_schema")();
  await require("@saltcorn/data/db/fixtures")();

  await db.close();
});
jest.setTimeout(30000);

describe("pack create", () => {
  // table packs
  it("creates table pack", async () => {
    const tpack = await table_pack("patients");
    expect(tpack.fields.length > 1).toBe(true);
    expect(tpack.name).toBe("patients");
  });

  it("creates table pack for patients 2", async () => {
    const table = await Table.findOne({ name: "patients" });
    expect(table !== null).toBe(true);
    const tpack = await table_pack(table !== null ? table : "patients");
    expect(tpack.fields.length > 1).toBe(true);
    expect(tpack.name).toBe("patients");
  });

  it("creates table pack for users", async () => {
    const tpack = await table_pack("users");
    expect(tpack.fields.length > 1).toBe(true);
    expect(tpack.name).toBe("users");
  });

  it("creates table pack for non existing table", async () => {
    try {
      await table_pack("nonexist_table");
    } catch (error: any) {
      expect(error.message).toMatch("Unable to find table 'nonexist_table'");
    }
  });

  // view packs
  it("creates view pack", async () => {
    const vpack = await view_pack("authorlist");
    expect(vpack).toEqual({
      attributes: null,
      configuration: {
        columns: [
          { field_name: "author", state_field: "on", type: "Field" },
          { type: "ViewLink", view: "Own:authorshow" },
          { action_name: "Delete", type: "Action" },
          {
            agg_field: "name",
            agg_relation: "patients.favbook",
            stat: "Count",
            type: "Aggregation",
          },
        ],
      },
      exttable_name: null,
      min_role: 100,
      name: "authorlist",
      menu_label: undefined,
      slug: null,
      table: "books",
      viewtemplate: "List",
      default_render_page: null,
    });
  });

  it("creates view pack for non existing view", async () => {
    try {
      await view_pack("nonexist_view");
    } catch (error: any) {
      expect(error.message).toMatch("Unable to find view 'nonexist_view'");
    }
  });

  // plugin packs
  it("creates plugin pack", async () => {
    const ppack = await plugin_pack("base");
    expect(ppack).toStrictEqual({
      configuration: null,
      location: "@saltcorn/base-plugin",
      name: "base",
      deploy_private_key: null,
      source: "npm",
    });
  });

  it("creates plugin pack for non existing plugin", async () => {
    try {
      await plugin_pack("nonexist_plugin");
    } catch (error: any) {
      expect(error.message).toMatch("Unable to find plugin 'nonexist_plugin'");
    }
  });

  // page packs
  it("creates page pack", async () => {
    const ppack = await page_pack("a_page");
    expect(ppack).toEqual({
      name: "a_page",
      title: "grgw",
      description: "rgerg",
      menu_label: undefined,
      min_role: 100,
      layout: {
        above: [
          {
            type: "blank",
            block: false,
            contents: "Hello world",
            textStyle: "",
          },
          { type: "line_break" },
          { type: "blank", isHTML: true, contents: "<h1> foo</h1>" },
          {
            url: "https://saltcorn.com/",
            text: "Click here",
            type: "link",
            block: false,
            textStyle: "",
          },
          {
            type: "card",
            title: "header",
            contents: {
              above: [
                null,
                {
                  aligns: ["left", "left"],
                  widths: [6, 6],
                  besides: [
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          block: false,
                          contents: "Hello world",
                          textStyle: "",
                        },
                      ],
                    },
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          block: false,
                          contents: "Bye bye",
                          textStyle: "",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
      fixed_states: {},
      root_page_for_roles: [],
    });
  });

  it("creates page pack for non existing page", async () => {
    try {
      await page_pack("nonexist_page");
    } catch (error: any) {
      expect(error.message).toMatch(
        "Cannot read properties of undefined (reading 'is_root_page_for_roles')"
      );
    }
  });

  // todo library packs - needs to add library to fixture
  // trigger packs
  it("creates trigger pack", async () => {
    // triggers
    await Trigger.create({
      name: "NeverActionTrigger",
      action: "webhook",
      description: "This is test trigger1",
      //table_id: null
      when_trigger: "Never",
      configuration: {
        // from https://requestbin.com/
        // to inspect https://pipedream.com/sources/dc_jku44wk
        url: "https://b6af540a71dce96ec130de5a0c47ada6.m.pipedream.net",
      },
    });

    const trpack = await trigger_pack("NeverActionTrigger");
    //expect(trpack.name ).toBe(true);
    expect(trpack.when_trigger).toBe("Never");
  });

  // role packs
  it("creates roles pack", async () => {
    const rpack = await role_pack("admin");
    expect(rpack.id === 1).toBe(true);
    expect(rpack.role).toBe("admin");
  });
});

// pack store
describe("pack store", () => {
  let packs = new Array<{ name: string }>();
  it("reset the pack store cache", async () => {
    await getState().deleteConfig("available_packs");
    await getState().deleteConfig("available_packs_fetched_at");
  });
  it("fetches the pack store", async () => {
    packs = await fetch_available_packs();
    expect(packs.length > 0).toBe(true);
    const cache = getState().getConfig("available_packs", false);
    expect(packs).toStrictEqual(cache);
  });
  it("fetches packs from the pack store", async () => {
    const pack = await fetch_pack_by_name(packs[0].name);
    // todo expect
    // todo more cases
  });
  it("tries to fetch dummy pack from the pack store", async () => {
    const nopack = await fetch_pack_by_name("nosuchpack");
    expect(nopack).toBe(null);
  });
  it("caches the pack store", async () => {
    const stored_at = getState().getConfig("available_packs_fetched_at", false);
    expect(isStale(stored_at)).toBe(false);
    await getState().setConfig("available_packs", []);
    const packs1 = await fetch_available_packs();
    expect(packs1).toEqual([]);
  });
  it("reset the pack store cache", async () => {
    await getState().deleteConfig("available_packs");
    await getState().deleteConfig("available_packs_fetched_at");
  });
});

const todoPack: Pack = {
  views: [
    {
      name: "EditTodo",
      table: "TodoItems",
      on_menu: false,
      min_role: 100,
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
                      textStyle: "",
                    },
                  ],
                },
                {
                  above: [
                    null,
                    {
                      type: "field",
                      block: false,
                      fieldview: "edit",
                      textStyle: "",
                      field_name: "description",
                    },
                  ],
                },
              ],
            },
            { type: "line_break" },
            { type: "action", block: false, minRole: 100, action_name: "Save" },
          ],
        },
        columns: [
          { type: "Field", fieldview: "edit", field_name: "description" },
          { type: "Action", minRole: 100, action_name: "Save" },
        ],
        viewname: "EditTodo",
        view_when_done: "List Todos",
      },
    },
    {
      name: "List Todos",
      table: "TodoItems",
      min_role: 100,
      menu_label: "List",
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
            agg_relation: "",
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
            agg_relation: "",
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
            agg_relation: "",
          },
        ],
        viewname: "List Todos",
        default_state: { done: false, description: "" },
        view_to_create: "EditTodo",
      },
    },
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
          attributes: { options: "" },
        },
        {
          name: "done",
          type: "Bool",
          label: "Done",
          required: true,
          is_unique: false,
          attributes: {},
        },
      ],
      min_role_read: 1,
      min_role_write: 1,
    },
  ],
  pages: [
    {
      name: "FooPage",
      menu_label: "FooPage",
      title: "Foo",
      description: "Foo",
      layout: {},
      min_role: 100,
      root_page_for_roles: ["public"],
    },
  ],
  plugins: [],
  roles: [],
  library: [],
  triggers: [],
};

describe("pack install", () => {
  it("installs pack", async () => {
    const can = await can_install_pack(todoPack);
    expect(can).toBe(true);
    await install_pack(todoPack, "Todo list", () => {});
    const tbl = await Table.findOne({ name: "TodoItems" });
    expect(!!tbl).toBe(true);
    const menu = getState().getConfig("menu_items", []);
    expect(menu).toEqual([
      { label: "List", type: "View", viewname: "List Todos", min_role: 100 },
      { label: "FooPage", pagename: "FooPage", type: "Page", min_role: 100 },
    ]);
    const pubhome = getState().getConfig("public_home", []);
    expect(pubhome).toBe("FooPage");
  });
  it("cannot install pack again", async () => {
    const can = await can_install_pack(todoPack);
    expect(can).toStrictEqual({ error: "Tables already exist: todoitems" });
  });
  it("warns about duplicates", async () => {
    const { ...restOfPack } = todoPack;
    restOfPack.tables = [];
    const can = await can_install_pack(restOfPack);
    expect(can).toStrictEqual({
      warning:
        "Clashing view EditTodo. Clashing view List Todos. Clashing page FooPage.",
    });
  });
  it("installs pack again anyways", async () => {
    await install_pack(todoPack, "Todo list", () => {});
  });
  it("uninstalls pack", async () => {
    // todo make pack with trigger to cover all logic!
    await uninstall_pack(todoPack, "Todo list");
    const tbl = await Table.findOne({ name: "TodoItems" });
    expect(!!tbl).toBe(false);
  });
});
