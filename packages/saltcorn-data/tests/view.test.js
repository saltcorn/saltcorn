const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");
const db = require("../db");
const { plugin_with_routes, mockReqRes } = require("./mocks");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("View", () => {
  it("should run with no query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    expect(v.min_role).toBe(10);
    expect(v.on_root_page).toBe(true);
    const res = await v.run({}, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should run with string query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ author: "Mel" }, mockReqRes);

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as int", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: 967 }, mockReqRes);

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as string", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: "967" }, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should render list state form", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.get_state_form({});
    expect(res.constructor.name).toBe("Form");
    expect(res.fields.length > 0).toBe(true);
  });
  it("should get config flow", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.get_config_flow({ __: (s) => s });
    expect(res.constructor.name).toBe("Workflow");
    expect(res.steps.length > 0).toBe(true);
  });
  it("should runMany with no query", async () => {
    const v = await View.findOne({ name: "authorshow" });
    const res = await v.runMany({}, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should runPost", async () => {
    const v = await View.findOne({ name: "authoredit" });
    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    const rows = await db.select("books", {});
    expect(rows).toContainEqual({ author: "James Joyce", id: 3, pages: 678 });
  });
  it("should find", async () => {
    const link_views = await View.find({
      table_id: 1,
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
    const v = await View.create({
      table_id: 1,
      name: "anewview",
      viewtemplate: "List",
      configuration: { columns: [], default_state: { foo: "bar" } },
      min_role: 10,
      on_root_page: true,
    });
    expect(typeof v.id).toBe("number");
    expect(typeof v.viewtemplateObj).toBe("object");

    const st = v.combine_state_and_default_state({ baz: 3 });
    expect(st).toStrictEqual({ baz: 3, foo: "bar" });
    await View.update({ on_root_page: false }, v.id);
    await v.delete();
  });
});
describe("View with routes", () => {
  it("should create and delete", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    expect(getState().viewtemplates.ViewWithRoutes.name).toBe("ViewWithRoutes");
    var html, json;
    const spy = {
      send(h) {
        html = h;
      },
      json(h) {
        json = h;
      },
    };
    const v = await View.create({
      table_id: 1,
      name: "aviewwithroutes",
      viewtemplate: "ViewWithRoutes",
      configuration: {},
      min_role: 10,
      on_root_page: true,
    });
    await v.runRoute("the_json_route", {}, spy, mockReqRes);
    await v.runRoute("the_html_route", {}, spy, mockReqRes);
    await v.runRoute("the_null_route", {}, spy, mockReqRes);
    expect(json).toEqual({ success: "ok" });
    expect(html).toEqual("<div>Hello</div>");

    const sf = await v.get_state_form({});
    expect(sf).toBe(null);
  });
});
describe("nested views", () => {
  it("should create and run", async () => {
    const small = await View.create({
      table_id: 1,
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
      on_root_page: false,
    });
    const medium = await View.create({
      table_id: 1,
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
      on_root_page: false,
    });
    const res = await medium.run({ id: 2 }, mockReqRes);

    expect(res).toContain("Tolstoy");
    expect(res).toContain("728");
    expect(res).not.toContain("967");
    expect(res).not.toContain("Melville");
  });
  it("should create and run feed of nested", async () => {
    const large = await View.create({
      table_id: 1,
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
      on_root_page: false,
    });
    const res = await large.run({}, mockReqRes);

    expect(res).toContain("Tolstoy");
    expect(res).toContain("728");
    expect(res).toContain("967");
    expect(res).toContain("Melville");
  });
});
