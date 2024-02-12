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

const mkViewWithCfg = async (viewCfg: any): Promise<View> => {
  return await View.create({
    viewtemplate: "Show",
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
          bgType: "None",
          hAlign: "left",
          margin: [0, 0, 0, 0],
          rotate: 0,
          vAlign: "top",
          bgColor: "#ffffff",
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
            contents: "In Container",
            labelFor: "",
            isFormula: {},
            textStyle: "",
          },
          imageSize: "contain",
          isFormula: {},
          minHeight: 0,
          textColor: "#ffffff",
          htmlElement: "div",
          showForRole: [],
          gradEndColor: "#88ff88",
          setTextColor: false,
          fullPageWidth: false,
          gradDirection: "0",
          showIfFormula: "pages>800",
          gradStartColor: "#ff8888",
          minScreenWidth: "md",
          show_for_owner: false,
        },
        columns: [],
      },
    });
    const vres1 = await view.run({ id: 1 }, mockReqRes);
    expect(vres1).toBe(
      '<div class="text-start d-none d-md-block" style="min-height: 0px;    ">In Container</div>'
    );
    const vres2 = await view.run({ id: 2 }, mockReqRes);
    expect(vres2).toBe("");
  });
});
