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
  name: "authorfilter1",
  configuration: {
    layout: {
      type: "tabs",
      ntabs: 2,
      tabId: "",
      showif: ["pages<800", "pages>800"],
      titles: ["Less than 800", "More than 800"],
      contents: [
        {
          font: "",
          icon: "",
          type: "blank",
          block: false,
          style: {},
          inline: false,
          contents: "Hello world",
          labelFor: "",
          isFormula: {},
          textStyle: "",
        },
        {
          font: "",
          icon: "",
          type: "blank",
          block: false,
          style: {},
          inline: false,
          contents: "Hello world",
          labelFor: "",
          isFormula: {},
          textStyle: "",
        },
      ],
      deeplink: true,
      tabsStyle: "Accordion",
      independent: false,
      startClosed: false,
      acc_init_opens: [],
      serverRendered: false,
      disable_inactive: false,
    },
    columns: [],
  },
};

const mkViewWithCfg = async (viewCfg: any): Promise<View> => {
  return await View.create({
    viewtemplate: "Filter",
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

describe("Filter view with accordion", () => {
  it("should run", async () => {
    const view = await mkViewWithCfg(accordionConfig);
    const vres1 = await view.run({ pages: 950 }, mockReqRes);
    expect(vres1).toContain("More than 800");
    expect(vres1).not.toContain("Less than 800");
    const view1 = View.findOne({ id: view.id });
    assertIsSet(view1);
    const vres2 = await view1.run({ pages: 700 }, mockReqRes);
    expect(vres2).toContain("Less than 800");
    expect(vres2).not.toContain("More than 800");
  });
});

describe("Filter view components", () => {
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
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toBe(
      `<div class="form-namespace"><script>(function(f){if (document.readyState === "complete") f(); else document.addEventListener(\'DOMContentLoaded\',()=>setTimeout(f),false)})(function(){common_done({"notify":"Hello!"}, "${view.name}")});</script></div>`
    );
  });
  it("isEdit field", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "field",
          block: false,
          fieldview: "edit",
          textStyle: "",
          field_name: "pages",
          configuration: {},
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "edit",
            textStyle: "",
            field_name: "pages",
            configuration: {},
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toBe(
      '<div class="form-namespace"><input type="number" class="form-control" data-fieldname="pages" name="pages" onChange="set_state_field(\'pages\', this.value, this)" id="inputpages" step="1" min="0"></div>'
    );
  });
  it("isFilter field", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "field",
          block: false,
          fieldview: "range_interval",
          textStyle: "",
          field_name: "pages",
          configuration: {},
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "range_interval",
            textStyle: "",
            field_name: "pages",
            configuration: {},
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toBe(
      '<div class="form-namespace"><section class="range-slider"><span class="rangeValues"></span><input value="0" min="0" type="range" onChange="set_state_field(\'_gte_pages\', this.value, this)"><input min="0" type="range" onChange="set_state_field(\'_lte_pages\', this.value, this)"></section></div>'
    );
  });
  it("Key field", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "field",
          block: false,
          fieldview: "select",
          textStyle: "",
          field_name: "publisher",
          configuration: {},
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "select",
            textStyle: "",
            field_name: "publisher",
            configuration: {},
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toBe(
      '<div class="form-namespace"><select class="form-control form-select  " data-fieldname="publisher" name="publisher" id="inputpublisher" onChange="set_state_field(\'publisher\', this.value, this)" autocomplete="off"><option value=""></option><option value="1">AK Press</option><option value="2">No starch</option></select></div>'
    );
  });
  it("Embed with no state", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "f11232",
          type: "view",
          view: "authorlist",
          state: "shared",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("Herman Melville");
    expect(vres1).toContain("Leo Tolstoy");
    const vres2 = await view.run({ pages: 728 }, mockReqRes);
    expect(vres2).not.toContain("Herman Melville");
    expect(vres2).toContain("Leo Tolstoy");
  });
  it("Embed with state calc", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          name: "f11232",
          type: "view",
          view: "authorlist",
          state: "shared",
          extra_state_fml: "{pages: +foo+10}",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ foo: 1 }, mockReqRes);
    expect(vres1).not.toContain("Herman Melville");
    expect(vres1).not.toContain("Leo Tolstoy");
    const vres2 = await view.run({ foo: 718 }, mockReqRes);
    expect(vres2).not.toContain("Herman Melville");
    expect(vres2).toContain("Leo Tolstoy");
  });
  it("Clear btn", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "action",
          block: false,
          rndid: "210841",
          nsteps: 1,
          confirm: false,
          minRole: 100,
          isFormula: {},
          action_icon: "",
          action_name: "Clear",
          action_label: "",
          configuration: {},
        },
        columns: [
          {
            type: "Action",
            rndid: "210841",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "Clear",
            action_label: "",
            configuration: {},
          },
        ],
      },
    });
    const vres1 = await view.run({ foo: 1 }, mockReqRes);
    expect(vres1).toBe(
      '<div class="form-namespace"><button onClick="clear_state(\'\', this)" class="btn btn-primary ">Clear</button></div>'
    );
  });
  it("state code action", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "action",
          block: false,
          rndid: "624b52",
          nsteps: 1,
          confirm: false,
          minRole: 100,
          isFormula: {},
          action_icon: "",
          action_name: "run_js_code",
          action_label: "",
          configuration: {
            code: "return {notify: 1}",
            run_where: "Server",
          },
          action_row_variable: "state",
        },
        columns: [
          {
            type: "Action",
            rndid: "624b52",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "run_js_code",
            action_label: "",
            configuration: {
              code: "return {notify: 1}",
              run_where: "Server",
            },
            action_row_variable: "state",
          },
        ],
      },
    });
    const vres1 = await view.run({ pages: 1 }, mockReqRes);
    expect(vres1).toBe(
      `<div class="form-namespace"><a href="javascript:void(0)" onclick="view_post('${view.name}', 'run_action', {rndid:'624b52'}, null, true);" class="btn btn-primary ">run_js_code</a></div>`
    );
    mockReqRes.reset();
    const body = { rndid: "624b52" };
    await view.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      { req: { body } },
      false
    );
    //we don't have referrer set in tests se can't test state
    expect(mockReqRes.getStored().json).toStrictEqual({
      success: "ok",
      notify: 1,
    });
  });
  it("each_matching_row code action", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "action",
          block: false,
          rndid: "624b52",
          nsteps: 1,
          confirm: false,
          minRole: 100,
          isFormula: {},
          action_icon: "",
          action_name: "run_js_code",
          action_label: "",
          configuration: {
            code: "return {notify: pages}",
            run_where: "Server",
          },
          action_row_variable: "each_matching_row",
        },
        columns: [
          {
            type: "Action",
            rndid: "624b52",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "run_js_code",
            action_label: "",
            configuration: {
              code: "return {notify: pages}",
              run_where: "Server",
            },
            action_row_variable: "each_matching_row",
          },
        ],
      },
    });
    const vres1 = await view.run({ pages: 1 }, mockReqRes);
    expect(vres1).toBe(
      `<div class="form-namespace"><a href="javascript:void(0)" onclick="view_post('${view.name}', 'run_action', {rndid:'624b52'}, null, true);" class="btn btn-primary ">run_js_code</a></div>`
    );
    mockReqRes.reset();
    const body = { rndid: "624b52" };
    await view.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      { req: { body } },
      false
    );

    expect(mockReqRes.getStored().json.notify).toContain(967);
    expect(mockReqRes.getStored().json.notify).toContain(728);
  });
  it("container showif", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          type: "container",
          style: {},

          display: "block",
          padding: [0, 0, 0, 0],
          bgFileId: 0,
          contents: {
            font: "",
            icon: "",
            type: "blank",
            block: false,
            style: {},
            inline: false,
            contents: "More Than 800",
            labelFor: "",
            isFormula: {},
            textStyle: "",
          },
          isFormula: {},
          htmlElement: "div",
          showIfFormula: "pages>800",
        },
        columns: [],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toBe('<div class="form-namespace"></div>');
    const vres2 = await view.run({ pages: 500 }, mockReqRes);
    expect(vres2).toBe('<div class="form-namespace"></div>');
    const vres3 = await view.run({ pages: 900 }, mockReqRes);
    expect(vres3).toContain('<div class="form-namespace">');
    expect(vres3).toContain("More Than 800");
  });
});

describe("Filter FTS agg", () => {
  it("runs", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          above: [
            {
              type: "search_bar",
              autofocus: false,
              show_badges: false,
              has_dropdown: false,
            },
            {
              font: "",
              icon: "",
              type: "blank",
              block: false,
              style: {},
              inline: false,
              contents: "Bookcount ",
              labelFor: "",
              isFormula: {},
              textStyle: "",
            },
            {
              stat: "Count",
              type: "aggregation",
              block: false,
              aggwhere: "",
              agg_field: "author",
              textStyle: "",
              agg_relation: "books",
              configuration: {},
            },
          ],
        },
        columns: [
          {
            stat: "Count",
            type: "Aggregation",
            block: false,
            aggwhere: "",
            agg_field: "author",
            textStyle: "",
            agg_relation: "books",
            configuration: {},
          },
        ],
      },
    });

    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("Bookcount 2");

    const view1 = View.findOne({ name: view.name }); //TODO why is this necessary???
    assertIsSet(view1);
    const vres2 = await view1.run({ _fts_books: "Herman" }, mockReqRes);

    expect(vres2).toContain("Bookcount 1");
  });
});
