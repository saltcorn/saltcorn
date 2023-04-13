import Table from "../models/table";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
import mocks from "./mocks";
const { plugin_with_routes, mockReqRes } = mocks;
const { getState } = require("../db/state");
import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { GenObj } from "../../saltcorn-types/dist/common_types";
import { renderEditInEditConfig } from "./remote_query_helper";
import {
  prepareEmployeeDepartment,
  prepareSimpleTopicPostRelation,
} from "./common_helpers";

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
  it("list join-aggs", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);
    const v = await View.create({
      table_id: table.id,
      name: "AggJoinTest",
      viewtemplate: "List",
      configuration: {
        columns: [
          {
            type: "Field",
            fieldview: "as_text",
            field_name: "author",
            state_field: "on",
          },
          {
            stat: "Count",
            type: "Aggregation",
            aggwhere: "",
            agg_field: "id",
            col_width: "",
            agg_relation: "publisher->books.publisher",
            header_label: "",
          },
        ],
        default_state: {},
      },
      min_role: 10,
    });
    const res = await v.run({}, mockReqRes);
    expect(res).toBe(
      '<div class="table-responsive"><table class="table table-sm"><thead><tr><th><a href="javascript:sortby(\'author\', false, \'249ab\')">Author</a></th><th>Count books</th></tr></thead><tbody><tr><td>Herman Melville</td><td>0</td></tr><tr><td>Leo Tolstoy</td><td>1</td></tr><tr><td>James Joyce</td><td>0</td></tr></tbody></table></div>'
    );
  });
});
describe("View with routes", () => {
  it("should create and delete", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
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

describe("subviews with relations", () => {
  it("blog_posts_feed with inbound relation", async () => {
    const v = View.findOne({ name: "show_user_with_blog_posts_feed" });
    assertIsSet(v);
    {
      const res = await v.run({ id: 1 }, mockReqRes);
      expect(res).toContain("Content of post APost A");
      expect(res).toContain("Content of post BPost B");
      expect(res).toContain("Content of post CPost C");
    }
    {
      const res = await v.run({ id: 2 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("Content of post APost A")).toBe(-1);
      expect(res.search("Content of post BPost B") >= 0).toBe(true);
      expect(res.search("Content of post CPost C")).toBe(-1);
    }
    {
      const res = await v.run({ id: 3 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res).toContain("Content of post APost A");
      expect(res).toContain("Content of post BPost B");
      expect(res).toContain("Content of post CPost C");
    }
  });

  it("blog_in_topic_feed with inbound relation", async () => {
    const v = View.findOne({ name: "show_user_with_blog_in_topic_feed" });
    assertIsSet(v);
    {
      const res = await v.run({ id: 1 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("Post ATopic A") >= 0).toBe(true);
      expect(res.search("Post BTopic A") >= 0).toBe(true);
      expect(res.search("Post CTopic A") >= 0).toBe(true);
    }
    {
      const res = await v.run({ id: 2 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("Post BTopic B") >= 0).toBe(true);
    }
    {
      const res = await v.run({ id: 3 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("Post ATopic A") >= 0).toBe(true);
      expect(res.search("Post BTopic A") >= 0).toBe(true);
      expect(res.search("Post CTopic A") >= 0).toBe(true);
      expect(res.search("Post BTopic B") >= 0).toBe(true);
    }
  });

  it("two levels inbound", async () => {
    const v = View.findOne({
      name: "show_user_with_blog_posts_feed_two_levels",
    });
    assertIsSet(v);
    const res = await v.run({ id: 1 }, mockReqRes);
    expect(res.length > 0).toBe(true);
    expect(res.search("Content of post APost A") >= 0).toBe(true);
    expect(res.search("Content of post BPost B")).toBe(-1);
    expect(res.search("Content of post CPost C") >= 0).toBe(true);
  });

  it("three levels inbound", async () => {
    /*
                  inbound_level_two      bp_inbound              post
      inbound_level_three -> inbound_inbound -> blog_post_inbound -> blog_posts
    */
    const levelThreeInbound = await Table.create("inbound_level_three");
    const inbound_inbound = Table.findOne({ name: "inbound_inbound" });
    assertIsSet(inbound_inbound);
    const topics = Table.findOne({ name: "topics" });
    assertIsSet(topics);
    await Field.create({
      table: levelThreeInbound,
      name: "inbound_level_two",
      reftable: inbound_inbound,
      label: "inbound to level 2",
      type: "Key",
      attributes: { summary_field: "id" },
    });
    await Field.create({
      table: levelThreeInbound,
      name: "topic",
      reftable: topics,
      label: "Topic",
      type: "Key",
      attributes: { summary_field: "id" },
    });
    await db.insert(
      "blog_post_inbound",
      {
        post: 1,
      },
      {
        ignoreExisting: true,
      }
    );
    await db.insert(
      "blog_post_inbound",
      {
        post: 3,
      },
      {
        ignoreExisting: true,
      }
    );
    await db.insert(
      "inbound_inbound",
      {
        bp_inbound: 1,
        topic: 1,
      },
      {
        ignoreExisting: true,
      }
    );
    await db.insert(
      "inbound_inbound",
      {
        bp_inbound: 2,
        topic: 1,
      },
      {
        ignoreExisting: true,
      }
    );
    const v = await View.create({
      table_id: 1,
      name: "show_user_with_blog_posts_feed_three_levels",
      viewtemplate: "Show",
      configuration: {
        columns: [],
        layout: {
          above: [
            {
              type: "view",
              view: "blog_posts_feed",
              relation:
                ".users.user_interested_in_topic$user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post",
              name: "bc653",
              state: "shared",
            },
          ],
        },
      },
      min_role: 10,
    });
    {
      const res = await v.run({ id: 1 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("Content of post APost A")).toBe(-1);
      expect(res.search("Content of post BPost B")).toBe(-1);
      expect(res.search("Content of post CPost C")).toBe(-1);
    }
    await db.insert("inbound_level_three", {
      inbound_level_two: 1,
      topic: 1,
    });
    await db.insert("inbound_level_three", {
      inbound_level_two: 2,
      topic: 1,
    });
    {
      const res = await v.run({ id: 1 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("Content of post APost A") >= 0).toBe(true);
      expect(res.search("Content of post BPost B")).toBe(-1);
      expect(res.search("Content of post CPost C") >= 0).toBe(true);
    }
  });

  it("employee department relation", async () => {
    await prepareEmployeeDepartment();
    const v = View.findOne({ name: "show_employee" });
    assertIsSet(v);
    {
      const res = await v.run({ id: 1 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("managermanager") >= 0).toBe(true);
    }
    {
      const res = await v.run({ id: 2 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("my_employeemanager") >= 0).toBe(true);
    }
  });

  it("simple post topic relation", async () => {
    await prepareSimpleTopicPostRelation();
    const v = View.findOne({ name: "show_user_with_simple_posts_list" });
    assertIsSet(v);
    {
      const res = await v.run({ id: 1 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("first post in topic A") >= 0).toBe(true);
      expect(res.search("second post in topic A") >= 0).toBe(true);
      expect(res.search("post in topic B")).toBe(-1);
    }
    {
      const res = await v.run({ id: 2 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("first post in topic A")).toBe(-1);
      expect(res.search("second post in topic A")).toBe(-1);
      expect(res.search("post in topic B")).toBe(-1);
    }
    {
      const res = await v.run({ id: 3 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("first post in topic A")).toBe(-1);
      expect(res.search("second post in topic A")).toBe(-1);
      expect(res.search("post in topic B")).toBe(-1);
    }

    const vlevels = View.findOne({
      name: "show_user_with_simple_posts_list_levels",
    });
    assertIsSet(vlevels);
    {
      const res = await vlevels.run({ id: 1 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("first post in topic A") >= 0).toBe(true);
      expect(res.search("second post in topic A")).toBe(-1);
      expect(res.search("post in topic B")).toBe(-1);
    }
    {
      const res = await vlevels.run({ id: 2 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("first post in topic A")).toBe(-1);
      expect(res.search("second post in topic A")).toBe(-1);
      expect(res.search("post in topic B")).toBe(-1);
    }
    {
      const res = await vlevels.run({ id: 3 }, mockReqRes);
      expect(res.length > 0).toBe(true);
      expect(res.search("first post in topic A")).toBe(-1);
      expect(res.search("second post in topic A")).toBe(-1);
      expect(res.search("post in topic B")).toBe(-1);
    }
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
  it("formula", async () => {
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
    assertIsSet(v.viewtemplateObj);

    await v.viewtemplateObj.configCheck?.(v);

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
describe("view slug", () => {
  it("should enable and run", async () => {
    const v = await View.findOne({ name: "authorshow" });
    assertIsSet(v);
    const slug = {
      label: "/:id",
      steps: [
        {
          field: "id",
          unique: true,
          transform: null,
        },
      ],
    };
    v.slug = slug;
    await View.update({ slug }, v.id as number);
    const query: any = {};
    v.rewrite_query_from_slug(query, ["1"]);
    expect(query.id).toBe("1");
    //const res = await v.run({}, mockReqRes);
  });
  it("set link", async () => {
    const v = await View.findOne({ name: "authorlist" });
    assertIsSet(v);
    const res = await v.run({}, mockReqRes);
    expect(res).toContain('<a href="/view/authorshow/1">authorshow</a>');
  });
});
