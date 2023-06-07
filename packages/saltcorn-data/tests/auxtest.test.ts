import View from "../models/view";
import db from "../db";
import Table from "../models/table";
import Field from "../models/field";

const {
  get_parent_views,
  get_child_views,
  get_inbound_relation_opts,
  get_inbound_self_relation_opts,
  stateFieldsToWhere,
  field_picker_fields,
} = require("../plugin-helper");
const { getState } = require("../db/state");
const { satisfies } = require("../utils");

import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import mocks from "./mocks";
import {
  createAnotherUserField,
  createSecondTopicField,
  createMultipleInbounds,
  createKeyFromLevelTwo,
  createLevelThreeInbound,
  prepareEmployeeDepartment,
  prepareSimpleTopicPostRelation,
} from "./common_helpers";
import { assertIsSet } from "./assertions";

const { mockReqRes } = mocks;

getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("plugin helper", () => {
  it("get parent views", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const x = await get_parent_views(patients, "foobar");
    expect(x[0].views.map((v: View) => v.name)).toStrictEqual([
      "authoredit",
      "authorshow",
    ]);
  });
  it("get child views", async () => {
    const books = await Table.findOne({ name: "books" });
    const x = await get_child_views(books, "foobar");
    expect(x[1].views.map((v: View) => v.name)).toStrictEqual(["patientlist"]);
  });
  describe("inbound relations", () => {
    const expectedBase: any = [
      ".users.user_interested_in_topic$user.topic.blog_in_topic$topic",
      ".users.user_interested_in_topic$user.topic.blog_in_topic$topic.post",
      ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.bp_inbound.post",
      ".users.discusses_books$discussant.book.patients$favbook",
    ];

    it("single keys to source and rel table", async () => {
      const sourceTbl = await Table.findOne({ name: "users" });
      const opts: any = await get_inbound_relation_opts(sourceTbl, "top_view");
      for (const expected of expectedBase) {
        const actual = opts.find(
          (val: any) => val.path === expected && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });

    it("multiple keys to source and single key to rel table", async () => {
      await createAnotherUserField();
      const expected = [...expectedBase];
      expected.push(
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.bp_inbound.post"
      );
      const sourceTbl = await Table.findOne({ name: "users" });
      const opts: any = await get_inbound_relation_opts(sourceTbl, "top_view");
      for (const expectedPath of expected) {
        const actual = opts.find(
          (val: any) => val.path === expectedPath && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });

    it("multiple keys to source and rel table", async () => {
      await createAnotherUserField();
      await createSecondTopicField();
      const expected = [...expectedBase];
      expected.push(
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic.post",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.bp_inbound.post",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic.post"
      );
      const sourceTbl = await Table.findOne({ name: "users" });
      const opts: any = await get_inbound_relation_opts(sourceTbl, "top_view");
      for (const expectedPath of expected) {
        const actual = opts.find(
          (val: any) => val.path === expectedPath && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });

    it("multiple inbound tables", async () => {
      await createAnotherUserField();
      await createSecondTopicField();
      await createMultipleInbounds();
      const expected = [...expectedBase];
      expected.push(
        ".users.second_inbound$user.topic.blog_in_topic$second_topic",
        ".users.second_inbound$user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
        ".users.second_inbound$user.topic.blog_in_topic$second_topic.post",
        ".users.second_inbound$user.topic.blog_in_topic$topic.post",
        ".users.second_inbound$user.topic.inbound_inbound$topic.bp_inbound.post",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic.post",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.bp_inbound.post",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic.post"
      );
      const sourceTbl = await Table.findOne({ name: "users" });
      const opts: any = await get_inbound_relation_opts(sourceTbl, "top_view");
      for (const expectedPath of expected) {
        const actual = opts.find(
          (val: any) => val.path === expectedPath && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });

    it("key to source from level two", async () => {
      await createAnotherUserField();
      await createSecondTopicField();
      await createMultipleInbounds();
      await createKeyFromLevelTwo();
      const oldTbl = Table.findOne({ name: "second_inbound" });
      if (oldTbl) await oldTbl.delete();
      const expected = [...expectedBase];
      expected.push(
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic.post",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.bp_inbound.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.post_from_level_two",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic.post",
        ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.post_from_level_two"
      );
      const sourceTbl = await Table.findOne({ name: "users" });
      const opts: any = await get_inbound_relation_opts(sourceTbl, "top_view");
      for (const expectedPath of expected) {
        const actual = opts.find(
          (val: any) => val.path === expectedPath && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });

    it("three levels inbound", async () => {
      await createAnotherUserField();
      await createSecondTopicField();
      await createMultipleInbounds();
      await createKeyFromLevelTwo();
      const oldTbl = Table.findOne({ name: "second_inbound" });
      if (oldTbl) await oldTbl.delete();
      await createLevelThreeInbound();
      const expected = [...expectedBase];
      expected.push(
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$second_topic.post",
        ".users.user_interested_in_topic$another_user.topic.blog_in_topic$topic.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.bp_inbound.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_inbound$topic.post_from_level_two",
        ".users.user_interested_in_topic$another_user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post",
        ".users.user_interested_in_topic$another_user.topic.inbound_level_three$topic.inbound_level_two.post_from_level_two",
        ".users.user_interested_in_topic$user.topic.blog_in_topic$second_topic.post",
        ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.post_from_level_two",
        ".users.user_interested_in_topic$user.topic.inbound_level_three$topic.inbound_level_two.bp_inbound.post",
        ".users.user_interested_in_topic$user.topic.inbound_level_three$topic.inbound_level_two.post_from_level_two"
      );
      const sourceTbl = await Table.findOne({ name: "users" });
      const opts: any = await get_inbound_relation_opts(sourceTbl, "top_view");
      for (const expectedPath of expected) {
        const actual = opts.find(
          (val: any) => val.path === expectedPath && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });

    it("no inbound relations", async () => {
      const targetTbl = Table.findOne({ name: "publisher" });
      assertIsSet(targetTbl);
      const allRels: any = await get_inbound_relation_opts(
        targetTbl,
        "top_view"
      );
      expect(allRels).toEqual([]);
    });

    it("employee department relation", async () => {
      await prepareEmployeeDepartment();
      const employee = Table.findOne({ name: "employee" });
      assertIsSet(employee);
      const result: any = await get_inbound_self_relation_opts(
        employee,
        "show_employee"
      );
      expect(result.length).toBe(1);
      expect(result[0].path).toBe(".employee.department.manager");
      expect(result[0].views.length).toBe(1);
      expect(result[0].views[0].name).toBe("show_manager");
    });

    it("simple post topic relation", async () => {
      await prepareSimpleTopicPostRelation();
      const simplePosts = Table.findOne({ name: "simple_posts" });
      assertIsSet(simplePosts);
      const users = Table.findOne({ name: "users" });
      assertIsSet(users);
      const expected = [
        ".users.favsimpletopic.simple_posts$topic",
        ".users.favsimpletopic.simple_post_inbound$topic.post",
      ];
      const opts: any = await get_inbound_relation_opts(
        users,
        "show_user_with_simple_posts_list"
      );
      for (const expectedPath of expected) {
        const actual = opts.find(
          (val: any) => val.path === expectedPath && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });
  });
});
describe("stateFieldsToWhere", () => {
  const fields = [
    new Field({ name: "astr", type: "String" }),
    new Field({ name: "age", type: "Integer" }),
    { name: "props", type: { name: "JSON" } },
    {
      name: "attrs",
      type: { name: "JSON" },
      attributes: {
        hasSchema: true,
        schema: [{ key: "name", type: "String" }],
      },
    },
  ];
  it("normal field", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { astr: "foo", bstr: "bar" },
    });
    expect(w).toStrictEqual({ astr: { ilike: "foo" } });
  });
  it("int field bounds", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { _gte_age: 5, _lte_age: 15 },
    });
    expect(w).toStrictEqual({
      age: [
        { equal: true, gt: 5 },
        { equal: true, lt: 15 },
      ],
    });
  });
  it("normal field not approx", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { astr: "foo" },
      approximate: false,
    });
    expect(w).toStrictEqual({ astr: "foo" });
  });
  it("foreign field ", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { bstr: "foo" },
      approximate: false,
    });
    expect(w).toStrictEqual({});
  });
  it("foreign field ", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { bstr: { slugify: "foo" } },
      approximate: false,
    });
    expect(w).toStrictEqual({});
  });
  it("json field", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { props: { name: "Tom" } },
    });
    expect(w).toStrictEqual({ props: [{ json: { name: "Tom" } }] });
  });
  it("json field schema string", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { attrs: { name: "Tom" } },
    });
    expect(w).toStrictEqual({ attrs: [{ json: { name: { ilike: "Tom" } } }] });
  });
  it("json field int bounds", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { attrs: { cars__gte: 2, cars__lte: 4 } },
    });
    expect(w).toStrictEqual({
      attrs: [{ json: { cars: { gte: 2, lte: 4 } } }],
    });
  });
  it("array or", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { astr: ["foo", "bar"] },
    });
    expect(w).toStrictEqual({ astr: { or: ["foo", "bar"] } });
  });
  it("join field", async () => {
    const table = Table.findOne({ name: "patients" });
    const myFields = await table?.getFields();
    const w = stateFieldsToWhere({
      fields: myFields,
      state: { "favbook.books->author": "Herman" },
    });
    if (db.isSQLite)
      expect(w).toStrictEqual({
        favbook: [
          {
            inSelect: {
              field: "id",
              table: "books",
              tenant: undefined,
              where: { author: { ilike: "Herman" } },
            },
          },
        ],
      });
    else
      expect(w).toStrictEqual({
        favbook: [
          {
            inSelect: {
              field: "id",
              table: "books",
              tenant: "public",
              where: { author: { ilike: "Herman" } },
            },
          },
        ],
      });
  });
});
describe("satisfies", () => {
  it("works", async () => {
    expect(satisfies({ x: 5 })({ x: 5 })).toBe(true);
    expect(satisfies({ x: 5 })({ x: 5, y: 7 })).toBe(true);
    expect(satisfies({ x: 5 })({ x: 6 })).toBe(false);
    expect(satisfies({ x: 5 })({ y: 6 })).toBe(false);
    expect(satisfies({})({ y: 6 })).toBe(true);
    expect(satisfies()({ y: 6 })).toBe(true);
    expect(satisfies({ x: { or: [5, 6] } })({ x: 5 })).toBe(true);
    expect(satisfies({ x: { or: [5, 6] } })({ x: 8 })).toBe(false);
    expect(satisfies({ x: { or: [5, 6] } })({ y: 8 })).toBe(false);
    expect(satisfies({ x: { in: [5, 6] } })({ x: 5 })).toBe(true);
    expect(satisfies({ x: { in: [5, 6] } })({ x: 8 })).toBe(false);
    expect(satisfies({ x: { in: [5, 6] } })({ y: 8 })).toBe(false);

    expect(satisfies({ x: 5, y: 7 })({ x: 5, y: 7 })).toBe(true);
    expect(satisfies({ x: 5, y: 8 })({ x: 5, y: 7 })).toBe(false);
    expect(satisfies({ x: 4, y: 8 })({ x: 5, y: 7 })).toBe(false);
  });
});
describe("plugin helper", () => {
  it("field_picker_fields", async () => {
    const flds = await field_picker_fields({
      table: Table.findOne({ name: "patients" }),
      viewname: "myView",
      req: mockReqRes.req,
    });
    expect(flds.length).toBeGreaterThan(1);
    const flds1 = await field_picker_fields({
      table: Table.findOne({ name: "books" }),
      viewname: "myView",
      req: mockReqRes.req,
    });
    expect(flds1.length).toBeGreaterThan(1);
  });
});
