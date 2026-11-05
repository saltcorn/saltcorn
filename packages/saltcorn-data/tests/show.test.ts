import Table from "../models/table.js";
import Field from "../models/field.js";
import Trigger from "../models/trigger.js";
import TableConstraint from "../models/table_constraints.js";

import View from "../models/view.js";
import db from "../db/index.js";
import * as mocks from "./mocks.js";
import { getState } from "../db/state.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
const { mockReqRes } = mocks;
import Page from "../models/page.js";
import type { PageCfg } from "@saltcorn/types/model-abstracts/abstract_page";
import {
  afterAll,
  beforeAll,
  describe,
  it,
  expect,
} from "@saltcorn/db-common/test_expect";
import { assertIsSet } from "./assertions.js";
import {
  prepareQueryEnviroment,
  sendViewToServer,
  deleteViewFromServer,
  renderEditInEditConfig,
} from "./remote_query_helper.js";
import PlainDate from "@saltcorn/plain-date";
import { GenObj } from "@saltcorn/types/common_types";

let remoteQueries = false;

getState()!.registerPlugin("base", basePluginMod);

afterAll(db.close);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
});

const accordionConfig = {
  name: "authorshow1",
  configuration: {
    layout: {
      type: "tabs",
      ntabs: "2",
      tabId: "",
      showif: [null, "pages<800"],
      titles: ["By {{ author }}", "Publisher Tab title {{ publisher.name }}"],
      contents: [
        {
          font: "",
          icon: "",
          type: "blank",
          block: false,
          style: {},
          inline: false,
          contents: "Hello 1",
          labelFor: "",
          isFormula: {},
          textStyle: "",
        },
        {
          above: [
            {
              font: "",
              icon: "",
              type: "blank",
              block: false,
              style: {},
              inline: false,
              contents: "Publisher JF:&nbsp;",
              labelFor: "",
              isFormula: {},
              textStyle: "",
            },
            {
              type: "join_field",
              block: false,
              fieldview: "show_with_html",
              textStyle: "",
              join_field: "publisher.name",
              configuration: {
                code: "<span>the publisher {{it}} </span>",
              },
            },
          ],
        },
      ],
      deeplink: true,
      tabsStyle: "Accordion",
      independent: false,
      startClosed: false,
      serverRendered: false,
      disable_inactive: false,
    },
    columns: [
      {
        type: "JoinField",
        block: false,
        fieldview: "show_with_html",
        textStyle: "",
        join_field: "publisher.name",
        configuration: {
          code: "<span>the publisher {{it}} </span>",
        },
      },
    ],
  },
};

const mkViewWithCfg = async (viewCfgIn: any): Promise<View> => {
  const { name, table_id, ...viewCfg } = viewCfgIn;
  return await View.create({
    viewtemplate: "Show",
    description: "",
    min_role: 1,
    name: name || `someView${Math.round(Math.random() * 100000)}`,
    table_id: table_id || Table.findOne("books")?.id,
    default_render_page: "",
    slug: {
      label: "",
      steps: [],
    },
    attributes: {
      page_title: "",
      popup_title: "",
      popup_width: null,
      popup_link_out: false,
      popup_minwidth: null,
      page_description: "",
      popup_width_units: null,
      popup_minwidth_units: null,
      popup_save_indicator: false,
    },
    ...viewCfg,
  });
};

describe("Show view with accordion and join fields", () => {
  it("should run", async () => {
    const view = await mkViewWithCfg(accordionConfig);
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(">By Herman Melville<");
    expect(vres1).not.toContain(">Publisher Tab title");
    expect(vres1).not.toContain(">Publisher JF:");
    const vres2 = await view.run({ id: 2 }, mockReqRes);
    expect(vres2).toContain(">By Leo Tolstoy<");
    expect(vres2).toContain(">Publisher Tab title AK Press<");
    expect(vres2).toContain(
      ">Publisher JF:&nbsp;<span>the publisher AK Press </span><"
    );
  });
});

describe("Misc Show views", () => {
  it("runs HTML code", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "blank",
          isHTML: true,
          contents: "Author {{ author }} published by {{ publisher.name }}",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 2 }, mockReqRes);
    expect(vres1).toBe("Author Leo Tolstoy published by AK Press");
  });
  it("runs container showif", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "container",
          style: {},
          contents: {
            type: "blank",
            contents: "In Container",
          },
          minScreenWidth: "md",
          showIfFormula: "pages>800",
          show_for_owner: false,
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toBe(
      '<div class="d-none d-md-block" style="    ">In Container</div>'
    );
    const vres2 = await view.run({ id: 2 }, mockReqRes);
    expect(vres2).toBe("");
  });
  it("runs on_page_load action", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "action",
          block: false,
          rndid: "b6fd72",
          nsteps: 1,
          confirm: false,
          minRole: 100,
          isFormula: {},
          action_icon: "",
          action_name: "toast",
          action_label: "",
          action_style: "on_page_load",
          configuration: {
            text: "Hello!",
            notify_type: "Notify",
          },
        },
        columns: [
          {
            type: "Action",
            rndid: "b6fd72",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "toast",
            action_label: "",
            action_style: "on_page_load",
            configuration: {
              text: "Hello!",
              notify_type: "Notify",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toBe(
      '<script>(function(f){if (document.readyState === "complete") f(); else document.addEventListener(\'DOMContentLoaded\',()=>setTimeout(f),false)})(function(){common_done({"notify":"Hello!"})});</script>'
    );
  });
  it("runs button action", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "action",
          block: false,
          rndid: "b6fd72",
          nsteps: 1,
          confirm: false,
          minRole: 100,
          isFormula: {},
          action_icon: "",
          action_name: "toast",
          action_label: "",
          action_style: "btn btn-primary",
          configuration: {
            text: "Hello!",
            notify_type: "Notify",
          },
        },
        columns: [
          {
            type: "Action",
            rndid: "b6fd72",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "toast",
            action_label: "",
            action_style: "btn btn-primary",
            configuration: {
              text: "Hello!",
              notify_type: "Notify",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toBe(
      `<a href="javascript:void(0)" onclick="{view_post('${view.name}', 'run_action', {rndid:'b6fd72', id:'1'});}" class="btn btn btn-primary ">toast</a>`
    );
    mockReqRes.reset();
    const body = { rndid: "b6fd72", id: "1" };
    await view.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      { req: { ...mockReqRes.req, body }, res: mockReqRes.res },
      false
    );
    expect(mockReqRes.getStored().json).toStrictEqual({
      notify: "Hello!",
      success: "ok",
    });
  });
  it("runs button action with spinner and confirm", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "action",
          block: false,
          rndid: "b6fd72",
          nsteps: 1,
          confirm: true,
          spinner: true,
          minRole: 100,
          isFormula: {},
          action_icon: "",
          action_name: "toast",
          action_label: "",
          action_style: "btn btn-primary",
          configuration: {
            text: "Hello!",
            notify_type: "Notify",
          },
        },
        columns: [
          {
            type: "Action",
            rndid: "b6fd72",
            nsteps: 1,
            confirm: true,
            spinner: true,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "toast",
            action_label: "",
            action_style: "btn btn-primary",
            configuration: {
              text: "Hello!",
              notify_type: "Notify",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toBe(
      `<a href="javascript:void(0)" onclick="if(confirm('Are you sure?')){spin_action_link(this);view_post('${view.name}', 'run_action', {rndid:'b6fd72', id:'1'});}" class="btn btn btn-primary ">toast</a>`
    );
    view.configuration.layout.spinner = false;
    const vres2 = await view.run({ id: 1 }, mockReqRes);
    expect(vres2).toBe(
      `<a href="javascript:void(0)" onclick="if(confirm('Are you sure?')){view_post('${view.name}', 'run_action', {rndid:'b6fd72', id:'1'});}" class="btn btn btn-primary ">toast</a>`
    );
    view.configuration.layout.spinner = true;
    view.configuration.layout.confirm = false;
    const vres3 = await view.run({ id: 1 }, mockReqRes);
    expect(vres3).toBe(
      `<a href="javascript:void(0)" onclick="{spin_action_link(this);view_post('${view.name}', 'run_action', {rndid:'b6fd72', id:'1'});}" class="btn btn btn-primary ">toast</a>`
    );
  });
  it("runs view embed ", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "dd139a",
          type: "view",
          view: "patientlist",
          state: "shared",
          relation: ".books.patients$favbook",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);

    expect(vres1).toContain(
      'data-sc-view-source="/view/patientlist?favbook=1"><div data-sc-state-hash="abf28" data-sc-rows-per-page="20" data-sc-total-rows="1"><div class="table-responsive">'
    );
  });
  it("runs view embed with exta state formula", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "dd139a",
          type: "view",
          view: "patientlist",
          state: "shared",
          extra_state_fml: "{parent: 1}",
          relation: ".books.patients$favbook",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(
      'data-sc-view-source="/view/patientlist?favbook=1&parent=1"><div data-sc-state-hash="9cf8b" data-sc-rows-per-page="20" data-sc-total-rows="0"><div class="table-responsive">'
    );
  });
  it("runs view embed with local state", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "dd139a",
          type: "view",
          view: "patientlist",
          state: "local",
          relation: ".books.patients$favbook",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(
      '<div class="d-inline" data-sc-embed-viewname="patientlist" data-sc-local-state="/view/patientlist?favbook=1" data-sc-view-source="/view/patientlist?favbook=1"><div data-sc-state-hash="abf28" data-sc-rows-per-page="20" data-sc-total-rows="1"><div class="table-responsive"><table '
    );
    expect(vres1).toContain("Kirk Douglas");
    expect(vres1).not.toContain("Michael Douglas");
  });
  it("runs independent view embed", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "dd139a",
          type: "view",
          view: "patientlist",
          state: "shared",
          relation: ".",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(
      '<div class="d-inline" data-sc-embed-viewname="patientlist" data-sc-view-source="/view/patientlist"><div data-sc-state-hash="4043d" data-sc-rows-per-page="20" data-sc-total-rows="2"><div class="table-responsive"><table'
    );
  });
  it("fixes issue 2632", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          font: "",
          icon: "",
          type: "blank",
          block: false,
          style: {},
          inline: false,
          contents:
            'publisher.name[0] + ". " + (publisher.name).match(/(.*?)/g)[0]',
          labelFor: "",
          isFormula: {
            text: true,
          },
          textStyle: "",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 2 }, mockReqRes);
    expect(vres1).toBe("A. ");
  });
});

const deReqRes = {
  res: mockReqRes.res,
  req: { ...mockReqRes.req, getLocale: () => "de" },
};

describe("simple field localisation in show view", () => {
  it("should setup", async () => {
    const books = Table.findOne("books")!;
    assertIsSet(books);
    await Field.create({
      name: "german_name",
      label: "German name",
      type: "String",
      table: books,
      attributes: {
        locale: "de",
        localizes_field: "author",
      },
    });
    await books.updateRow({ german_name: "Thomas Mann" }, 1);
    await mkViewWithCfg({
      name: "just_author",
      configuration: {
        layout: {
          above: [
            {
              font: "",
              icon: "",
              type: "blank",
              block: false,
              style: {},
              inline: false,
              contents: "Author:",
              labelFor: "",
              isFormula: {},
              textStyle: "",
            },
            {
              type: "field",
              block: false,
              fieldview: "as_text",
              textStyle: "",
              field_name: "author",
              configuration: {},
            },
          ],
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "as_text",
            textStyle: "",
            field_name: "author",
            configuration: {},
          },
        ],
      },
    });
    await getState()!.refresh_tables();
    const afield = Table.findOne("books")?.getField("author");
    expect(afield?.attributes?.localized_by?.de).toBe("german_name");
  });
  it("should run in english", async () => {
    const view = View.findOne({ name: "just_author" });
    assertIsSet(view);
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toBe("Author:Herman Melville");
  });
  it("should run in german", async () => {
    const view = View.findOne({ name: "just_author" });
    assertIsSet(view);
    const vres1 = await view.run({ id: 1 }, deReqRes);
    expect(vres1).toBe("Author:Thomas Mann");
  });
});

describe("one-to-one joinfields", () => {
  it("should setup", async () => {
    const parents = await Table.create("O2O Parent");
    const children = await Table.create("O2O Child");
    await Field.create({
      name: "name",
      label: "Name",
      type: "String",
      table: parents,
    });
    await Field.create({
      name: "name",
      label: "Name",
      type: "String",
      table: children,
    });
    await Field.create({
      name: "other",
      label: "Other",
      type: "Key to O2O Parent",
      is_unique: true,
      table: children,
    });
    const parid = await parents.insertRow({ name: "TheParent" });
    await children.insertRow({ name: "TheChild", other: parid });
    await mkViewWithCfg({
      name: "show_o2o",
      table_id: parents.id,
      configuration: {
        layout: {
          type: "join_field",
          block: false,
          fieldview: "as_text",
          textStyle: "",
          join_field: "O2O Child.other->name",
          configuration: {},
        },
        columns: [
          {
            type: "JoinField",
            block: false,
            fieldview: "as_text",
            textStyle: "",
            join_field: "O2O Child.other->name",
            configuration: {},
          },
        ],
      },
    });
    const view = View.findOne({ name: "show_o2o" });
    assertIsSet(view);
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toBe("TheChild");
  });
});

describe("joinfield localisation in show view", () => {
  it("should setup", async () => {
    const books = Table.findOne("publisher")!;
    assertIsSet(books);
    await Field.create({
      name: "german_name",
      label: "German name",
      type: "String",
      table: books,
      attributes: {
        locale: "de",
        localizes_field: "name",
      },
    });
    await books.updateRow({ german_name: "Deutsche AK" }, 1);
    await mkViewWithCfg({
      name: "just_publisher",
      configuration: {
        layout: {
          above: [
            {
              font: "",
              icon: "",
              type: "blank",
              block: false,
              style: {},
              inline: false,
              contents: "Publisher:",
              labelFor: "",
              isFormula: {},
              textStyle: "",
            },
            {
              type: "join_field",
              block: false,
              fieldview: "as_text",
              textStyle: "",
              join_field: "publisher.name",
              configuration: {},
            },
          ],
        },
        columns: [
          {
            type: "JoinField",
            block: false,
            fieldview: "as_text",
            textStyle: "",
            join_field: "publisher.name",
            configuration: {},
          },
        ],
      },
    });
    await getState()!.refresh_tables();
    const afield = Table.findOne("publisher")?.getField("name");
    expect(afield?.attributes?.localized_by?.de).toBe("german_name");
    await getState()!.setConfig("localizer_languages", {
      de: "German",
    });
    await getState()!.setConfig("localizer_strings", {
      de: { "Publisher:": "Verlag:" },
    });
    await getState()!.refresh_i18n();
  });
  it("should run in english", async () => {
    const view = View.findOne({ name: "just_publisher" });
    assertIsSet(view);
    const vres1 = await view.run({ id: 2 }, mockReqRes);
    expect(vres1).toBe("Publisher:AK Press");
  });
  it("should run in german", async () => {
    const view = View.findOne({ name: "just_publisher" });
    assertIsSet(view);
    const vres1 = await view.run({ id: 2 }, deReqRes);
    expect(vres1).toBe("Verlag:Deutsche AK");
  });
});

describe("get by date error", () => {
  let row_id: number;
  beforeAll(async () => {
    const books = Table.findOne("books")!;
    assertIsSet(books);
    await Field.create({
      name: "created_at",
      label: "Created at",
      type: "Date",
      table: books,
      attributes: {},
    });
    await Field.create({
      name: "created_day",
      label: "Created day",
      type: "Date",
      table: books,
      attributes: { day_only: true },
    });
    row_id = await books.insertRow({
      author: "Carl Rogers",
      pages: "356",
      created_at: new Date(),
      created_day: new PlainDate()
    });

    await getState()!.refresh_tables();
  });
  it("should run view on date", async () => {
    const view = View.findOne({ name: "authorshow" });
    assertIsSet(view);
    const row = await Table.findOne("books")!.getRow({ id: row_id });
    const vres1 = await view.run({ created_at: row!.created_at }, mockReqRes);
    expect(vres1).toBe("Carl Rogers");
    const vres2 = await view.run({ created_day: row!.created_day }, mockReqRes);
    expect(vres2).toBe("Carl Rogers");
  });
});

describe("embedded view loops", () => {
  const embed = (view: string, relation: string) => ({
    type: "view",
    view,
    relation,
    state: "shared",
    name: `embed_${view}`,
  });
  beforeAll(async () => {
    const rooms = Table.findOne("rooms")!;
    const messages = Table.findOne("messages")!;
    // room show <-> message show
    await mkViewWithCfg({
      name: "loop_room_show",
      table_id: rooms.id,
      configuration: {
        columns: [],
        layout: embed("loop_msg_show", ".rooms.messages$room"),
      },
    });
    await mkViewWithCfg({
      name: "loop_msg_show",
      table_id: messages.id,
      configuration: {
        columns: [],
        layout: embed("loop_room_show", ".messages.room"),
      },
    });
    // message show <-> room edit
    await View.create({
      name: "loop_room_edit",
      table_id: rooms.id,
      viewtemplate: "Edit",
      min_role: 100,
      configuration: {
        columns: [],
        layout: embed("loop_msg_show_edit", ".rooms.messages$room"),
      },
    });
    await mkViewWithCfg({
      name: "loop_msg_show_edit",
      table_id: messages.id,
      configuration: {
        columns: [],
        layout: embed("loop_room_edit", ".messages.room"),
      },
    });
    // node show embedding the parent node's show, ends at the root
    const nodes = await Table.create("loop_nodes");
    await Field.create({
      table: nodes,
      name: "name",
      label: "Name",
      type: "String",
    });
    await Field.create({
      table: nodes,
      name: "parent",
      label: "Parent",
      type: "Key to loop_nodes",
    });
    await getState()!.refresh_tables();
    const n1 = await nodes.insertRow({ name: "node1" });
    const n2 = await nodes.insertRow({ name: "node2", parent: n1 });
    await nodes.insertRow({ name: "node3", parent: n2 });
    await mkViewWithCfg({
      name: "loop_node_show",
      table_id: nodes.id,
      configuration: {
        columns: [{ type: "Field", field_name: "name", fieldview: "as_text" }],
        layout: {
          above: [
            { type: "field", field_name: "name", fieldview: "as_text" },
            embed("loop_node_show", ".loop_nodes.parent"),
          ],
        },
      },
    });
  });
  it("detects a parent/child Show loop", async () => {
    const view = View.findOne({ name: "loop_room_show" });
    assertIsSet(view);
    await expect(view.run({ id: 1 }, mockReqRes)).rejects.toThrow(
      "(loop_msg_show → loop_room_show → loop_msg_show); infinite loop detected"
    );
  });
  it("detects a loop through an Edit view", async () => {
    const view = View.findOne({ name: "loop_msg_show_edit" });
    assertIsSet(view);
    await expect(view.run({ id: 1 }, mockReqRes)).rejects.toThrow(
      "(loop_msg_show_edit → loop_room_edit → loop_msg_show_edit); infinite loop detected"
    );
  });
  it("renders a self-embedding Show that terminates", async () => {
    const view = View.findOne({ name: "loop_node_show" });
    assertIsSet(view);
    const node3 = await Table.findOne("loop_nodes")!.getRow({ name: "node3" });
    const vres = await view.run({ id: node3!.id }, mockReqRes);
    expect(vres).toContain("node3");
    expect(vres).toContain("node2");
    expect(vres).toContain("node1");
  });
});

describe("Show view picked by fields other than id", () => {
  const contentLayout = {
    type: "field",
    field_name: "content",
    fieldview: "as_text",
  };
  const mkMsgShow = async (name: string, extra: GenObj) =>
    await mkViewWithCfg({
      name,
      table_id: Table.findOne("messages")!.id,
      configuration: {
        columns: [{ type: "Field", field_name: "content", fieldview: "as_text" }],
        layout: contentLayout,
        ...extra,
      },
    });
  const run = async (viewname: string, state: GenObj) => {
    const view = View.findOne({ name: viewname });
    assertIsSet(view);
    return await view.run(state, mockReqRes);
  };
  beforeAll(async () => {
    // fixture: messages 1 and 2 are both in room 1, room 2 has none
    await mkMsgShow("msg_show_first", {});
    await mkMsgShow("msg_show_desc", { row_order_desc: true });
    await mkMsgShow("msg_show_error", { multiple_rows: "Error" });
    await mkMsgShow("msg_show_more", {
      multiple_rows: "First with link to more",
      more_rows_view: "list_messages",
    });
    await mkViewWithCfg({
      name: "room_show_with_last_msg",
      table_id: Table.findOne("rooms")!.id,
      configuration: {
        columns: [],
        layout: {
          type: "view",
          view: "msg_show_desc",
          relation: ".rooms.messages$room",
          state: "shared",
          name: "last_msg",
        },
      },
    });
  });
  it("takes the first match by primary key", async () => {
    const vres = await run("msg_show_first", { room: 1 });
    expect(vres).toContain("first message content for room A");
    expect(vres).not.toContain("sc-show-more");
  });
  it("takes the first match descending", async () => {
    const vres = await run("msg_show_desc", { room: 1 });
    expect(vres).toContain("second message content for room A");
  });
  it("says when nothing matches", async () => {
    expect(await run("msg_show_first", { room: 2 })).toBe("No row selected");
  });
  it("errors on several matches if configured", async () => {
    expect(await run("msg_show_error", { room: 1 })).toBe(
      "More than one row matches"
    );
    const vres = await run("msg_show_error", { id: 2 });
    expect(vres).toContain("second message content for room A");
  });
  it("links to more matches if configured", async () => {
    const vres = await run("msg_show_more", { room: 1 });
    expect(vres).toContain("first message content for room A");
    expect(vres).toContain('href="/view/list_messages?room=1"');
    const vres1 = await run("msg_show_more", { id: 1 });
    expect(vres1).not.toContain("sc-show-more");
  });
  it("orders a Show embedded from a child table", async () => {
    const vres = await run("room_show_with_last_msg", { id: 1 });
    expect(vres).toContain("second message content for room A");
  });
});
