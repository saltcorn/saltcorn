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

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
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
    const v = await View.create({
      table_id: tbl.id,
      name,
      viewtemplate,
      configuration: rest,
      min_role: 10,
    });

    const res = await v.run(
      id ? { id } : set_id ? { id: set_id } : {},
      mockReqRes
    );
    if (res !== response) console.log(res);
    expect(res).toBe(response);
    await v.delete();
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
      response: `<div class="row w-100"><div class="col-6"><div class="card mt-4 shadow"><div class="card-body"><button class="btn btn-link" type="button" onClick="ajax_modal('/view/authorshow?id=1')">foo it</button></div></div></div><div class="col-6"><div class="text-start" style="min-height: 100px;border: 1px solid black;  background-color: #a9a7a7;  "><a href="https://countto.com/967">Herman Melville</a></div></div></div>`,
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
      response: `<div class="row w-100"><div class="col-2">Author</div><div class="col-10">Herman Melville</div></div><br /><div class="row w-100"><div class="col-2">Pages</div><div class="col-10">967</div></div><br /><div class="text-start" style="min-height: 0px;border: 0px undefined black;    "><form action="/delete/books/1?redirect=/view/testshow" method="post" class="d-inline">
  <input type="hidden" name="_csrf" value="">
<button type="submit"  class=" btn  btn-primary ">Delete</button></form></div><div class="text-start" style="min-height: 0px;border: 0px undefined black;    ">VERY LONG</div>`,
    });
    await test_show({
      ...showbooks1,
      id: 2,
      response: `<div class="row w-100"><div class="col-2">Author</div><div class="col-10">Leo Tolstoy</div></div><br /><div class="row w-100"><div class="col-2">Pages</div><div class="col-10">728</div></div><br /><div class="text-start" style="min-height: 0px;border: 0px undefined black;    "><form action="/delete/books/2?redirect=/view/testshow" method="post" class="d-inline">
  <input type="hidden" name="_csrf" value="">
<button type="submit"  class=" btn  btn-primary ">Delete</button></form></div>`,
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
      response: `<form action="/view/testedit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><div class="row w-100"><div class="col-2">Name</div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname"></div></div><br /><div class="row w-100"><div class="col-2">Favourite book</div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1">Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><div class="row w-100"><div class="col-2">Parent</div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">1</option><option value="2">2</option></select></div></div><br /><button type="submit" class="btn btn-primary ">Save</button></form>`,
    });
    await test_edit({
      id: 1,
      layout,
      columns,
      response: `<form action="/view/testedit" class="form-namespace " method="post"><input type="hidden" name="_csrf" value=""><input type="hidden" class="form-control  " name="id" value="1"><div class="row w-100"><div class="col-2">Name</div><div class="col-10"><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname" value="Kirk Douglas"></div></div><br /><div class="row w-100"><div class="col-2">Favourite book</div><div class="col-10"><select class="form-control form-select   " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value=""></option><option value="1" selected>Herman Melville</option><option value="2">Leo Tolstoy</option></select></div></div><br /><div class="row w-100"><div class="col-2">Parent</div><div class="col-10"><select class="form-control form-select   " data-fieldname="parent" name="parent" id="inputparent"><option value=""></option><option value="1">1</option><option value="2">2</option></select></div></div><br /><button type="submit" class="btn btn-primary ">Save</button></form>`,
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
      response:
        '<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby(\'name\', false)">Name</a></th><th>name</th><th>author</th><th>Helloer</th><th>authorshow</th><th>readings</th><th></th><th></th></tr></thead><tbody><tr><td>Kirk Douglas</td><td></td><td>Herman Melville</td><td><a href="javascript:view_post(\'testlist\', \'run_action\', {action_name:\'run_js_code\', id:1});" class="btn btn-primary ">say hi</a></td><td><a href="/view/authorshow?id=1">6</a></td><td>2</td><td><a href="https://lmgtfy.app/?q=Kirk Douglas">KIRK DOUGLAS</a></td><td><form action="/delete/patients/1?redirect=/view/testlist" method="post">\n  <input type="hidden" name="_csrf" value="">\n<button type="button" onclick="if(confirm(\'Are you sure?\')) {ajax_post_btn(this, true, undefined)}" class=" btn btn-sm btn-outline-primary">Delete</button></form></td></tr><tr><td>Michael Douglas</td><td>Kirk Douglas</td><td>Leo Tolstoy</td><td><a href="javascript:view_post(\'testlist\', \'run_action\', {action_name:\'run_js_code\', id:2});" class="btn btn-primary ">say hi</a></td><td><a href="/view/authorshow?id=2">7</a></td><td>1</td><td><a href="https://lmgtfy.app/?q=Michael Douglas">MICHAEL DOUGLAS</a></td><td><form action="/delete/patients/2?redirect=/view/testlist" method="post">\n  <input type="hidden" name="_csrf" value="">\n<button type="button" onclick="if(confirm(\'Are you sure?\')) {ajax_post_btn(this, true, undefined)}" class=" btn btn-sm btn-outline-primary">Delete</button></form></td></tr></tbody></table></div>',
    });
  });
  it("should render list view with where aggregations", async () => {
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
      response: `<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby('author', false)">Author</a></th><th>Count patients</th><th>count 1</th></tr></thead><tbody><tr><td>Herman Melville</td><td>1</td><td>1</td></tr><tr><td>Leo Tolstoy</td><td>1</td><td>0</td></tr></tbody></table></div>`,
    });
  });
  it("should render triply joined list view", async () => {
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
      response: `<div class="table-responsive"><table class="table table-sm"><thead><tr><th style="text-align: right"><a href="javascript:sortby('temperature', false)">Temperature</a></th><th>name</th><th>author</th><th>publisher</th></tr></thead><tbody><tr><td style="text-align:right">37</td><td><a href="http://bbc.co.uk">Kirk Douglas</a></td><td><a href="http://bbc.co.uk">Herman Melville</a></td><td><a href="http://bbc.co.uk"></a></td></tr><tr><td style="text-align:right">39</td><td><a href="http://bbc.co.uk">Kirk Douglas</a></td><td><a href="http://bbc.co.uk">Herman Melville</a></td><td><a href="http://bbc.co.uk"></a></td></tr><tr><td style="text-align:right">37</td><td><a href="http://bbc.co.uk">Michael Douglas</a></td><td><a href="http://bbc.co.uk">Leo Tolstoy</a></td><td><a href="http://bbc.co.uk">AK Press</a></td></tr></tbody></table></div>`,
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
        '<div class="row w-100"><div class="col-6"><select name="ddfilterpatients.favbook.name" class="form-control form-select d-inline" style="width: unset;" onchange="this.value==\'\' ? unset_state_field(\'patients.favbook.name\'): set_state_field(\'patients.favbook.name\', this.value)"><option value="" class="text-muted"></option><option value="Kirk Douglas">Kirk Douglas</option><option value="Michael Douglas">Michael Douglas</option></select></div><div class="col-6"><button class="btn btn-outline-primary" onClick="set_state_field(\'pages\', \'13\')">thirteen</button></div></div><button class="btn btn-outline-primary" onClick="set_state_field(\'patients.favbook.name\', \'Jim\')">Jim</button><select name="ddfilterauthor" class="form-control form-select d-inline" style="width: unset;" onchange="this.value==\'\' ? unset_state_field(\'author\'): set_state_field(\'author\', this.value)"><option value="" class="text-muted"></option><option value="Herman Melville">Herman Melville</option><option value="Leo Tolstoy">Leo Tolstoy</option></select>',
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
