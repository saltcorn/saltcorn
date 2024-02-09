import db from "@saltcorn/data/db/index";
import pack from "../models/pack";
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  page_group_pack,
  library_pack,
  trigger_pack,
  role_pack,
  tag_pack,
  model_pack,
  model_instance_pack,
  fetch_available_packs,
  fetch_pack_by_name,
  install_pack,
  can_install_pack,
  uninstall_pack,
  create_pack_from_tag,
} = pack;
import utils from "@saltcorn/data/utils";
const { isStale } = utils;
const { getState } = require("@saltcorn/data/db/state");
import Table from "@saltcorn/data/models/table";
import Tag from "@saltcorn/data/models/tag";
import { Pack } from "@saltcorn/types/base_types";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import Trigger from "@saltcorn/data/models/trigger";
import PageGroup from "@saltcorn/data/models/page_group";
import { assertIsSet } from "@saltcorn/data/tests/assertions";
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
    const table = Table.findOne({ name: "patients" });
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
      description: "",
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
      version: "latest",
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
      attributes: null,
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
      expect(error.message).toMatch("Unable to find page 'nonexist_page'");
    }
  });

  it("creates page group pack", async () => {
    const groupPack = await page_group_pack("page_group");
    expect(groupPack).toEqual({
      name: "page_group",
      description: null,
      min_role: 100,
      members: [
        {
          page_name: "iPhone SE",
          description: null,
          sequence: 1,
          eligible_formula:
            "width < 380 && height < 670 && user.id === 1 && locale === 'en'",
        },
        {
          page_name: "iPhone XR",
          description: null,
          sequence: 2,
          eligible_formula:
            "width < 415 && height < 900 && user.id === 1 && locale === 'en'",
        },
        {
          page_name: "Surface Pro 7",
          description: null,
          sequence: 3,
          eligible_formula:
            "width < 915 && height < 1370 && user.id === 1 && locale === 'en'",
        },
        {
          page_name: "Laptop",
          description: null,
          sequence: 4,
          eligible_formula:
            "width <= 1920 && height <= 1000 && user.id === 1 && locale === 'en'",
        },
      ],
    });
  });

  it("creates page pack for non existing page group", async () => {
    try {
      await page_group_pack("nonexist_page_group");
    } catch (error: any) {
      expect(error.message).toMatch(
        "Unable to find page group 'nonexist_page_group'"
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

  // tag packs
  it("creates tags pack", async () => {
    const tpack = await tag_pack("tag1");
    expect(tpack).toEqual({
      name: "tag1",
      entries: [
        { table_name: "books" },
        { view_name: "authorlist" },
        { view_name: "authorshow" },
        { view_name: "authoredit" },
      ],
    });
    await expect((async () => await tag_pack("tag0"))()).rejects.toThrow();
  });

  // model packs
  it("creates model pack", async () => {
    const mpack = await model_pack("regression_model", "books");
    expect(mpack).toEqual({
      name: "regression_model",
      table_name: "books",
      modelpattern: "regression",
      configuration: { numcluster: 2 },
    });
    await expect(
      (async () => await model_pack("invalid_model", "books"))()
    ).rejects.toThrow();
    await expect(
      (async () => await model_pack("regression_model", "invalid_table"))()
    ).rejects.toThrow();
  });

  // model instance pack
  it("creates model instance pack", async () => {
    const mipack = await model_instance_pack(
      "regression_model_instance",
      "regression_model",
      "books"
    );
    expect(mipack).toEqual({
      name: "regression_model_instance",
      table_name: "books",
      state: {},
      hyperparameters: { numcluster: 2 },
      parameters: {},
      metric_values: {},
      trained_on: new Date("2019-11-11T10:34:00.000Z"),
      fit_object: Buffer.from("foo"),
      is_default: false,
      report: "report",
      model_name: "regression_model",
    });
    await expect(
      (async () =>
        await model_instance_pack(
          "invalid_model_instance",
          "regression_model",
          "books"
        ))()
    ).rejects.toThrow();
    await expect(
      (async () =>
        await model_instance_pack(
          "regression_model_instance",
          "invalid_model",
          "books"
        ))()
    ).rejects.toThrow();
    await expect(
      (async () =>
        await model_instance_pack(
          "regression_model_instance",
          "regression_model",
          "invalid_table"
        ))()
    ).rejects.toThrow();
  });
  it("creates pack from tag", async () => {
    const tag = await Tag.findOne({ name: "tag1" });
    const pack = await create_pack_from_tag(tag);
    expect(pack.tables.length).toBe(1);
    expect(pack.tags.length).toBe(1);
    expect(pack.tags[0].name).toBe("tag1");
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
  page_groups: [
    {
      name: "FooPageGroup",
      description: "Foo",
      min_role: 100,
      members: [
        {
          page_name: "FooPage",
          description: "Foo",
          eligible_formula: "width < 380 && height < 670 && user.id === 1",
        },
      ],
    },
  ],
  plugins: [],
  roles: [],
  library: [],
  triggers: [],
  tags: [],
  models: [],
  model_instances: [],
};

describe("pack install", () => {
  it("installs pack", async () => {
    const can = await can_install_pack(todoPack);
    expect(can).toBe(true);
    await install_pack(todoPack, "Todo list", () => {});
    const tbl = Table.findOne({ name: "TodoItems" });
    expect(!!tbl).toBe(true);
    const menu = getState().getConfig("menu_items", []);
    expect(menu).toEqual([
      { label: "List", type: "View", viewname: "List Todos", min_role: 100 },
      { label: "FooPage", pagename: "FooPage", type: "Page", min_role: 100 },
    ]);
    const pubhome = getState().getConfig("public_home", []);
    expect(pubhome).toBe("FooPage");
    const group = PageGroup.findOne({ name: "FooPageGroup" });
    assertIsSet(group);
    expect(group.members.length).toBe(1);
    expect(group.members[0]).toEqual({
      id: 5,
      page_group_id: 2,
      page_id: 8,
      sequence: 1,
      eligible_formula: "width < 380 && height < 670 && user.id === 1",
      description: "Foo",
    });
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
        "Clashing view EditTodo. Clashing view List Todos. Clashing page FooPage. Clashing page group FooPageGroup.",
    });
  });
  it("installs pack again anyways", async () => {
    await install_pack(todoPack, "Todo list", () => {});
  });
  it("uninstalls pack", async () => {
    // todo make pack with trigger to cover all logic!
    await uninstall_pack(todoPack, "Todo list");
    const tbl = Table.findOne({ name: "TodoItems" });
    expect(!!tbl).toBe(false);
  });
});
