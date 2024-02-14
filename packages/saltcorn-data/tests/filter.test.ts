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
      `<div class=\"form-namespace\"><script>(function(f){if (document.readyState === "complete") f(); else document.addEventListener(\'DOMContentLoaded\',()=>setTimeout(f),false)})(function(){common_done({"notify":"Hello!"}, "${view.name}")});</script></div>`
    );
  });
});
