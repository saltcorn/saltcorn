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

const mkViewWithCfg = async (viewCfg: any): Promise<View> => {
  return await View.create({
    viewtemplate: "List",
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

describe("Misc List views", () => {
  it("runs HTML code", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "field",
                fieldview: "as_text",
                field_name: "author",
                configuration: {},
              },
              alignment: "Default",
              header_label: "Author",
              col_width_units: "px",
            },
            {
              contents: {
                type: "view_link",
                view: "show_publisher",
                block: false,
                minRole: 100,
                relation: ".books.publisher",
                isFormula: {
                  label: true,
                },
                link_icon: "",
                view_label: "publisher.name",
              },
              alignment: "Default",
              header_label: "Publisher",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            type: "Field",
            fieldview: "as_text",
            field_name: "author",
            configuration: {},
          },
          {
            type: "ViewLink",
            view: "show_publisher",
            block: false,
            label: "publisher.name",
            minRole: 100,
            relation: ".books.publisher",
            link_icon: "",
          },
        ],
      },
    });
    const vres1 = await view.run({ id: 2 }, mockReqRes);
    expect(vres1).toContain('<a href="/view/show_publisher?id=1">AK Press</a>');
  });

  /* it("runs button action", async () => {
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
      `<a href="javascript:view_post('${view.name}', 'run_action', {rndid:'b6fd72', id:'1'});" class="btn btn btn-primary ">toast</a>`
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
  }); */
});
