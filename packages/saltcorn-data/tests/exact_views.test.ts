import Table from "../models/table";
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
  if (process.env.REMOTE_QUERIES === "true") {
    getState().setConfig("base_url", "http://localhost:3000");
    remoteQueries = true;
    await prepareQueryEnviroment();
  }
});
const mkTester =
  ({
    name,
    viewtemplate,
    set_id,
    table,
  }: {
    name: string;
    viewtemplate: string;
    set_id?: number;
    table: string;
  }) =>
  async ({
    response,
    id,
    ...rest
  }: {
    response: any;
    id?: number;
    [key: string]: any; // ...rest
  }) => {
    const tbl = await Table.findOne({ name: rest.table || table });
    assertIsSet(tbl);
    const viewCfg: any = {
      table_id: tbl.id,
      name: rest.name || name,
      viewtemplate,
      configuration: rest,
      min_role: 10,
    };
    const v = await View.create(viewCfg);
    if (remoteQueries) await sendViewToServer(viewCfg);
    const configFlow = await v.get_config_flow(mockReqRes.req);
    await configFlow.run(
      {
        table_id: tbl.id,
        exttable_name: v.exttable_name,
        viewname: v.name,
        ...v.configuration,
      },
      mockReqRes.req
    );
    for (const step of configFlow.steps)
      await configFlow.run(
        {
          table_id: tbl.id,
          exttable_name: v.exttable_name,
          viewname: v.name,
          ...v.configuration,
          stepName: step.name,
        },
        mockReqRes.req
      );

    const res = await v.run(
      id ? { id } : set_id ? { id: set_id } : {},
      mockReqRes,
      remoteQueries
    );
    //if (res !== response) console.log(res);
    expect(res).toBe(response);
    if (!rest.noDelete) {
      await v.delete();
      if (remoteQueries) await deleteViewFromServer(v.id!);
    }
  };

const test_page = async ({
  response,
  ...rest
}: {
  response: any;
  [key: string]: any;
}) => {
  const p = await Page.create(rest as PageCfg);
  const contents = await p.run({}, mockReqRes);
  expect(contents).toStrictEqual(response);
  await p.delete();
};

const test_show = mkTester({
  name: "testshow",
  viewtemplate: "Show",
  set_id: 1,
  table: "books",
});
const test_edit = mkTester({
  name: "testedit",
  viewtemplate: "Edit",
  table: "patients",
});
const test_list = mkTester({
  name: "testlist",
  viewtemplate: "List",
  table: "patients",
});
const test_feed = mkTester({
  name: "testlist",
  viewtemplate: "Feed",
  table: "patients",
});
const test_filter = mkTester({
  name: "testfilter",
  viewtemplate: "Filter",
  table: "books",
});

describe("Show view", () => {
  it("should render exactly", async () => {
    await test_show({
      layout: { type: "blank", contents: "Hello world", isFormula: {} },
      columns: [],
      response: `Hello world`,
    });
    await test_show({
      layout: { type: "field", fieldview: "as_text", field_name: "author" },
      columns: [{ type: "Field", fieldview: "as_text", field_name: "author" }],
      response: `Herman Melville`,
    });
    await test_show({
      layout: {
        type: "field",
        fieldview: "as_text",
        textStyle: "h3",
        field_name: "author",
      },
      columns: [{ type: "Field", fieldview: "as_text", field_name: "author" }],
      response: `<h3>Herman Melville</h3>`,
    });
    await test_show({
      layout: {
        widths: [6, 6],
        besides: [
          {
            stat: "Count",
            type: "aggregation",
            agg_field: "name",
            agg_relation: "patients.favbook",
          },
          {
            type: "action",
            rndid: "1a8ac3",
            minRole: 10,
            isFormula: {},
            action_name: "run_js_code",
            action_size: "btn-sm",
            action_label: "you're my number",
            action_style: "btn-success",
            configuration: { code: 'console.log("1")' },
          },
        ],
      },
      columns: [
        {
          stat: "Count",
          type: "Aggregation",
          agg_field: "name",
          agg_relation: "patients.favbook",
        },
        {
          type: "Action",
          rndid: "1a8ac3",
          minRole: 10,
          isFormula: {},
          action_name: "run_js_code",
          action_size: "btn-sm",
          action_label: "you're my number",
          action_style: "btn-success",
          configuration: { code: 'console.log("1")' },
        },
      ],
      response: `<div class="row w-100"><div class="col-6">1</div><div class="col-6"><a href="javascript:view_post('testshow', 'run_action', {rndid:'1a8ac3', id:1});" class="btn btn-success btn-sm">you're my number</a></div></div>`,
    });
    await test_show({
      layout: {
        widths: [6, 6],
        besides: [
          {
            above: [
              null,
              {
                type: "card",
                contents: {
                  type: "view_link",
                  view: "Own:authorshow",
                  minRole: 10,
                  in_modal: true,
                  view_label: "foo it",
                },
                isFormula: {},
              },
            ],
          },
          {
            type: "container",
            bgType: "Color",
            hAlign: "left",
            vAlign: "top",
            bgColor: "#a9a7a7",
            bgFileId: 1,
            contents: {
              url: "'https://countto.com/'+pages",
              text: "author",
              type: "link",
              isFormula: { url: true, text: true },
            },
            imageSize: "contain",
            minHeight: "100",
            textColor: "#ffffff",
            borderStyle: "solid",
            borderWidth: "1",
          },
        ],
      },
      columns: [
        {
          type: "ViewLink",
          view: "Own:authorshow",
          minRole: 10,
          in_modal: true,
        },
      ],
      response: !remoteQueries
        ? `<div class="row w-100"><div class="col-6"><div class="card mt-4 shadow"><div class="card-body"><a href="javascript:ajax_modal('/view/authorshow?id=1')">foo it</a></div></div></div><div class="col-6"><div class="text-start" style="min-height: 100px;border: 1px solid black;  background-color: #a9a7a7;  "><a href="https://countto.com/967">Herman Melville</a></div></div></div>`
        : `<div class="row w-100"><div class="col-6"><div class="card mt-4 shadow"><div class="card-body"><a href="javascript:mobile_modal('/view/authorshow?id=1')">foo it</a></div></div></div><div class="col-6"><div class="text-start" style="min-height: 100px;border: 1px solid black;  background-color: #a9a7a7;  "><a href="https://countto.com/967">Herman Melville</a></div></div></div>`,
    });
    await test_show({
      layout: {
        type: "card",
        contents: {
          above: [
            { type: "blank", contents: "author", isFormula: { text: true } },
            { type: "line_break" },
            {
              name: "5da0c7",
              type: "view",
              view: "authorshow",
              state: "shared",
              contents: "Herman Melville",
            },
          ],
        },
        isFormula: {},
      },
      columns: [],
      response: `<div class="card mt-4 shadow"><div class="card-body">Herman Melville<br />Herman Melville</div></div>`,
    });
    const showbooks1 = {
      layout: {
        above: [
          {
            widths: [2, 10],
            besides: [
              {
                above: [
                  null,
                  {
                    font: "",
                    type: "blank",
                    block: false,
                    contents: "Author",
                    labelFor: "",
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
                    fieldview: "as_text",
                    textStyle: "",
                    field_name: "author",
                    configuration: {},
                  },
                ],
              },
            ],
            breakpoints: ["", ""],
          },
          { type: "line_break" },
          {
            widths: [2, 10],
            besides: [
              {
                above: [
                  null,
                  {
                    font: "",
                    type: "blank",
                    block: false,
                    contents: "Pages",
                    labelFor: "",
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
                    fieldview: "show",
                    textStyle: "",
                    field_name: "pages",
                    configuration: {},
                  },
                ],
              },
            ],
            breakpoints: ["", ""],
          },
          { type: "line_break" },
          {
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
              type: "action",
              block: false,
              rndid: "746098",
              confirm: false,
              minRole: 10,
              isFormula: {},
              action_icon: "",
              action_name: "Delete",
              action_label: "",
              configuration: {},
            },
            imageSize: "contain",
            isFormula: {},
            minHeight: 0,
            textColor: "#ffffff",
            widthUnit: "px",
            heightUnit: "px",
            htmlElement: "div",
            showForRole: [
              null,
              true,
              null,
              null,
              true,
              null,
              null,
              null,
              false,
              null,
              false,
            ],
            gradEndColor: "#88ff88",
            setTextColor: false,
            fullPageWidth: false,
            gradDirection: "0",
            minHeightUnit: "px",
            showIfFormula: "",
            gradStartColor: "#ff8888",
            maxScreenWidth: "",
            minScreenWidth: "",
            show_for_owner: false,
          },
          {
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
              contents: "VERY LONG",
              labelFor: "",
              isFormula: {},
              textStyle: "",
            },
            imageSize: "contain",
            isFormula: {},
            minHeight: 0,
            textColor: "#ffffff",
            widthUnit: "px",
            heightUnit: "px",
            htmlElement: "div",
            showForRole: [],
            gradEndColor: "#88ff88",
            setTextColor: false,
            fullPageWidth: false,
            gradDirection: "0",
            minHeightUnit: "px",
            showIfFormula: "pages>800",
            gradStartColor: "#ff8888",
            maxScreenWidth: "",
            minScreenWidth: "",
            show_for_owner: false,
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
        {
          type: "Field",
          block: false,
          fieldview: "show",
          textStyle: "",
          field_name: "pages",
          configuration: {},
        },
        {
          type: "Action",
          rndid: "746098",
          confirm: false,
          minRole: 10,
          isFormula: {},
          action_icon: "",
          action_name: "Delete",
          action_label: "",
          configuration: {},
        },
      ],
    };
    await test_show({
      ...showbooks1,
      response: `<div class="row w-100"><div class="col-2">Author</div><div class="col-10">Herman Melville</div></div><br /><div class="row w-100"><div class="col-2">Pages</div><div class="col-10">967</div></div><br /><div class="text-start" style="min-height: 0px;border: 0px none black;    "><form action="/delete/books/1?redirect=/view/testshow" method="post" class="d-inline">
  <input type="hidden" name="_csrf" value="">
<button type="submit"  class=" btn  btn-primary ">Delete</button></form></div><div class="text-start" style="min-height: 0px;border: 0px none black;    ">VERY LONG</div>`,
    });
    await test_show({
      ...showbooks1,
      id: 2,
      response: `<div class="row w-100"><div class="col-2">Author</div><div class="col-10">Leo Tolstoy</div></div><br /><div class="row w-100"><div class="col-2">Pages</div><div class="col-10">728</div></div><br /><div class="text-start" style="min-height: 0px;border: 0px none black;    "><form action="/delete/books/2?redirect=/view/testshow" method="post" class="d-inline">
  <input type="hidden" name="_csrf" value="">
<button type="submit"  class=" btn  btn-primary ">Delete</button></form></div>`,
    });
  });
  it("should render double join embedded exactly", async () => {
    await test_list({
      name: "ListReadings",
      noDelete: true,
      table: "readings",
      columns: [
        {
          type: "Field",
          fieldview: "showDay",
          field_name: "date",
          state_field: "on",
        },
        {
          type: "Field",
          fieldview: "show",
          field_name: "normalised",
          state_field: "on",
        },
        {
          type: "JoinField",
          join_field: "patient_id.name",
        },
        {
          type: "Field",
          fieldview: "show",
          field_name: "temperature",
          state_field: "on",
        },
      ],
      response: !remoteQueries
        ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('date', false)">Date</a></th><th><a href="javascript:sortby('normalised', false)">Normalised</a></th><th>name</th><th style="text-align: right"><a href="javascript:sortby('temperature', false)">Temperature</a></th></tr></thead><tbody><tr><td><time datetime="2019-11-11T10:34:00.000Z" locale-date-options="%7B%7D">11/11/2019</time></td><td><i class="fas fa-lg fa-check-circle text-success"></i></td><td>Kirk Douglas</td><td style="text-align:right">37</td></tr><tr><td></td><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Kirk Douglas</td><td style="text-align:right">39</td></tr><tr><td></td><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Michael Douglas</td><td style="text-align:right">37</td></tr></tbody></table></div>`
        : `<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('date', false, 'ListReadings')">Date</a></th><th><a href="javascript:sortby('normalised', false, 'ListReadings')">Normalised</a></th><th>name</th><th style="text-align: right"><a href="javascript:sortby('temperature', false, 'ListReadings')">Temperature</a></th></tr></thead><tbody><tr><td><time datetime="2019-11-11T10:34:00.000Z" locale-date-options="%7B%7D">11/11/2019</time></td><td><i class="fas fa-lg fa-check-circle text-success"></i></td><td>Kirk Douglas</td><td style="text-align:right">37</td></tr><tr><td></td><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Kirk Douglas</td><td style="text-align:right">39</td></tr><tr><td></td><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Michael Douglas</td><td style="text-align:right">37</td></tr></tbody></table></div>`,
    });
    await test_show({
      id: 1,
      layout: {
        above: [
          {
            style: {},
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
                    contents: "Author",
                    labelFor: "",
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
                    fieldview: "as_text",
                    textStyle: "",
                    field_name: "author",
                    configuration: {},
                  },
                ],
              },
            ],
            breakpoints: ["", ""],
          },
          {
            type: "line_break",
          },
          {
            style: {},
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
                    contents: "Pages",
                    labelFor: "",
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
                    fieldview: "show",
                    textStyle: "",
                    field_name: "pages",
                    configuration: {},
                  },
                ],
              },
            ],
            breakpoints: ["", ""],
          },
          {
            type: "line_break",
          },
          {
            style: {},
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
                    contents: "Publisher",
                    labelFor: "",
                    isFormula: {},
                    textStyle: "",
                  },
                ],
              },
              {
                above: [
                  null,
                  {
                    type: "join_field",
                    block: false,
                    textStyle: "",
                    join_field: "publisher.name",
                    fieldview: "as_header",
                    configuration: {},
                  },
                ],
              },
            ],
            breakpoints: ["", ""],
          },
          {
            type: "line_break",
          },
          {
            name: "46d4bc",
            type: "view",
            view: "ChildList:ListReadings.patients.favbook.readings.patient_id",
            state: "shared",
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
        {
          type: "Field",
          block: false,
          fieldview: "show",
          textStyle: "",
          field_name: "pages",
          configuration: {},
        },
        {
          type: "JoinField",
          block: false,
          textStyle: "",
          fieldview: "as_header",
          join_field: "publisher.name",
          configuration: {},
        },
      ],
      response: !remoteQueries
        ? `<div class="row w-100"><div class="col-2">Author</div><div class="col-10">Herman Melville</div></div><br /><div class="row w-100"><div class="col-2">Pages</div><div class="col-10">967</div></div><br /><div class="row w-100"><div class="col-2">Publisher</div><div class="col-10"><h3></h3></div></div><br /><div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('date', false)">Date</a></th><th><a href="javascript:sortby('normalised', false)">Normalised</a></th><th>name</th><th style="text-align: right"><a href="javascript:sortby('temperature', false)">Temperature</a></th></tr></thead><tbody><tr><td><time datetime="2019-11-11T10:34:00.000Z" locale-date-options="%7B%7D">11/11/2019</time></td><td><i class="fas fa-lg fa-check-circle text-success"></i></td><td>Kirk Douglas</td><td style="text-align:right">37</td></tr><tr><td></td><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Kirk Douglas</td><td style="text-align:right">39</td></tr></tbody></table></div>`
        : `<div class="row w-100"><div class="col-2">Author</div><div class="col-10">Herman Melville</div></div><br /><div class="row w-100"><div class="col-2">Pages</div><div class="col-10">967</div></div><br /><div class="row w-100"><div class="col-2">Publisher</div><div class="col-10"><h3></h3></div></div><br /><div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('date', false, 'ListReadings')">Date</a></th><th><a href="javascript:sortby('normalised', false, 'ListReadings')">Normalised</a></th><th>name</th><th style="text-align: right"><a href="javascript:sortby('temperature', false, 'ListReadings')">Temperature</a></th></tr></thead><tbody><tr><td><time datetime="2019-11-11T10:34:00.000Z" locale-date-options="%7B%7D">11/11/2019</time></td><td><i class="fas fa-lg fa-check-circle text-success"></i></td><td>Kirk Douglas</td><td style="text-align:right">37</td></tr><tr><td></td><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Kirk Douglas</td><td style="text-align:right">39</td></tr></tbody></table></div>`,
    });
  });
});
describe("Edit view", () => {
  it("should render exactly", async () => {
    const layout = {
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
                { type: "field", fieldview: "edit", field_name: "name" },
              ],
            },
          ],
        },
        { type: "line_break" },
        {
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                { type: "blank", contents: "Favourite book", isFormula: {} },
              ],
            },
            {
              above: [
                null,
                { type: "field", fieldview: "select", field_name: "favbook" },
              ],
            },
          ],
        },
        { type: "line_break" },
        {
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                { type: "blank", contents: "Parent", isFormula: {} },
              ],
            },
            {
              above: [
                null,
                { type: "field", fieldview: "select", field_name: "parent" },
              ],
            },
          ],
        },
        { type: "line_break" },
        {
          type: "action",
          rndid: "74310f",
          minRole: 10,
          isFormula: {},
          action_name: "Save",
          action_style: "btn-primary",
          configuration: {},
        },
      ],
    };
    const columns = [
      { type: "Field", fieldview: "edit", field_name: "name" },
      { type: "Field", fieldview: "select", field_name: "favbook" },
      { type: "Field", fieldview: "select", field_name: "parent" },
      {
        type: "Action",
        rndid: "74310f",
        minRole: 10,
        isFormula: {},
        action_name: "Save",
        action_style: "btn-primary",
        configuration: {},
      },
    ];
    await test_edit({
      layout,
      columns,
      response: !remoteQueries
        ? `<form action="/view/testedit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><div class="row w-100"><div class="col-2">Name</div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname"></div></div><br /><div class="row w-100"><div class="col-2">Favourite book</div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1">Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><div class="row w-100"><div class="col-2">Parent</div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><button type="submit" class="btn btn-primary ">Save</button></form>`
        : `<form action="javascript:void(0)" onsubmit="javascript:formSubmit(this, '/view/', 'testedit')"  class="form-namespace " method="post"><input type="hidden" name="_csrf" value="false"><div class="row w-100"><div class="col-2">Name</div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname"></div></div><br /><div class="row w-100"><div class="col-2">Favourite book</div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1">Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><div class="row w-100"><div class="col-2">Parent</div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><button type="submit" class="btn btn-primary ">Save</button></form>`,
    });
    await test_edit({
      id: 1,
      layout,
      columns,
      response: !remoteQueries
        ? `<form action="/view/testedit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><div class="row w-100"><div class="col-2">Name</div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname" value="Kirk Douglas"></div></div><br /><div class="row w-100"><div class="col-2">Favourite book</div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1" selected>Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><div class="row w-100"><div class="col-2">Parent</div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><button type="submit" class="btn btn-primary ">Save</button></form>`
        : `<form action="javascript:void(0)" onsubmit="javascript:formSubmit(this, '/view/', 'testedit')"  class="form-namespace " method="post"><input type="hidden" name="_csrf" value="false"><input type="hidden" class="form-control  " name="id" value="1"><div class="row w-100"><div class="col-2">Name</div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname" value="Kirk Douglas"></div></div><br /><div class="row w-100"><div class="col-2">Favourite book</div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1" selected>Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><div class="row w-100"><div class="col-2">Parent</div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><button type="submit" class="btn btn-primary ">Save</button></form>`,
    });
  });
  it("should render edit-in-edit", async () => {
    await test_edit({
      name: "innerReads",
      ...renderEditInEditConfig.innerEdit,
      noDelete: true,
      table: "readings",
      response: !remoteQueries
        ? `<form action="/view/innerReads" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date" id="inputdate"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised" id="inputnormalised"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature" id="inputtemperature" step="1"></div></div></form>`
        : `<form action="javascript:void(0)" onsubmit="javascript:formSubmit(this, '/view/', 'innerReads')"  class="form-namespace " method="post"><input type="hidden" name="_csrf" value="false"><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date" id="inputdate"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised" id="inputnormalised"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature" id="inputtemperature" step="1"></div></div></form>`,
    });
    await test_edit({
      name: "PatientEditWithReads",
      ...renderEditInEditConfig.outerEdit,
      table: "patients",
      response: !remoteQueries
        ? `<form action="/view/PatientEditWithReads" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><div class="row w-100"><div class="col-2"><label for="inputfavbook">Favourite book</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1">Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><span style="margin-bottom:1.5rem"><div class="row w-100" style="margin-bottom:1.5rem"><div class="col-2"><label for="inputname">Name</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname"></div></div></span><div class="row w-100"><div class="col-2"><label for="inputparent">Parent</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><div><div class="repeats-patient_id"><div class="form-repeat form-namespace repeat-patient_id"><div class="float-end"><span onclick="rep_up(this)"><i class="fa fa-arrow-up pull-right"></i></span>&nbsp;<span onclick="rep_del(this)"><i class="fa fa-times pull-right"></i></span>&nbsp;<span onclick="rep_down(this)"><i class="fa fa-arrow-down pull-right"></i></span></div><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date_0" id="inputdate_0"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised_0" id="inputnormalised_0"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature_0" id="inputtemperature_0" step="1"></div></div></div></div><a class="btn btn-sm btn-outline-primary mb-3" href="javascript:add_repeater('patient_id')" title="Add"><i class="fas fa-plus"></i></a></div><button type="submit" class="btn btn-primary ">Save</button><button onClick="$(this).closest('form').trigger('reset')" type="button" class="btn btn-primary ">Reset</button></form>`
        : `<form action="javascript:void(0)" onsubmit="javascript:formSubmit(this, '/view/', 'PatientEditWithReads')"  class="form-namespace " method="post"><input type="hidden" name="_csrf" value="false"><div class="row w-100"><div class="col-2"><label for="inputfavbook">Favourite book</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1">Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><span style="margin-bottom:1.5rem"><div class="row w-100" style="margin-bottom:1.5rem"><div class="col-2"><label for="inputname">Name</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname"></div></div></span><div class="row w-100"><div class="col-2"><label for="inputparent">Parent</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><div><div class="repeats-patient_id"><div class="form-repeat form-namespace repeat-patient_id"><div class="float-end"><span onclick="rep_up(this)"><i class="fa fa-arrow-up pull-right"></i></span>&nbsp;<span onclick="rep_del(this)"><i class="fa fa-times pull-right"></i></span>&nbsp;<span onclick="rep_down(this)"><i class="fa fa-arrow-down pull-right"></i></span></div><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date_0" id="inputdate_0"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised_0" id="inputnormalised_0"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature_0" id="inputtemperature_0" step="1"></div></div></div></div><a class="btn btn-sm btn-outline-primary mb-3" href="javascript:add_repeater('patient_id')" title="Add"><i class="fas fa-plus"></i></a></div><button type="submit" class="btn btn-primary ">Save</button><button onClick="$(this).closest('form').trigger('reset')" type="button" class="btn btn-primary ">Reset</button></form>`,
    });
    await test_edit({
      name: "PatientEditWithReads",
      id: 1,
      ...renderEditInEditConfig.outerEdit,
      table: "patients",
      response: !remoteQueries
        ? `<form action="/view/PatientEditWithReads" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><div class="row w-100"><div class="col-2"><label for="inputfavbook">Favourite book</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1" selected>Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><span style="margin-bottom:1.5rem"><div class="row w-100" style="margin-bottom:1.5rem"><div class="col-2"><label for="inputname">Name</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname" value="Kirk Douglas"></div></div></span><div class="row w-100"><div class="col-2"><label for="inputparent">Parent</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><div><div class="repeats-patient_id"><div class="form-repeat form-namespace repeat-patient_id"><div class="float-end"><span onclick="rep_up(this)"><i class="fa fa-arrow-up pull-right"></i></span>&nbsp;<span onclick="rep_del(this)"><i class="fa fa-times pull-right"></i></span>&nbsp;<span onclick="rep_down(this)"><i class="fa fa-arrow-down pull-right"></i></span></div><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date_0" id="inputdate_0" value="11/11/2019"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised_0" id="inputnormalised_0" checked></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature_0" id="inputtemperature_0" step="1" value="37"></div></div><input type="hidden" class="form-control  " name="id_0" value="1"></div><div class="form-repeat form-namespace repeat-patient_id"><div class="float-end"><span onclick="rep_up(this)"><i class="fa fa-arrow-up pull-right"></i></span>&nbsp;<span onclick="rep_del(this)"><i class="fa fa-times pull-right"></i></span>&nbsp;<span onclick="rep_down(this)"><i class="fa fa-arrow-down pull-right"></i></span></div><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date_1" id="inputdate_1"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised_1" id="inputnormalised_1"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature_1" id="inputtemperature_1" step="1" value="39"></div></div><input type="hidden" class="form-control  " name="id_1" value="2"></div></div><a class="btn btn-sm btn-outline-primary mb-3" href="javascript:add_repeater('patient_id')" title="Add"><i class="fas fa-plus"></i></a></div><button type="submit" class="btn btn-primary ">Save</button><button onClick="$(this).closest('form').trigger('reset')" type="button" class="btn btn-primary ">Reset</button><button onClick="if(confirm('Are you sure?'))ajax_post('/delete/patients/1', {success:()=>{history.back();}})" type="button" class="btn btn-primary ">Delete</button></form>`
        : `<form action="javascript:void(0)" onsubmit="javascript:formSubmit(this, '/view/', 'PatientEditWithReads')"  class="form-namespace " method="post"><input type="hidden" name="_csrf" value="false"><input type="hidden" class="form-control  " name="id" value="1"><div class="row w-100"><div class="col-2"><label for="inputfavbook">Favourite book</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1" selected>Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><span style="margin-bottom:1.5rem"><div class="row w-100" style="margin-bottom:1.5rem"><div class="col-2"><label for="inputname">Name</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname" value="Kirk Douglas"></div></div></span><div class="row w-100"><div class="col-2"><label for="inputparent">Parent</label></div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">Kirk Douglas</option><option value="2">Michael Douglas</option></select></div></div><br /><div><div class="repeats-patient_id"><div class="form-repeat form-namespace repeat-patient_id"><div class="float-end"><span onclick="rep_up(this)"><i class="fa fa-arrow-up pull-right"></i></span>&nbsp;<span onclick="rep_del(this)"><i class="fa fa-times pull-right"></i></span>&nbsp;<span onclick="rep_down(this)"><i class="fa fa-arrow-down pull-right"></i></span></div><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date_0" id="inputdate_0" value="11/11/2019"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised_0" id="inputnormalised_0" checked></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature_0" id="inputtemperature_0" step="1" value="37"></div></div><input type="hidden" class="form-control  " name="id_0" value="1"></div><div class="form-repeat form-namespace repeat-patient_id"><div class="float-end"><span onclick="rep_up(this)"><i class="fa fa-arrow-up pull-right"></i></span>&nbsp;<span onclick="rep_del(this)"><i class="fa fa-times pull-right"></i></span>&nbsp;<span onclick="rep_down(this)"><i class="fa fa-arrow-down pull-right"></i></span></div><div class="row w-100"><div class="col-2"><label for="inputdate">Date</label></div><div class="col-10"><input type="text" class="form-control  " data-fieldname="date" name="date_1" id="inputdate_1"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputnormalised">Normalised</label></div><div class="col-10"><input class="me-2 mt-1  " data-fieldname="normalised" type="checkbox" name="normalised_1" id="inputnormalised_1"></div></div><br /><div class="row w-100"><div class="col-2"><label for="inputtemperature">Temperature</label></div><div class="col-10"><input type="number" class="form-control  " data-fieldname="temperature" name="temperature_1" id="inputtemperature_1" step="1" value="39"></div></div><input type="hidden" class="form-control  " name="id_1" value="2"></div></div><a class="btn btn-sm btn-outline-primary mb-3" href="javascript:add_repeater('patient_id')" title="Add"><i class="fas fa-plus"></i></a></div><button type="submit" class="btn btn-primary ">Save</button><button onClick="$(this).closest('form').trigger('reset')" type="button" class="btn btn-primary ">Reset</button><button onClick="if(confirm('Are you sure?'))local_post('/delete/patients/1', {after_delete_url:'/'})" type="button" class="btn btn-primary ">Delete</button></form>`,
    });
  });
});
describe("List view", () => {
  it("should render exactly", async () => {
    await test_list({
      columns: [
        {
          type: "Field",
          fieldview: "as_text",
          field_name: "name",
          state_field: "on",
          header_label: "",
        },
        { type: "JoinField", join_field: "parent.name", header_label: "" },
        { type: "JoinField", join_field: "favbook.author", header_label: "" },
        {
          code: 'console.log("hi")',
          type: "Action",
          action_name: "run_js_code",
          action_size: "",
          action_label: "say hi",
          action_style: "btn-primary",
          header_label: "Helloer",
        },
        {
          type: "ViewLink",
          view: "ParentShow:authorshow.books.favbook",
          view_label: "id+5",
          header_label: "",
          view_label_formula: "on",
        },
        {
          stat: "Count",
          type: "Aggregation",
          agg_field: "temperature",
          agg_relation: "readings.patient_id",
          header_label: "readings",
        },
        {
          type: "Link",
          link_url: "'https://lmgtfy.app/?q='+name",
          link_text: "name.toUpperCase()",
          header_label: "",
          link_url_formula: "on",
          link_text_formula: "on",
        },
        {
          type: "Action",
          confirm: "on",
          action_name: "Delete",
          action_size: "btn-sm",
          action_label: "",
          action_style: "btn-outline-primary",
          header_label: "",
        },
      ],
      response: !remoteQueries
        ? '<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby(\'name\', false)">Name</a></th><th>name</th><th>author</th><th>Helloer</th><th>authorshow</th><th>readings</th><th></th><th></th></tr></thead><tbody><tr><td>Kirk Douglas</td><td></td><td>Herman Melville</td><td><a href="javascript:view_post(\'testlist\', \'run_action\', {action_name:\'run_js_code\', id:1, column_index: 3});" class="btn btn-primary ">say hi</a></td><td><a href="/view/authorshow?id=1">6</a></td><td>2</td><td><a href="https://lmgtfy.app/?q=Kirk Douglas">KIRK DOUGLAS</a></td><td><form action="/delete/patients/1?redirect=/view/testlist" method="post">\n  \n<button type="button" onclick="if(confirm(\'Are you sure?\')) {ajax_post_btn(this, true, undefined)}" class=" btn btn-sm btn-outline-primary">Delete</button></form></td></tr><tr><td>Michael Douglas</td><td>Kirk Douglas</td><td>Leo Tolstoy</td><td><a href="javascript:view_post(\'testlist\', \'run_action\', {action_name:\'run_js_code\', id:2, column_index: 3});" class="btn btn-primary ">say hi</a></td><td><a href="/view/authorshow?id=2">7</a></td><td>1</td><td><a href="https://lmgtfy.app/?q=Michael Douglas">MICHAEL DOUGLAS</a></td><td><form action="/delete/patients/2?redirect=/view/testlist" method="post">\n  \n<button type="button" onclick="if(confirm(\'Are you sure?\')) {ajax_post_btn(this, true, undefined)}" class=" btn btn-sm btn-outline-primary">Delete</button></form></td></tr></tbody></table></div>'
        : '<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby(\'name\', false, \'testlist\')">Name</a></th><th>name</th><th>author</th><th>Helloer</th><th>authorshow</th><th>readings</th><th></th><th></th></tr></thead><tbody><tr><td>Kirk Douglas</td><td></td><td>Herman Melville</td><td><a href="javascript:view_post(\'testlist\', \'run_action\', {action_name:\'run_js_code\', id:1, column_index: 3});" class="btn btn-primary ">say hi</a></td><td><a href="javascript:execLink(\'/view/authorshow?id=1\')">6</a></td><td>2</td><td><a href="https://lmgtfy.app/?q=Kirk Douglas">KIRK DOUGLAS</a></td><td><form action="/delete/patients/1?redirect=/view/testlist" method="post">\n  \n<button type="button" onclick="if(confirm(\'Are you sure?\')) {local_post_btn(this)}" class=" btn btn-sm btn-outline-primary">Delete</button></form></td></tr><tr><td>Michael Douglas</td><td>Kirk Douglas</td><td>Leo Tolstoy</td><td><a href="javascript:view_post(\'testlist\', \'run_action\', {action_name:\'run_js_code\', id:2, column_index: 3});" class="btn btn-primary ">say hi</a></td><td><a href="javascript:execLink(\'/view/authorshow?id=2\')">7</a></td><td>1</td><td><a href="https://lmgtfy.app/?q=Michael Douglas">MICHAEL DOUGLAS</a></td><td><form action="/delete/patients/2?redirect=/view/testlist" method="post">\n  \n<button type="button" onclick="if(confirm(\'Are you sure?\')) {local_post_btn(this)}" class=" btn btn-sm btn-outline-primary">Delete</button></form></td></tr></tbody></table></div>',
    });
  });
  it("should render list view with where aggregations exactly", async () => {
    await test_list({
      table: "books",
      columns: [
        {
          type: "Field",
          col_width: "",
          fieldview: "as_text",
          field_name: "author",
          state_field: "on",
          header_label: "",
        },
        {
          stat: "Count",
          type: "Aggregation",
          aggwhere: "",
          agg_field: "name",
          col_width: "",
          agg_relation: "patients.favbook",
          header_label: "",
        },
        {
          stat: "Count",
          type: "Aggregation",
          aggwhere: "id==1",
          agg_field: "id",
          col_width: "",
          agg_relation: "patients.favbook",
          header_label: "count 1",
        },
      ],
      response: !remoteQueries
        ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('author', false)">Author</a></th><th>Count patients</th><th>count 1</th></tr></thead><tbody><tr><td>Herman Melville</td><td>1</td><td>1</td></tr><tr><td>Leo Tolstoy</td><td>1</td><td>0</td></tr></tbody></table></div>`
        : `<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('author', false, 'testlist')">Author</a></th><th>Count patients</th><th>count 1</th></tr></thead><tbody><tr><td>Herman Melville</td><td>1</td><td>1</td></tr><tr><td>Leo Tolstoy</td><td>1</td><td>0</td></tr></tbody></table></div>`,
    });
  });
  it("should render triply joined formulae list view exactly", async () => {
    await test_list({
      table: "readings",
      columns: [
        {
          type: "Field",
          col_width: "",
          fieldview: "show",
          field_name: "temperature",
          state_field: "on",
          header_label: "",
        },
        {
          type: "Link",
          link_url: "http://bbc.co.uk",
          col_width: "",
          link_text: "patient_id.name",
          header_label: "name",
          link_text_formula: "on",
        },
        {
          type: "Link",
          link_url: "http://bbc.co.uk",
          col_width: "",
          link_text: "patient_id.favbook.author",
          header_label: "author",
          link_text_formula: "on",
        },
        {
          type: "Link",
          link_url: "http://bbc.co.uk",
          col_width: "",
          link_text: "patient_id.favbook.publisher?.name",
          header_label: "publisher",
          link_text_formula: "on",
        },
      ],
      response: !remoteQueries
        ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th style="text-align: right"><a href="javascript:sortby('temperature', false)">Temperature</a></th><th>name</th><th>author</th><th>publisher</th></tr></thead><tbody><tr><td style="text-align:right">37</td><td><a href="http://bbc.co.uk">Kirk Douglas</a></td><td><a href="http://bbc.co.uk">Herman Melville</a></td><td><a href="http://bbc.co.uk"></a></td></tr><tr><td style="text-align:right">39</td><td><a href="http://bbc.co.uk">Kirk Douglas</a></td><td><a href="http://bbc.co.uk">Herman Melville</a></td><td><a href="http://bbc.co.uk"></a></td></tr><tr><td style="text-align:right">37</td><td><a href="http://bbc.co.uk">Michael Douglas</a></td><td><a href="http://bbc.co.uk">Leo Tolstoy</a></td><td><a href="http://bbc.co.uk">AK Press</a></td></tr></tbody></table></div>`
        : `<div class="table-responsive"><table class="table table-sm"><thead><tr><th style="text-align: right"><a href="javascript:sortby('temperature', false, 'testlist')">Temperature</a></th><th>name</th><th>author</th><th>publisher</th></tr></thead><tbody><tr><td style="text-align:right">37</td><td><a href="http://bbc.co.uk">Kirk Douglas</a></td><td><a href="http://bbc.co.uk">Herman Melville</a></td><td><a href="http://bbc.co.uk"></a></td></tr><tr><td style="text-align:right">39</td><td><a href="http://bbc.co.uk">Kirk Douglas</a></td><td><a href="http://bbc.co.uk">Herman Melville</a></td><td><a href="http://bbc.co.uk"></a></td></tr><tr><td style="text-align:right">37</td><td><a href="http://bbc.co.uk">Michael Douglas</a></td><td><a href="http://bbc.co.uk">Leo Tolstoy</a></td><td><a href="http://bbc.co.uk">AK Press</a></td></tr></tbody></table></div>`,
    });
  });
  it("should render triply joined with dropdown list view", async () => {
    await test_list({
      table: "readings",
      columns: [
        {
          type: "Field",
          col_width: "",
          fieldview: "show",
          field_name: "normalised",
          state_field: "on",
          header_label: "",
        },
        {
          type: "JoinField",
          col_width: "",
          join_field: "patient_id.favbook.author",
          header_label: "",
        },
        {
          type: "Field",
          col_width: "",
          fieldview: "show",
          field_name: "temperature",
          state_field: "on",
          header_label: "",
        },
        {
          type: "JoinField",
          col_width: "",
          join_field: "patient_id.favbook.publisher.name",
          header_label: "",
        },
        {
          type: "ViewLink",
          view: "Own:showreads",
          col_width: "",
          link_size: "",
          link_style: "",
          view_label: "",
          header_label: "",
        },
        {
          type: "Link",
          link_url: "http://bbc.co.uk",
          col_width: "",
          link_text: '"Foo "+temperature.toString().substring(1,3)',
          header_label: "",
          link_text_formula: "on",
        },
        {
          type: "Action",
          col_width: "",
          action_name: "Delete",
          action_size: "",
          in_dropdown: "on",
          action_label: "",
          action_style: "btn-primary",
          header_label: "",
        },
        {
          type: "ViewLink",
          view: "Own:showreads",
          in_modal: "on",
          col_width: "",
          link_size: "",
          link_style: "",
          view_label: "",
          in_dropdown: "on",
          header_label: "",
        },
      ],
      response: !remoteQueries
        ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('normalised', false)">Normalised</a></th><th>author</th><th style="text-align: right"><a href="javascript:sortby('temperature', false)">Temperature</a></th><th>name</th><th>showreads</th><th></th><th>Action</th></tr></thead><tbody><tr><td><i class="fas fa-lg fa-check-circle text-success"></i></td><td>Herman Melville</td><td style="text-align:right">37</td><td></td><td><a href="/view/showreads?id=1">showreads</a></td><td><a href="http://bbc.co.uk">Foo 7</a></td><td><div class="dropdown"><button class="btn btn-sm btn-xs btn-outline-secondary dropdown-toggle" data-boundary="viewport" type="button" id="actiondd1" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Action</button><div class="dropdown-menu dropdown-menu-end" aria-labelledby="actiondd1"><form action="/delete/readings/1?redirect=/view/testlist" method="post">
  
<button type="button" onclick="ajax_post_btn(this, true, undefined)" class=" btn btn-sm dropdown-item">Delete</button></form><a href="javascript:ajax_modal('/view/showreads?id=1')" class="dropdown-item">showreads</a></div></div></td></tr><tr><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Herman Melville</td><td style="text-align:right">39</td><td></td><td><a href="/view/showreads?id=2">showreads</a></td><td><a href="http://bbc.co.uk">Foo 9</a></td><td><div class="dropdown"><button class="btn btn-sm btn-xs btn-outline-secondary dropdown-toggle" data-boundary="viewport" type="button" id="actiondd2" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Action</button><div class="dropdown-menu dropdown-menu-end" aria-labelledby="actiondd2"><form action="/delete/readings/2?redirect=/view/testlist" method="post">
  
<button type="button" onclick="ajax_post_btn(this, true, undefined)" class=" btn btn-sm dropdown-item">Delete</button></form><a href="javascript:ajax_modal('/view/showreads?id=2')" class="dropdown-item">showreads</a></div></div></td></tr><tr><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Leo Tolstoy</td><td style="text-align:right">37</td><td>AK Press</td><td><a href="/view/showreads?id=3">showreads</a></td><td><a href="http://bbc.co.uk">Foo 7</a></td><td><div class="dropdown"><button class="btn btn-sm btn-xs btn-outline-secondary dropdown-toggle" data-boundary="viewport" type="button" id="actiondd3" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Action</button><div class="dropdown-menu dropdown-menu-end" aria-labelledby="actiondd3"><form action="/delete/readings/3?redirect=/view/testlist" method="post">
  
<button type="button" onclick="ajax_post_btn(this, true, undefined)" class=" btn btn-sm dropdown-item">Delete</button></form><a href="javascript:ajax_modal('/view/showreads?id=3')" class="dropdown-item">showreads</a></div></div></td></tr></tbody></table></div>`
        : `<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('normalised', false, 'testlist')">Normalised</a></th><th>author</th><th style="text-align: right"><a href="javascript:sortby('temperature', false, 'testlist')">Temperature</a></th><th>name</th><th>showreads</th><th></th><th>Action</th></tr></thead><tbody><tr><td><i class="fas fa-lg fa-check-circle text-success"></i></td><td>Herman Melville</td><td style="text-align:right">37</td><td></td><td><a href="javascript:execLink('/view/showreads?id=1')">showreads</a></td><td><a href="http://bbc.co.uk">Foo 7</a></td><td><div class="dropdown"><button class="btn btn-sm btn-xs btn-outline-secondary dropdown-toggle" data-boundary="viewport" type="button" id="actiondd1" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Action</button><div class="dropdown-menu dropdown-menu-end" aria-labelledby="actiondd1"><form action="/delete/readings/1?redirect=/view/testlist" method="post">
  
<button type="button" onclick="local_post_btn(this)" class=" btn btn-sm dropdown-item">Delete</button></form><a href="javascript:mobile_modal('/view/showreads?id=1')" class="dropdown-item">showreads</a></div></div></td></tr><tr><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Herman Melville</td><td style="text-align:right">39</td><td></td><td><a href="javascript:execLink('/view/showreads?id=2')">showreads</a></td><td><a href="http://bbc.co.uk">Foo 9</a></td><td><div class="dropdown"><button class="btn btn-sm btn-xs btn-outline-secondary dropdown-toggle" data-boundary="viewport" type="button" id="actiondd2" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Action</button><div class="dropdown-menu dropdown-menu-end" aria-labelledby="actiondd2"><form action="/delete/readings/2?redirect=/view/testlist" method="post">
  
<button type="button" onclick="local_post_btn(this)" class=" btn btn-sm dropdown-item">Delete</button></form><a href="javascript:mobile_modal('/view/showreads?id=2')" class="dropdown-item">showreads</a></div></div></td></tr><tr><td><i class="fas fa-lg fa-times-circle text-danger"></i></td><td>Leo Tolstoy</td><td style="text-align:right">37</td><td>AK Press</td><td><a href="javascript:execLink('/view/showreads?id=3')">showreads</a></td><td><a href="http://bbc.co.uk">Foo 7</a></td><td><div class="dropdown"><button class="btn btn-sm btn-xs btn-outline-secondary dropdown-toggle" data-boundary="viewport" type="button" id="actiondd3" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Action</button><div class="dropdown-menu dropdown-menu-end" aria-labelledby="actiondd3"><form action="/delete/readings/3?redirect=/view/testlist" method="post">
  
<button type="button" onclick="local_post_btn(this)" class=" btn btn-sm dropdown-item">Delete</button></form><a href="javascript:mobile_modal('/view/showreads?id=3')" class="dropdown-item">showreads</a></div></div></td></tr></tbody></table></div>`,
    });
  });
});
describe("Filter view", () => {
  it("should render exactly", async () => {
    await test_filter({
      layout: {
        above: [
          {
            widths: [6, 6],
            besides: [
              { type: "dropdown_filter", field_name: "patients.favbook.name" },
              {
                type: "toggle_filter",
                label: "thirteen",
                value: "13",
                field_name: "pages",
              },
            ],
          },
          {
            type: "toggle_filter",
            label: "Jim",
            value: "Jim",
            field_name: "patients.favbook.name",
          },
          { type: "dropdown_filter", field_name: "author" },
        ],
      },
      columns: [
        { type: "DropDownFilter", field_name: "patients.favbook.name" },
        { type: "ToggleFilter", value: "13", field_name: "pages" },
        {
          type: "ToggleFilter",
          value: "Jim",
          field_name: "patients.favbook.name",
        },
        { type: "DropDownFilter", field_name: "author" },
      ],
      viewname: "testfilter",
      response:
        '<div class="form-namespace"><div class="row w-100"><div class="col-6"><select name="ddfilterpatients.favbook.name" class="form-control form-select d-inline-maybe selectizable" style="width: unset;" onchange="this.value==\'\' ? unset_state_field(\'patients.favbook.name\'): set_state_field(\'patients.favbook.name\', this.value)"><option value="" class="text-muted"></option><option value="Kirk Douglas">Kirk Douglas</option><option value="Michael Douglas">Michael Douglas</option></select></div><div class="col-6"><button class="btn btn-outline-primary" onClick="set_state_field(\'pages\', \'13\')">thirteen</button></div></div><button class="btn btn-outline-primary" onClick="set_state_field(\'patients.favbook.name\', \'Jim\')">Jim</button><select name="ddfilterauthor" class="form-control form-select d-inline-maybe selectizable" style="width: unset;" onchange="this.value==\'\' ? unset_state_field(\'author\'): set_state_field(\'author\', this.value)"><option value="" class="text-muted"></option><option value="Herman Melville">Herman Melville</option><option value="Leo Tolstoy">Leo Tolstoy</option></select></div>',
    });
  });
});
describe("Page", () => {
  it("should render exactly", async () => {
    await test_page({
      response: {
        above: [
          {
            widths: [6, 6],
            besides: [
              {
                type: "container",
                block: true,
                bgType: "None",
                hAlign: "left",
                height: "50",
                vAlign: "top",
                bgColor: "#ffffff",
                contents: {
                  type: "blank",
                  isHTML: true,
                  contents: "<h6>a h6</h6>",
                },
                imageSize: "contain",
                isFormula: {},
                textColor: "#ffffff",
                borderStyle: "solid",
                borderWidth: "1",
                showForRole: [],
              },
              {
                url: "https://abc.com",
                type: "card",
                title: "The Title goes Here",
                contents: {
                  url: "https://saltcorn.com/",
                  text: "Click here",
                  type: "link",
                  nofollow: true,
                  isFormula: {},
                },
                isFormula: {},
              },
            ],
          },
          {
            name: "806e61",
            type: "view",
            view: "authorlist",
            state: "shared",
            contents: !remoteQueries
              ? '<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby(\'author\', false)">Author</a></th><th>authorshow</th><th></th><th>Count patients</th></tr></thead><tbody><tr><td>Herman Melville</td><td><a href="/view/authorshow?id=1">authorshow</a></td><td><form action="/delete/books/1?redirect=/view/authorlist" method="post">\n  \n<button type="button" onclick="ajax_post_btn(this, true, undefined)" class=" btn btn-sm btn-primary">Delete</button></form></td><td>1</td></tr><tr><td>Leo Tolstoy</td><td><a href="/view/authorshow?id=2">authorshow</a></td><td><form action="/delete/books/2?redirect=/view/authorlist" method="post">\n  \n<button type="button" onclick="ajax_post_btn(this, true, undefined)" class=" btn btn-sm btn-primary">Delete</button></form></td><td>1</td></tr></tbody></table></div>'
              : '<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby(\'author\', false, \'authorlist\')">Author</a></th><th>authorshow</th><th></th><th>Count patients</th></tr></thead><tbody><tr><td>Herman Melville</td><td><a href="javascript:execLink(\'/view/authorshow?id=1\')">authorshow</a></td><td><form action="/delete/books/1?redirect=/view/authorlist" method="post">\n  \n<button type="button" onclick="local_post_btn(this)" class=" btn btn-sm btn-primary">Delete</button></form></td><td>1</td></tr><tr><td>Leo Tolstoy</td><td><a href="javascript:execLink(\'/view/authorshow?id=2\')">authorshow</a></td><td><form action="/delete/books/2?redirect=/view/authorlist" method="post">\n  \n<button type="button" onclick="local_post_btn(this)" class=" btn btn-sm btn-primary">Delete</button></form></td><td>1</td></tr></tbody></table></div>',
          },
          {
            name: "18a8cc",
            type: "view",
            view: "authorshow",
            state: "fixed",
            contents: "Herman Melville",
          },
        ],
      },
      name: "testpage",
      title: "gergerger",
      description: "greger",
      min_role: 10,
      id: 2,
      layout: {
        above: [
          {
            widths: [6, 6],
            besides: [
              {
                type: "container",
                block: true,
                bgType: "None",
                hAlign: "left",
                height: "50",
                vAlign: "top",
                bgColor: "#ffffff",
                contents: {
                  type: "blank",
                  isHTML: true,
                  contents: "<h6>a h6</h6>",
                },
                imageSize: "contain",
                isFormula: {},
                textColor: "#ffffff",
                borderStyle: "solid",
                borderWidth: "1",
                showForRole: [],
              },
              {
                url: "https://abc.com",
                type: "card",
                title: "The Title goes Here",
                contents: {
                  url: "https://saltcorn.com/",
                  text: "Click here",
                  type: "link",
                  nofollow: true,
                  isFormula: {},
                },
                isFormula: {},
              },
            ],
          },
          {
            name: "806e61",
            type: "view",
            view: "authorlist",
            state: "shared",
            contents:
              '<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby(\'author\', false)">Author</a></th><th>authorshow</th><th></th><th>Count patients</th></tr></thead><tbody><tr><td>Herman Melville</td><td><a href="/view/authorshow?id=1">authorshow</a></td><td><form action="/delete/books/1?redirect=/view/authorlist" method="post">\n  <input type="hidden" name="_csrf" value="">\n<button type="button" onclick="ajax_post_btn(this, true, undefined)" class=" btn btn-sm btn-primary">Delete</button></form></td><td>1</td></tr><tr><td>Leo Tolstoy</td><td><a href="/view/authorshow?id=2">authorshow</a></td><td><form action="/delete/books/2?redirect=/view/authorlist" method="post">\n  <input type="hidden" name="_csrf" value="">\n<button type="button" onclick="ajax_post_btn(this, true, undefined)" class=" btn btn-sm btn-primary">Delete</button></form></td><td>1</td></tr></tbody></table></div>',
          },
          {
            name: "18a8cc",
            type: "view",
            view: "authorshow",
            state: "fixed",
            contents: "Herman Melville",
          },
        ],
      },
      fixed_states: { "18a8cc": { id: 1 }, fixed_stateforauthorshowview: null },
    });
  });
});
describe("Feed view", () => {
  it("should render exactly", async () => {
    await test_feed({
      table: "books",
      cols_lg: 3,
      cols_md: 2,
      cols_sm: 1,
      cols_xl: 4,
      in_card: false,
      viewname: "authorfeed",
      show_view: "authoredit",
      descending: false,
      include_fml: "",
      order_field: "pages",
      exttable_name: null,
      rows_per_page: 20,
      view_to_create: "authoredit",
      hide_pagination: false,
      masonry_columns: false,
      create_view_label: null,
      create_view_display: "Embedded",
      create_view_location: null,

      response: !remoteQueries
        ? `<div><div class="row"><div class="col-sm-12 col-md-6 col-lg-4 col-xl-3"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="2"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Leo Tolstoy"></form></div><div class="col-sm-12 col-md-6 col-lg-4 col-xl-3"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Herman Melville"></form></div></div><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor"></form></div>`
        : `<div><div class="row"><div class="col-sm-12 col-md-6 col-lg-4 col-xl-3"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="2"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Leo Tolstoy"></form></div><div class="col-sm-12 col-md-6 col-lg-4 col-xl-3"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Herman Melville"></form></div></div><form action="javascript:void(0)" onsubmit="javascript:formSubmit(this, '/view/', 'authoredit')"  class="form-namespace " method="post"><input type="hidden" name="_csrf" value="false"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor"></form></div>`,
    });
  });
  it("should render masonry exactly", async () => {
    await test_feed({
      table: "books",
      cols_lg: 3,
      cols_md: 2,
      cols_sm: 1,
      cols_xl: 4,
      in_card: true,
      viewname: "authorfeed",
      show_view: "authoredit",
      descending: false,
      include_fml: "",
      order_field: "pages",
      exttable_name: null,
      rows_per_page: 20,
      view_to_create: "authoredit",
      hide_pagination: false,
      masonry_columns: true,
      create_view_label: "New book",
      create_view_display: "Link",
      create_view_location: "Top left",
      response: !remoteQueries
        ? '<div><a href="/view/authoredit">New book</a><div class="card-columns"><div class="card shadow mt-2"><div class="card-body"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="2"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Leo Tolstoy"></form></div></div><div class="card shadow mt-2"><div class="card-body"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Herman Melville"></form></div></div></div></div>'
        : `<div><a href="javascript:execLink('/view/authoredit');">New book</a><div class="card-columns"><div class="card shadow mt-2"><div class="card-body"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="2"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Leo Tolstoy"></form></div></div><div class="card shadow mt-2"><div class="card-body"><form action="/view/authoredit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><input type="text" class="form-control  " data-fieldname="author" name="author" id="inputauthor" value="Herman Melville"></form></div></div></div></div>`,
    });
  });
});
