import Table from "../models/table";
import View from "../models/view";
import db from "../db";
import mocks from "./mocks";
const { plugin_with_routes, mockReqRes } = mocks;
const { getState } = require("../db/state");
import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { GenObj } from "../../saltcorn-types/dist/common_types";
import { renderEditInEditConfig } from "./remote_query_helper";

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("View", () => {
  it("should run with no query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    expect(v.min_role).toBe(10);
    const res = await v.run({}, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should run on page", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    const res = await v.run_possibly_on_page(
      {},
      mockReqRes.req,
      mockReqRes.res
    );
    expect(res.length > 0).toBe(true);
  });
  it("should run with string query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    const res = await v.run({ author: "Mel" }, mockReqRes);

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as int", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    const res = await v.run({ pages: 967 }, mockReqRes);

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as string", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    const res = await v.run({ pages: "967" }, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should render list state form", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    const res = await v.get_state_form({}, mockReqRes.req);
    assertIsSet(res);
    expect(res.constructor.name).toBe("Form");
    expect(res.fields.length > 0).toBe(true);
  });
  it("should get config flow", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    const res = await v.get_config_flow({ __: (s: string) => s });
    expect(res.constructor.name).toBe("Workflow");
    expect(res.steps.length > 0).toBe(true);
  });
  it("should runMany with no query", async () => {
    const v = await View.findOne({ name: "authorshow" });
    assertIsSet(v);
    const res = await v.runMany({}, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should runPost", async () => {
    const v = await View.findOne({ name: "authoredit" });
    assertIsSet(v);
    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    const rows = await db.select("books", {});
    expect(rows).toContainEqual({
      author: "James Joyce",
      id: 3,
      pages: 678,
      publisher: null,
    });
  });
  it("should runPost with edit in edit", async () => {
    const readingsTbl = await Table.findOne({ name: "readings" });
    assertIsSet(readingsTbl);
    await View.create({
      name: "innerReads",
      table_id: readingsTbl.id,
      min_role: 10,
      configuration: renderEditInEditConfig.innerEdit,
      viewtemplate: "Edit",
    });
    const patientsTable = await Table.findOne({ name: "patients" });
    assertIsSet(patientsTable);
    const v = await View.create({
      table_id: patientsTable.id,
      name: "PatientEditWithReads",
      viewtemplate: "Edit",
      configuration: renderEditInEditConfig.outerEdit,
      min_role: 10,
    });
    await v.runPost(
      {},
      { id: 1, favbook: 1, name: "foo", parent: 2 },
      mockReqRes
    );
    const rows = await db.select("patients", {});
    expect(rows).toContainEqual({
      favbook: 1,
      name: "foo",
      parent: 2,
      id: 1,
    });
  });
  it("should find", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);
    const link_views = await View.find({
      table_id: table.id,
    });
    expect(link_views.length).toBe(3);
  });
  it("should find where", async () => {
    const link_views = await View.find_all_views_where(
      ({ viewrow }) => viewrow.name === "authorshow"
    );
    expect(link_views.length).toBe(1);
  });
  it("should create and delete", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);
    const v = await View.create({
      table_id: table.id,
      name: "anewview",
      viewtemplate: "List",
      configuration: { columns: [], default_state: { foo: "bar" } },
      min_role: 10,
    });
    expect(typeof v.id).toBe("number");
    expect(typeof v.viewtemplateObj).toBe("object");

    const st = v.combine_state_and_default_state({ baz: 3 });
    expect(st).toStrictEqual({ baz: 3, foo: "bar" });
    await v.delete();
    const v1 = await View.create({
      table_id: table.id,
      name: "anewview",
      viewtemplate: "List",
      configuration: { columns: [], default_state: { foo: "bar" } },
      min_role: 10,
    });
    assertIsSet(v1.id);
    await View.update({ name: "anewestview" }, v1.id);
    await View.delete({ name: "anewestview" });
  });
  it("should clone", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    await v.clone();
    const v1 = await View.findOne({ name: "authorlist copy" });
    assertIsSet(v1);
    expect(!!v1).toBe(true);
    const res = await v1.run({ author: "Mel" }, mockReqRes);

    expect(res.length > 0).toBe(true);
  });
});
describe("View with routes", () => {
  it("should create and delete", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    expect(getState().viewtemplates.ViewWithRoutes.name).toBe("ViewWithRoutes");
    var html, json;
    const spy = {
      send(h: any) {
        html = h;
      },
      json(h: GenObj) {
        json = h;
      },
    };
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);

    const v = await View.create({
      table_id: table.id,
      name: "aviewwithroutes",
      viewtemplate: "ViewWithRoutes",
      configuration: {},
      min_role: 10,
    });
    await v.runRoute("the_json_route", {}, spy, mockReqRes);
    await v.runRoute("the_html_route", {}, spy, mockReqRes);
    await v.runRoute("the_null_route", {}, spy, mockReqRes);
    expect(json).toEqual({ success: "ok" });
    expect(html).toEqual("<div>Hello</div>");

    const sf = await v.get_state_form({}, mockReqRes.req);
    expect(sf).toBe(null);
  });
});
describe("nested views", () => {
  it("should create and run", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);

    const small = await View.create({
      table_id: table.id,
      name: "small",
      viewtemplate: "Show",
      configuration: {
        layout: {
          above: [
            {
              aligns: ["left", "left"],
              widths: [2, 10],
              besides: [
                { above: [null, { type: "blank", contents: "Pages" }] },
                {
                  above: [
                    null,
                    { type: "field", fieldview: "show", field_name: "pages" },
                  ],
                },
              ],
            },
            { type: "line_break" },
          ],
        },
        columns: [{ type: "Field", fieldview: "show", field_name: "pages" }],
        viewname: "small",
      },
      min_role: 10,
    });
    const medium = await View.create({
      table_id: table.id,
      name: "medium",
      viewtemplate: "Show",
      configuration: {
        layout: {
          above: [
            {
              aligns: ["left", "left"],
              widths: [2, 10],
              besides: [
                { above: [null, { type: "blank", contents: "Author" }] },
                {
                  above: [
                    null,
                    {
                      type: "field",
                      fieldview: "as_text",
                      field_name: "author",
                    },
                  ],
                },
              ],
            },
            { type: "line_break" },
            { name: "64063e", type: "view", view: "small", state: "shared" },
          ],
        },
        columns: [
          { type: "Field", fieldview: "as_text", field_name: "author" },
        ],
        viewname: "medium",
      },
      min_role: 10,
    });
    const res = await medium.run({ id: 2 }, mockReqRes);

    expect(res).toContain("Tolstoy");
    expect(res).toContain("728");
    expect(res).not.toContain("967");
    expect(res).not.toContain("Melville");
  });
  it("should create and run feed of nested", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);

    const large = await View.create({
      table_id: table.id,
      name: "large",
      viewtemplate: "Feed",
      configuration: {
        cols_lg: 1,
        cols_md: 1,
        cols_sm: 1,
        cols_xl: 1,
        in_card: false,
        viewname: "large",
        show_view: "medium",
        descending: false,
        order_field: "author",
        view_to_create: "",
        create_view_display: "Link",
      },
      min_role: 10,
    });
    const res = await large.run({}, mockReqRes);

    expect(res).toContain("Tolstoy");
    expect(res).toContain("728");
    expect(res).toContain("967");
    expect(res).toContain("Melville");
  });
});

describe("edit dest", () => {
  it("standard list view", async () => {
    mockReqRes.reset();
    const v = await View.findOne({ name: "authoredit" });
    assertIsSet(v);
    v.configuration.view_when_done = "authorlist";
    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    expect(mockReqRes.getStored().url).toBe("/view/authorlist");
  });
  it("standard show view", async () => {
    mockReqRes.reset();
    const v = await View.findOne({ name: "authoredit" });
    assertIsSet(v);
    v.configuration.view_when_done = "authorshow";
    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    expect(mockReqRes.getStored().url).toContain("/view/authorshow?id=");
  });
  it("back to referrer", async () => {
    mockReqRes.reset();
    const v = await View.findOne({ name: "authoredit" });
    assertIsSet(v);
    v.configuration.destination_type = "Back to referer";
    mockReqRes.req.headers = { referer: "/bananas" };
    const res = await v.run({}, mockReqRes);
    expect(res).toContain(
      '<input type="hidden" class="form-control  " name="_referer" value="/bananas">'
    );
    await v.runPost(
      {},
      { author: "James Joyce", _referer: "/bananas" },
      mockReqRes
    );
    expect(mockReqRes.getStored().url).toBe("/bananas");
  });
  it("url formula", async () => {
    mockReqRes.reset();
    const v = await View.findOne({ name: "authoredit" });
    assertIsSet(v);
    v.configuration.destination_type = "URL formula";
    v.configuration.dest_url_formula = "'/view/foo/'+author";

    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    expect(mockReqRes.getStored().url).toBe("/view/foo/James Joyce");
  });
  it(" formula", async () => {
    mockReqRes.reset();
    const v = await View.findOne({ name: "authoredit" });
    assertIsSet(v);
    v.configuration.destination_type = "Formulas";
    v.configuration.formula_destinations = [
      {
        expression: "author.length>7",
        view: "authorlist",
      },
      {
        expression: "author.length<=7",
        view: "authorshow",
      },
    ];

    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    expect(mockReqRes.getStored().url).toBe("/view/authorlist");
    await v.runPost({}, { author: "T. Lin" }, mockReqRes);
    expect(mockReqRes.getStored().url).toContain("/view/authorshow?id=");
  });
  it("self", async () => {
    mockReqRes.reset();
    const v = await View.findOne({ name: "authoredit" });
    assertIsSet(v);
    v.configuration.view_when_done = "authoredit";
    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    expect(mockReqRes.getStored().url).toBe("/view/authoredit");
  });
});
