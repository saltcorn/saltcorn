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
  it("interpolates HTML", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "blank",
                isHTML: true,
                contents: "{{ author}}: {{pages+10}}",
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("<td>Herman Melville: 977</td>");
  });
  it("show if true", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              showif: "pages<800",
              contents: {
                type: "field",
                block: false,
                fieldview: "as_text",
                textStyle: "",
                field_name: "author",
                configuration: {},
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
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
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).not.toContain("Herman Melville");
    expect(vres1).toContain("Leo Tolstoy");
  });
  it("show if true with joinfield", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              showif: 'publisher?.name === "AK Press"',
              contents: {
                type: "field",
                block: false,
                fieldview: "as_text",
                textStyle: "",
                field_name: "author",
                configuration: {},
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
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
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).not.toContain("Herman Melville");
    expect(vres1).toContain("Leo Tolstoy");
  });
  it("dropdown menu", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "dropdown_menu",
                block: false,
                label: "Menu",
                contents: {
                  above: [
                    {
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
                    {
                      type: "action",
                      block: false,
                      rndid: "f729aa",
                      nsteps: 1,
                      confirm: false,
                      minRole: 100,
                      isFormula: {},
                      action_icon: "",
                      action_name: "Delete",
                      action_label: "",
                      configuration: {},
                    },
                  ],
                },
                action_icon: "",
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            type: "ViewLink",
            view: "show_publisher",
            block: false,
            label: "publisher.name",
            minRole: 100,
            relation: ".books.publisher",
            link_icon: "",
          },
          {
            type: "Action",
            rndid: "f729aa",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "Delete",
            action_label: "",
            configuration: {},
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain(
      `<form action="/delete/books/1?redirect=/view/${view.name}" method="post">`
    );
    expect(vres1).toContain('<a href="/view/show_publisher?id=1">AK Press</a>');
    expect(vres1).toContain("dropdown-menu");
  });
  it("with label formula viewlink", async () => {
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
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain('<a href="/view/show_publisher?id=1">AK Press</a>');
  });

  it("with label formula viewlink and join field", async () => {
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
            {
              contents: {
                type: "join_field",
                block: false,
                fieldview: "as_text",
                textStyle: "",
                join_field: "publisher.name",
                configuration: {},
              },
              alignment: "Default",
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
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain('<a href="/view/show_publisher?id=1">AK Press</a>');
    expect(vres1).toContain("<td>AK Press</td>");
  });

  it("row inclusion", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "as_text",
                textStyle: "",
                field_name: "author",
                configuration: {},
              },
              alignment: "Default",
              col_width_units: "px",
            },
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "show",
                textStyle: "",
                field_name: "pages",
                configuration: {},
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
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
          {
            type: "Field",
            block: false,
            fieldview: "show",
            textStyle: "",
            field_name: "pages",
            configuration: {},
          },
        ],
        default_state: {
          include_fml: "pages>800",
        },
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("<td>Herman Melville</td>");
    expect(vres1).not.toContain("<td>Leo Tolstoy</td>");
  });
  it("row exclusion and click url", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "as_text",
                textStyle: "",
                field_name: "author",
                configuration: {},
              },
              alignment: "Default",
              col_width_units: "px",
            },
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "show",
                textStyle: "",
                field_name: "pages",
                configuration: {},
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
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
          {
            type: "Field",
            block: false,
            fieldview: "show",
            textStyle: "",
            field_name: "pages",
            configuration: {},
          },
        ],
        default_state: {
          exclusion_where: "parent === user.id",
          exclusion_relation: "patients.favbook",
          _row_click_url_formula: "`/view/authorshow?id=${id}`",
        },
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("<td>Herman Melville</td>");
    expect(vres1).not.toContain("<td>Leo Tolstoy</td>");
    expect(vres1).toContain(
      `<tr onclick="location.href='/view/authorshow?id=1'">`
    );
  });
  it("field with fieldview config", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "show_with_html",
                textStyle: "",
                field_name: "author",
                configuration: {
                  code: "Low:{{it.toLowerCase()}}",
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "show_with_html",
            textStyle: "",
            field_name: "author",
            configuration: {
              code: "Low:{{it.toLowerCase()}}",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("<td>Low:herman melville</td>");
  });
  it("joinfield with fieldview config", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "join_field",
                block: false,
                fieldview: "show_with_html",
                textStyle: "",
                join_field: "publisher.name",
                configuration: {
                  code: 'pub:{{ (it||"").toLowerCase()}}',
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            type: "JoinField",
            block: false,
            fieldview: "show_with_html",
            textStyle: "",
            join_field: "publisher.name",
            configuration: {
              code: 'pub:{{ (it||"").toLowerCase()}}',
            },
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("<td>pub:ak press</td>");
  });
  it("aggregation with int fieldview config", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                stat: "Max",
                type: "aggregation",
                block: false,
                aggwhere: "",
                agg_field: "id",
                textStyle: "",
                agg_relation: "patients.favbook",
                agg_fieldview: "show_with_html",
                configuration: {
                  code: "MAX:{{it}}",
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            stat: "Max",
            type: "Aggregation",
            block: false,
            aggwhere: "",
            agg_field: "id",
            textStyle: "",
            agg_relation: "patients.favbook",
            agg_fieldview: "show_with_html",
            configuration: {
              code: "MAX:{{it}}",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("<td>MAX:2</td>");
  });
  it("aggregation with int fieldview config", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                stat: "Max",
                type: "aggregation",
                block: false,
                aggwhere: "",
                agg_field: "name",
                textStyle: "",
                agg_relation: "patients.favbook",
                agg_fieldview: "code",
                configuration: {
                  code: "MAX:{{it}}",
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            stat: "Max",
            type: "Aggregation",
            block: false,
            aggwhere: "",
            agg_field: "name",
            textStyle: "",
            agg_relation: "patients.favbook",
            agg_fieldview: "code",
            configuration: {
              code: "MAX:{{it}}",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain("<code>Michael Douglas</code>");
  });
  it("runs button action", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "action",
                block: false,
                rndid: "d5af6d",
                nsteps: 1,
                confirm: false,
                minRole: 100,
                isFormula: {},
                action_icon: "",
                action_name: "toast",
                action_label: "",
                configuration: {
                  text: "Hello from {{ author }}",
                  notify_type: "Notify",
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            type: "Action",
            rndid: "d5af6d",
            nsteps: 1,
            confirm: false,
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "toast",
            action_label: "",
            configuration: {
              text: "Hello from {{ author}}",
              notify_type: "Notify",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain(
      `<a href="javascript:view_post('${view.name}', 'run_action', {rndid:'d5af6d', id:'1'});" class="btn btn-primary ">toast</a>`
    );
    mockReqRes.reset();
    const body = { action_name: "toast", id: "1" };
    await view.runRoute(
      "run_action",
      body,
      mockReqRes.res,
      { req: { body } },
      false
    );
    expect(mockReqRes.getStored().json).toStrictEqual({
      notify: "Hello from Herman Melville",
      success: "ok",
    });
  });
});

describe("List sort options", () => {
  it("sorts according to default sort options", async () => {
    const layoutColumns = {
      layout: {
        besides: [
          {
            contents: {
              type: "field",
              block: false,
              fieldview: "as_text",
              textStyle: "",
              field_name: "author",
              configuration: {},
            },
            alignment: "Default",
            col_width_units: "px",
          },
        ],
        list_columns: true,
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
    };
    const viewAsc = await mkViewWithCfg({
      configuration: {
        ...layoutColumns,
        default_state: {
          _order_field: "author",
        },
      },
      name: "BookSortAsc",
    });
    const viewDesc = await mkViewWithCfg({
      configuration: {
        ...layoutColumns,
        default_state: {
          _order_field: "author",
          _descending: true,
        },
      },
      name: "BookSortDesc",
    });
    const tBodyAuthors = (authors: string[]) =>
      `<tbody>${authors
        .map((nm) => `<tr><td>${nm}</td></tr>`)
        .join("")}</tbody>`;

    const vres1 = await viewAsc.run({}, mockReqRes);
    expect(vres1).toContain(tBodyAuthors(["Herman Melville", "Leo Tolstoy"]));

    const vres2 = await viewDesc.run({}, mockReqRes);
    expect(vres2).toContain(tBodyAuthors(["Leo Tolstoy", "Herman Melville"]));
    const vres3 = await viewDesc.run({ _28084_sortby: "pages" }, mockReqRes);
    expect(vres3).toContain(tBodyAuthors(["Leo Tolstoy", "Herman Melville"]));
    const vres3a = await viewAsc.run({ _8a82a_sortby: "pages" }, mockReqRes);
    expect(vres3a).toContain(tBodyAuthors(["Leo Tolstoy", "Herman Melville"]));
    const vres4 = await viewDesc.run(
      { _28084_sortby: "pages", _28084_sortdesc: true },
      mockReqRes
    );
    expect(vres4).toContain(tBodyAuthors(["Herman Melville", "Leo Tolstoy"]));
  });
});

describe("List fieldviews", () => {
  it("sets up new fields", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    await Field.create({
      table,
      name: "published",
      label: "Published",
      type: "Date",
    });
    await Field.create({
      table,
      name: "cover_pic",
      label: "Cover Pic",
      type: "File",
    });
    await table.updateRow(
      { published: new Date("1971-05.04"), cover_pic: "magrite.png" },
      1
    );
  });
  it("shows image thumbnail", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "Thumbnail",
                textStyle: "",
                field_name: "cover_pic",
                configuration: {
                  width: "66",
                  expand: true,
                  height: "66",
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "Thumbnail",
            textStyle: "",
            field_name: "cover_pic",
            configuration: {
              width: "66",
              expand: true,
              height: "66",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain(
      `<img src="/files/resize/66/66/magrite.png" onclick="expand_thumbnail('magrite.png', 'magrite.png')">`
    );
  });
  it("relative date", async () => {
    const view = await mkViewWithCfg({
      configuration: {
        layout: {
          besides: [
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "relative",
                textStyle: "",
                field_name: "published",
                configuration: {
                  width: "66",
                  expand: true,
                  height: "66",
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
            {
              contents: {
                type: "field",
                block: false,
                fieldview: "format",
                textStyle: "",
                field_name: "published",
                configuration: {
                  format: "YYYY",
                },
              },
              alignment: "Default",
              col_width_units: "px",
            },
          ],
          list_columns: true,
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "relative",
            textStyle: "",
            field_name: "published",
            configuration: {
              width: "66",
              expand: true,
              height: "66",
            },
          },
          {
            type: "Field",
            block: false,
            fieldview: "format",
            textStyle: "",
            field_name: "published",
            configuration: {
              format: "YYYY",
            },
          },
        ],
      },
    });
    const vres1 = await view.run({}, mockReqRes);
    expect(vres1).toContain(`years ago<`);
    expect(vres1).toContain(`>1971</time>`);
  });
});

//sorting
