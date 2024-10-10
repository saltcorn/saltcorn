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
      `<a href="javascript:void(0)" onclick="view_post('${view.name}', 'run_action', {rndid:'b6fd72', id:'1'});" class="btn btn btn-primary ">toast</a>`
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
      'data-sc-view-source="/view/patientlist?favbook=1"><div class="table-responsive">'
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
      'data-sc-view-source="/view/patientlist?favbook=1&parent=1"><div class="table-responsive">'
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
      '<div class="d-inline" data-sc-embed-viewname="patientlist" data-sc-local-state="/view/patientlist?favbook=1"><div class="table-responsive"><table '
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
      '<div class="d-inline" data-sc-embed-viewname="patientlist" data-sc-view-source="/view/patientlist"><div class="table-responsive"><table'
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
    const books = Table.findOne("books");
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
    await getState().refresh_tables();
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

describe("joinfield localisation in show view", () => {
  it("should setup", async () => {
    const books = Table.findOne("publisher");
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
    await getState().refresh_tables();
    const afield = Table.findOne("publisher")?.getField("name");
    expect(afield?.attributes?.localized_by?.de).toBe("german_name");
    await getState().setConfig("localizer_languages", {
      de: "German",
    });
    await getState().setConfig("localizer_strings", {
      de: { "Publisher:": "Verlag:" },
    });
    await getState().refresh_i18n();
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
