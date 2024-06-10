import Table from "../models/table";
import Field from "../models/field";
import Trigger from "../models/trigger";
import TableConstraint from "../models/table_constraints";

import View from "../models/view";
import db from "../db";
import mocks from "./mocks";
const { mockReqRes } = mocks;
const { getState } = require("../db/state");
import Page from "../models/page";
import type { PageCfg } from "@saltcorn/types/model-abstracts/abstract_page";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { assertIsSet } from "./assertions";
import {
  prepareQueryEnviroment,
  sendViewToServer,
  deleteViewFromServer,
  renderEditInEditConfig,
} from "./remote_query_helper";

let remoteQueries = false;

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

const mkConfig = (hasSave?: boolean, onChange?: boolean) => {
  return {
    layout: {
      above: [
        {
          widths: [2, 10],
          besides: [
            {
              above: [null, { type: "blank", contents: "Name", isFormula: {} }],
            },
            {
              above: [
                null,
                {
                  type: "field",
                  fieldview: "edit",
                  field_name: "name",
                  ...(onChange ? { onchange_action: "fieldchangeaction" } : {}),
                },
              ],
            },
          ],
        },
        { type: "line_break" },
        {
          widths: [2, 10],
          besides: [
            {
              above: [null, { type: "blank", contents: "Age", isFormula: {} }],
            },
            {
              above: [
                null,
                { type: "field", fieldview: "edit", field_name: "age" },
              ],
            },
          ],
        },
        { type: "line_break" },

        ...(hasSave
          ? [
              {
                type: "action",
                rndid: "74310f",
                minRole: 100,
                isFormula: {},
                action_name: "Save",
                action_style: "btn-primary",
                configuration: {},
              },
            ]
          : []),
      ],
    },
    columns: [
      {
        type: "Field",
        fieldview: "edit",
        field_name: "name",
        ...(onChange ? { onchange_action: "fieldchangeaction" } : {}),
      },
      { type: "Field", fieldview: "edit", field_name: "age" },
      ...(hasSave
        ? [
            {
              type: "Action",
              rndid: "74310f",
              minRole: 100,
              isFormula: {},
              action_name: "Save",
              action_style: "btn-primary",
              configuration: {},
            },
          ]
        : []),
    ],
  };
};

describe("Edit view with constraints and validations", () => {
  it("should setup", async () => {
    const persons = await Table.create("ValidatedTable1");
    await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: persons,
      name: "age",
      type: "Integer",
    });
    await TableConstraint.create({
      table_id: persons.id,
      type: "Formula",
      configuration: {
        formula: "age>12",
        errormsg: "Must be at least a teenager",
      },
    });
    await Trigger.create({
      action: "run_js_code",
      table_id: persons.id,
      when_trigger: "Validate",
      configuration: {
        code: `
        if(age && age<16) return {error: "Must be 16+ to qualify"}
        if(!row.name) return {set_fields: {name: "PersonAged"+age}}
      `,
      },
    });
    await View.create({
      name: "ValidatedWithSave",
      table_id: persons.id,
      viewtemplate: "Edit",
      min_role: 100,
      configuration: mkConfig(true),
    });
    await View.create({
      name: "ValidatedAutoSave",
      table_id: persons.id,
      viewtemplate: "Edit",
      min_role: 100,
      configuration: { ...mkConfig(false), auto_save: true },
    });
    await View.create({
      name: "ValidatedShow",
      table_id: persons.id,
      viewtemplate: "Show",
      min_role: 100,
      configuration: {},
    });
  });
  it("should return error on save constrain violation", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { name: "Fred", age: 10 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.flash).toStrictEqual(["error", "Must be at least a teenager"]);
    expect(res.sendWrap[1]).toContain("<form");
    expect(res.sendWrap[1]).toContain('value="Fred"');
    //console.log(res);
    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Fred" })
    ).toBe(0);
  });
  it("should return error on save validate violation", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { name: "Fred", age: 14 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.flash).toStrictEqual(["error", "Must be 16+ to qualify"]);
    expect(res.sendWrap[1]).toContain("<form");
    expect(res.sendWrap[1]).toContain('value="Fred"');
    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Fred" })
    ).toBe(0);
    //console.log(res);
  });
  it("should return save normally", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    v.configuration.view_when_done = "ValidatedShow";
    await v.runPost({}, { name: "Fred", age: 18 }, mockReqRes);
    const res = mockReqRes.getStored();

    expect(!!res.flash).toBe(false);
    expect(res.url).toBe("/view/ValidatedShow?id=1");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Fred" })
    ).toBe(1);
  });
  it("should update normally", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { id: 1, name: "Fred", age: 19 }, mockReqRes);
    const res = mockReqRes.getStored();

    expect(!!res.flash).toBe(false);
    expect(res.url).toBe("/");
    const row = await Table.findOne("ValidatedTable1")!.getRow({
      name: "Fred",
    });
    assertIsSet(row);
    expect(row.age).toBe(19);
  });
  it("should not update to violate constraint", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { id: 1, name: "Fred", age: 10 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.flash).toStrictEqual(["error", "Must be at least a teenager"]);
    expect(res.sendWrap[1]).toContain("<form");
    expect(res.sendWrap[1]).toContain('value="Fred"');

    const row = await Table.findOne("ValidatedTable1")!.getRow({
      name: "Fred",
    });
    assertIsSet(row);
    expect(row.age).toBe(19);
  });
  it("should not update to violate constraint", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { id: 1, name: "Fred", age: 14 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.flash).toStrictEqual(["error", "Must be 16+ to qualify"]);
    expect(res.sendWrap[1]).toContain("<form");
    expect(res.sendWrap[1]).toContain('value="Fred"');

    const row = await Table.findOne("ValidatedTable1")!.getRow({
      name: "Fred",
    });
    assertIsSet(row);
    expect(row.age).toBe(19);
  });
  it("should return error on autosave constrain violation", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { name: "Alex", age: 10 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.status).toBe(422);
    expect(res.json.error).toBe("Must be at least a teenager");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Alex" })
    ).toBe(0);
    mockReqRes.reset();
  });
  it("should return error on autosave validate violation", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { name: "Alex", age: 14 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.status).toBe(422);
    expect(res.json.error).toBe("Must be 16+ to qualify");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Alex" })
    ).toBe(0);
    mockReqRes.reset();
  });
  it("should autosave normally", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { name: "Alex", age: 18 }, mockReqRes);
    const res = mockReqRes.getStored();

    expect(res.json).toStrictEqual({
      view_when_done: undefined,
      url_when_done: "/",
      id: 2,
    });
    //expect(res.json.error).toBe("Must be 16+ to qualify");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Alex" })
    ).toBe(1);
    mockReqRes.reset();
  });
  it("should update autosave normally", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    v.configuration.view_when_done = "ValidatedShow";

    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { id: 1, name: "Fred", age: 20 }, mockReqRes);
    const res = mockReqRes.getStored();

    expect(res.json).toStrictEqual({
      view_when_done: "ValidatedShow",
      url_when_done: "/view/ValidatedShow?id=1",
    });
    //expect(res.json.error).toBe("Must be 16+ to qualify");

    const row = await Table.findOne("ValidatedTable1")!.getRow({
      name: "Fred",
    });
    assertIsSet(row);
    expect(row.age).toBe(20);
    mockReqRes.reset();
  });
  it("should not change existing on validation ", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    v.configuration.view_when_done = "ValidatedShow";
    //remove name column.
    v.configuration.columns = v.configuration.columns.filter(
      (c: any) => c.field_name !== "name"
    );
    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { id: 1, age: 41 }, mockReqRes);
    const res = mockReqRes.getStored();

    expect(res.json).toStrictEqual({
      view_when_done: "ValidatedShow",
      url_when_done: "/view/ValidatedShow?id=1",
    });
    //expect(res.json.error).toBe("Must be 16+ to qualify");

    const row = await Table.findOne("ValidatedTable1")!.getRow({
      id: 1,
    });
    assertIsSet(row);
    expect(row.age).toBe(41);
    expect(row.name).toBe("Fred");
    mockReqRes.reset();
  });
});
describe("Edit-in-edit", () => {
  it("should setup", async () => {
    await View.create({
      name: "EditPublisherWithBooks",
      table_id: Table.findOne("publisher")?.id,
      viewtemplate: "Edit",
      min_role: 100,
      configuration: {
        layout: {
          above: [
            {
              gx: null,
              gy: null,
              style: {
                "margin-bottom": "1.5rem",
              },
              aligns: ["end", "start"],
              widths: [2, 10],
              besides: [
                {
                  above: [
                    null,
                    {
                      font: "",
                      type: "blank",
                      block: false,
                      style: {},
                      inline: false,
                      contents: "Name",
                      labelFor: "name",
                      isFormula: {},
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
                      field_name: "name",
                      configuration: {},
                    },
                  ],
                },
              ],
              breakpoints: ["", ""],
            },
            {
              name: "6dfcdb",
              type: "view",
              view: "ChildList:authoredit.books.publisher",
              state: "shared",
            },
            {
              type: "action",
              block: false,
              rndid: "dbf003",
              minRole: 100,
              isFormula: {},
              action_icon: "",
              action_name: "Save",
              action_size: "",
              action_bgcol: "",
              action_label: "",
              action_style: "btn-primary",
              configuration: {},
              action_textcol: "",
              action_bordercol: "",
            },
          ],
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "edit",
            textStyle: "",
            field_name: "name",
            configuration: {},
          },
          {
            type: "Action",
            rndid: "dbf003",
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "Save",
            action_size: "",
            action_bgcol: "",
            action_label: "",
            action_style: "btn-primary",
            configuration: {},
            action_textcol: "",
            action_bordercol: "",
          },
        ],
        viewname: "EditPublisherWithBooks",
        auto_save: false,
        split_paste: false,
        exttable_name: null,
        page_when_done: null,
        view_when_done: "author_multi_edit",
        dest_url_formula: null,
        destination_type: "View",
        formula_destinations: [],
        page_group_when_done: null,
      },
    });
  });
  it("should run get", async () => {
    const v = await View.findOne({ name: "EditPublisherWithBooks" });
    assertIsSet(v);
    const vres0 = await v.run({}, mockReqRes);
    expect(vres0).toContain("<form");
    expect(vres0).toContain("add_repeater('publisher')");
    const vres1 = await v.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain("<form");
    expect(vres1).toContain("add_repeater('publisher')");
    expect(vres1).toContain("Leo Tolstoy");
    expect(vres1).not.toContain("Melville");
  });
  it("should run post", async () => {
    const v = await View.findOne({ name: "EditPublisherWithBooks" });
    const books = Table.findOne("books");
    assertIsSet(books);
    assertIsSet(v);
    await v.runPost(
      {},
      {
        name: "newpub",
        author_0: "newpubsnewbook",
        author_1: "newpubsotherbook",
      },
      mockReqRes
    );
    const pubrow = await Table.findOne("publisher")?.getRow({ name: "newpub" });
    assertIsSet(pubrow);
    const bookrow = await books.getRow({
      author: "newpubsnewbook",
    });
    assertIsSet(bookrow);
    expect(bookrow.publisher).toBe(pubrow.id);
    expect(bookrow.pages).toBe(678);
    const nbooks1 = await books.countRows({ publisher: pubrow.id });
    expect(nbooks1).toBe(2);
    await v.runPost(
      {},
      {
        id: pubrow.id,
        name: "newpub",
        author_0: "newpubsnewbook",
        id_0: bookrow.id,
      },
      mockReqRes
    );
    const nbooks2 = await books.countRows({ publisher: pubrow.id });
    expect(nbooks2).toBe(1);
  });
});
describe("Edit view field onchange", () => {
  it("should have onchange in get", async () => {
    const persons = await Table.findOne("ValidatedTable1");
    assertIsSet(persons);
    const v = await View.create({
      name: "OnChangeEdit",
      table_id: persons.id,
      viewtemplate: "Edit",
      min_role: 100,
      configuration: mkConfig(false, true),
    });
    await Trigger.create({
      action: "run_js_code",
      table_id: persons.id,
      name: "fieldchangeaction",
      when_trigger: "Never",
      configuration: {
        code: `return {notify: "Hello from trigger"}`,
      },
    });
    const vres0 = await v.run({}, mockReqRes);
    expect(vres0).toContain("<form");
    expect(vres0).toContain(
      `onChange="view_post(this, 'run_action', {onchange_action: 'fieldchangeaction', onchange_field:'name',  ...get_form_record(this) })"`
    );
  });
  it("should run route", async () => {
    const v = await View.findOne({ name: "OnChangeEdit" });
    assertIsSet(v);
    mockReqRes.reset();
    const body = {
      onchange_action: "fieldchangeaction",
      onchange_field: "name",
    };
    await v.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      { req: { body } },
      false
    );
    expect(mockReqRes.getStored().json).toStrictEqual({
      notify: "Hello from trigger",
      success: "ok",
    });
  });
});

const accordionConfig = {
  name: "authoredit1",
  configuration: {
    layout: {
      type: "tabs",
      ntabs: "2",
      tabId: "",
      showif: [null, "pages<800"],
      titles: ["By {{ author }}", "Publisher Tab title {{ publisher }}"],
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

const mkViewWithCfg = async (viewCfg: any): Promise<View> => {
  return await View.create({
    viewtemplate: "Edit",
    description: "",
    min_role: 1,
    name: `someView${Math.round(Math.random() * 100000)}`,
    table_id: Table.findOne("books")?.id,
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
describe("Edit config flow", () => {
  it("should compute for author table", async () => {
    const view = await mkViewWithCfg({
      configuration: {},
    });
    const configFlow = await view.get_config_flow(mockReqRes.req);
    const result = await configFlow.run(
      {
        table_id: view.table_id,
        exttable_name: null,
        viewname: view.name,
        ...view.configuration,
      },
      mockReqRes.req
    );
    const fieldNames = result?.renderBuilder?.options.fields.map(
      (f: Field) => f.name
    );
    expect(fieldNames).toContain("author");
    expect(fieldNames).not.toContain("password");
  });
  it("should compute for users table", async () => {
    const view = await mkViewWithCfg({
      configuration: {},
      table_id: Table.findOne("users")?.id,
    });
    const configFlow = await view.get_config_flow(mockReqRes.req);
    const result = await configFlow.run(
      {
        table_id: view.table_id,
        exttable_name: null,
        viewname: view.name,
        ...view.configuration,
      },
      mockReqRes.req
    );
    const fieldNames = result?.renderBuilder?.options.fields.map(
      (f: Field) => f.name
    );
    expect(fieldNames).not.toContain("author");
    expect(fieldNames).toContain("password");
    expect(fieldNames).toContain("email");
  });
});
describe("Edit view with accordion and join fields", () => {
  it("should run", async () => {
    const view = await mkViewWithCfg(accordionConfig);
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(">By Herman Melville<");
    expect(vres1).not.toContain(">Publisher Tab title");
    expect(vres1).not.toContain(">Publisher JF:");
    const vres2 = await view.run({ id: 2 }, mockReqRes);
    expect(vres2).toContain(">By Leo Tolstoy<");
    expect(vres2).toContain(">Publisher Tab title 1<");
    expect(vres2).toContain(" data-source-url=");
  });
});
describe("Edit view components", () => {
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
      `<form data-viewname="${view.name}" action="/view/${view.name}" class="form-namespace " method="post" data-row-values="%7B%22user%22%3A%7B%22id%22%3A1%2C%22role_id%22%3A1%2C%22attributes%22%3A%7B%7D%7D%2C%22author%22%3A%22Herman%20Melville%22%2C%22pages%22%3A967%2C%22publisher%22%3Anull%7D"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><script>(function(f){if (document.readyState === "complete") f(); else document.addEventListener(\'DOMContentLoaded\',()=>setTimeout(f),false)})(function(){common_done({"notify":"Hello!"}, "${view.name}")});</script></form>`
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
      `<form data-viewname="${view.name}" action="/view/${view.name}" class="form-namespace " method="post" data-row-values="%7B%22user%22%3A%7B%22id%22%3A1%2C%22role_id%22%3A1%2C%22attributes%22%3A%7B%7D%7D%2C%22author%22%3A%22Herman%20Melville%22%2C%22pages%22%3A967%2C%22publisher%22%3Anull%7D"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><a href="javascript:void(0)" onclick="view_post(this, 'run_action', {rndid:'b6fd72', ...get_form_record(this)});" class="btn btn btn-primary ">toast</a></form>`
    );
    mockReqRes.reset();
    const body = { rndid: "b6fd72", id: "1" };
    await view.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      { req: { body } },
      false
    );
    expect(mockReqRes.getStored().json).toStrictEqual({
      notify: "Hello!",
      success: "ok",
    });
  });
  it("runs button action with form input", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          above: [
            {
              type: "field",
              block: false,
              fieldview: "edit",
              textStyle: "",
              field_name: "author",
              configuration: {},
            },
            {
              type: "action",
              block: false,
              rndid: "40bb3f",
              nsteps: "",
              minRole: 100,
              isFormula: {},
              action_icon: "",
              action_name: "toast",
              action_size: "",
              action_bgcol: "",
              action_label: "",
              action_style: "btn-primary",
              configuration: {
                text: "Hello from {{ author}}",
                notify_type: "Notify",
              },
              step_only_ifs: "",
              action_textcol: "",
              action_bordercol: "",
              step_action_names: "",
            },
          ],
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "edit",
            textStyle: "",
            field_name: "author",
            configuration: {},
          },
          {
            type: "Action",
            rndid: "40bb3f",
            nsteps: "",
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "toast",
            action_size: "",
            action_bgcol: "",
            action_label: "",
            action_style: "btn-primary",
            configuration: {
              text: "Hello {{ user.email}} from {{ author}}",
              notify_type: "Notify",
            },
            step_only_ifs: "",
            action_textcol: "",
            action_bordercol: "",
            step_action_names: "",
          },
        ],
      },
    });

    mockReqRes.reset();
    const body = {
      rndid: "40bb3f",
      user: {
        email: "admin@bar.com",
        id: 1,
        role_id: 1,
        language: "en",
      },

      author: "Chris Date",
    };
    await view.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      {
        req: {
          body,
          user: {
            email: "admin@foo.com",
            id: 1,
            role_id: 1,
            language: "en",
          },
        },
      },
      false
    );
    expect(mockReqRes.getStored().json).toStrictEqual({
      notify: "Hello admin@foo.com from Chris Date",
      success: "ok",
    });
  });
  it("runs button action with fixed inputs", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        fixed: {
          author: "MrFoo",
        },
        layout: {
          type: "action",
          block: false,
          rndid: "ca9d71",
          nsteps: 1,
          confirm: false,
          minRole: 100,
          isFormula: {},
          action_icon: "",
          action_name: "toast",
          action_label: "",
          configuration: {
            text: "Hello {{ user.email}} from {{ author}}",
            notify_type: "Notify",
          },
        },
        columns: [
          {
            type: "Action",
            rndid: "ca9d71",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "toast",
            action_label: "",
            configuration: {
              text: "Hello {{ user.email}} from {{ author}}",
              notify_type: "Notify",
            },
          },
        ],
      },
    });

    mockReqRes.reset();
    const body = {
      rndid: "ca9d71",
      user: {
        email: "admin@bar.com",
        id: 1,
        role_id: 1,
        language: "en",
      },
    };
    await view.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      {
        req: {
          body,
          user: {
            email: "admin@foo.com",
            id: 1,
            role_id: 1,
            language: "en",
          },
        },
      },
      false
    );
    expect(mockReqRes.getStored().json).toStrictEqual({
      notify: "Hello admin@foo.com from MrFoo",
      success: "ok",
    });
  });
  it("view link independent same table", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "view_link",
          view: "patientlist",
          block: false,
          minRole: 100,
          relation: ".",
          isFormula: {},
          link_icon: "",
          view_label: "",
        },
        columns: [
          {
            type: "ViewLink",
            view: "patientlist",
            block: false,
            label: "",
            minRole: 100,
            relation: ".",
            link_icon: "",
          },
        ],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain('<a href="/view/patientlist">patientlist</a>');

    // TODO FIX THIS
    //const vres0 = await view.run({}, mockReqRes);
    //expect(vres0).toContain('<a href="/view/patientlist">patientlist</a>');
  });
  it("view link independent different table", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "view_link",
          view: "list_employees",
          block: false,
          minRole: 100,
          relation: ".",
          isFormula: {},
          link_icon: "",
          view_label: "",
        },
        columns: [
          {
            type: "ViewLink",
            view: "list_employees",
            block: false,
            label: "",
            minRole: 100,
            relation: ".",
            link_icon: "",
          },
        ],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(
      '<a href="/view/list_employees">list_employees</a>'
    );

    // TODO FIX THIS
    //const vres0 = await view.run({}, mockReqRes);
    //expect(vres0).toContain(
    //  '<a href="/view/list_employees">list_employees</a>'
    //);
  });
  it("view link children", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "view_link",
          view: "patientlist",
          block: false,
          minRole: 100,
          relation: ".books.patients$favbook",
          isFormula: {},
          link_icon: "",
          view_label: "",
        },
        columns: [
          {
            type: "ViewLink",
            view: "patientlist",
            block: false,
            label: "",
            minRole: 100,
            relation: ".books.patients$favbook",
            link_icon: "",
          },
        ],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(
      '<a href="/view/patientlist?favbook=1">patientlist</a>'
    );

    const vres0 = await view.run({}, mockReqRes);
    expect(vres0).not.toContain("patientlist");
  });
  it("container showif on field", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "container",
          style: {},
          contents: {
            type: "blank",
            block: false,
            style: {},
            inline: false,
            contents: "LONG",
          },
          isFormula: {},
          htmlElement: "div",
          showForRole: [],
          showIfFormula: "pages>500",
          minScreenWidth: "",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain('data-show-if="showIfFormulaInputs(');

    const vres0 = await view.run({}, mockReqRes);
    expect(vres0).not.toContain("patientlist");
  });
  it("container showif on row.field", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "container",
          style: {},
          contents: {
            type: "blank",
            block: false,
            style: {},
            inline: false,
            contents: "LONG",
          },
          isFormula: {},
          htmlElement: "div",
          showForRole: [],
          showIfFormula: "row.pages>500",
          minScreenWidth: "",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain('data-show-if="showIfFormulaInputs(');

    const vres0 = await view.run({}, mockReqRes);
    expect(vres0).not.toContain("patientlist");
  });
  it("container showif on joinfield", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "container",
          style: {},
          contents: {
            type: "blank",
            block: false,
            style: {},
            inline: false,
            contents: "LONG",
          },
          isFormula: {},
          htmlElement: "div",
          showForRole: [],
          showIfFormula: "publisher.name==='AK Press'",
          minScreenWidth: "",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain('data-show-if="showIfFormulaInputs(');
    expect(vres1).toContain("data-show-if-joinfields");
    const vres0 = await view.run({}, mockReqRes);
    expect(vres0).not.toContain("patientlist");
  });
  it("embed view independent different table", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "f98a40",
          type: "view",
          view: "list_employees",
          state: "shared",
          relation: ".",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain("my_department");

    const vres0 = await view.run({}, mockReqRes);
    expect(vres0).toContain("my_department");
  });
  it("embed view independent same table", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "f98a40",
          type: "view",
          view: "authorlist",
          state: "shared",
          relation: ".",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain(">Leo Tolstoy<");
    expect(vres1).toContain(">Herman Melville<");

    const vres0 = await view.run({}, mockReqRes);
    expect(vres0).toContain(">Leo Tolstoy<");
    expect(vres0).toContain(">Herman Melville<");
  });
  it("embed view children", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "4ff12b",
          type: "view",
          view: "patientlist",
          state: "shared",
          relation: ".books.patients$favbook",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toContain("Kirk");
    expect(vres1).toContain('data-sc-embed-viewname="patientlist"');
    expect(vres1).not.toContain("Michael");

    const vres0 = await view.run({}, mockReqRes);
    expect(vres0).not.toContain('data-sc-embed-viewname="patientlist"');
    expect(vres0).toContain("<form");
  });
});
