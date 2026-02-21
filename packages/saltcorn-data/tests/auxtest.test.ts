import View from "../models/view";
import db from "../db";
import Table from "../models/table";
import Field from "../models/field";
import async_json_stream from "../models/internal/async_json_stream";
const fs = require("fs");

const {
  get_parent_views,
  get_child_views,
  get_inbound_relation_opts,
  get_inbound_self_relation_opts,
  get_many_to_many_relation_opts,
  stateFieldsToWhere,
  field_picker_fields,
  readState,
  generate_joined_query,
  stateToQueryString,
} = require("../plugin-helper");
const { getState } = require("../db/state");
const {
  satisfies,
  urlStringToObject,
  cloneName,
  objectToQueryString,
  validSqlId,
} = require("../utils");

import { afterAll, describe, it, expect, beforeAll, jest } from "@jest/globals";
import mocks from "./mocks";
import {
  createAnotherUserField,
  createSecondTopicField,
  createMultipleInbounds,
  createKeyFromLevelTwo,
  createLevelThreeInbound,
  prepareSimpleTopicPostRelation,
} from "./common_helpers";
import { assertIsSet } from "./assertions";
import expression from "../models/expression";
const { freeVariables, add_free_variables_to_joinfields } = expression;
const PlainDate = require("@saltcorn/plain-date");

const { mockReqRes } = mocks;

getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("string manipulators", () => {
  it("cloneName", async () => {
    expect(cloneName("Foo", [])).toBe("Foo-copy");
    expect(cloneName("Foo", ["Foo-copy"])).toBe("Foo-copy-1");
  });
  it("validSqlId", async () => {
    expect(validSqlId("Sr. Søejer")).toBe("sr_soejer");
  });
});

describe("stateToQueryString", () => {
  it("makes query string", async () => {
    expect(stateToQueryString({ x: "5" })).toBe("?x=5");
    expect(stateToQueryString({ x: "5", y: "goo" })).toBe("?x=5&y=goo");
  });
  it("makes query string with array", async () => {
    expect(stateToQueryString({ x: [5, 6] })).toBe("?x=5&x=6");
    expect(stateToQueryString({ x: [5] })).toBe("?x=5");
    expect(stateToQueryString({ x: [5, 6], z: true })).toBe("?x=5&x=6&z=true");
  });
  it("makes query string with lt/gt", async () => {
    expect(stateToQueryString({ x: { lt: 5 } })).toBe("?_lt_x=5");
    expect(stateToQueryString({ x: { lt: 5, gt: 1 } })).toBe(
      "?_gt_x=1&_lt_x=5"
    );
    expect(stateToQueryString({ x: { lt: 5 }, y: "foo" })).toBe(
      "?_lt_x=5&y=foo"
    );
    expect(stateToQueryString({ x: { gt: 5 } })).toBe("?_gt_x=5");
    expect(stateToQueryString({ x: { lt: 5, equal: true } })).toBe("?_lte_x=5");
  });
  it("handles date", async () => {
    expect(stateToQueryString({ pubdate: new PlainDate("2025-10-15") })).toBe(
      "?pubdate=2025-10-15"
    );
    expect(
      stateToQueryString({ pubdate: { gt: new PlainDate("2025-10-15") } })
    ).toBe("?_gt_pubdate=2025-10-15");

    expect(stateToQueryString({ pubdate: new Date("2025-10-15") })).toBe(
      "?pubdate=2025-10-15T00%3A00%3A00.000Z"
    );
    expect(
      stateToQueryString({ pubdate: { lt: new Date("2025-10-15") } })
    ).toBe("?_lt_pubdate=2025-10-15T00%3A00%3A00.000Z");
  });
});

describe("async_json_stream", () => {
  it("writes test file", async () => {
    const data = [
      { name: "Tom", age: 13 },
      { name: "Harry", age: 41 },
    ];
    fs.writeFileSync("/tmp/testjsondata.json", JSON.stringify(data));
  });
  it("reads", async () => {
    const data = [];
    await async_json_stream("/tmp/testjsondata.json", async (person) => {
      data.push(person);
    });
    expect(data.length).toBe(2);
  });
});

describe("generate_joined_query", () => {
  it("should generate state", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const q = generate_joined_query({ table, state: { author: "Leo" } });
    expect(q?.where?.author?.ilike).toBe("Leo");
    const rows = await table.getJoinedRows(q);
    expect(rows.length).toBe(1);
    expect(rows[0].author).toBe("Leo Tolstoy");
  });
  it("should generate FTS state", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const q = generate_joined_query({ table, state: { _fts_books: "Leo" } });
    expect(q?.where?._fts?.searchTerm).toBe("Leo");
    const rows = await table.getJoinedRows(q);
    expect(rows.length).toBe(1);
    expect(rows[0].author).toBe("Leo Tolstoy");
  });
  it("should generate FTS state with inlcude key summary", async () => {
    const table = Table.findOne({ name: "patients" });
    assertIsSet(table);
    const q = generate_joined_query({
      table,
      state: { _fts_patients: "Herman" },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(q?.where?._fts?.searchTerm).toBe("Herman");
    const rows = await table.getJoinedRows(q);
    expect(rows.length).toBe(1);
    expect(rows[0].author).toBe("Herman Melville");
  });
  it("should generate formulas", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const q = generate_joined_query({ table, formulas: ["publisher.name"] });
    expect(q?.joinFields?.publisher_name?.target).toBe("name");
    const rows = await table.getJoinedRows(q);
    expect(rows.length).toBe(2);
  });
  it("should generate for show view", async () => {
    const user = { id: 1 };
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const view = View.findOne({ name: "authorshow" });
    assertIsSet(view);
    const q = generate_joined_query({
      table,
      state: { id: "1" },
      ...view.configuration,
      user,
    });
    expect(q?.where?.id).toBe(1);
    expect(q?.forUser?.id).toBe(1);
    expect(q.aggregations.count_patients_favbook_name_undefined.field).toBe(
      "name"
    );
    const rows = await table.getJoinedRows(q);
    expect(rows.length).toBe(1);
  });
});

describe("Half-H notation for joinfields", () => {
  // deciding between ㅏ Ⱶ Ͱ
  // publisherͰname
  // publisherⱵname
  // publisherㅏname
  it("freeVariables", () => {
    expect([...freeVariables("2+xⱵk")]).toEqual(["xⱵk"]);
  });
  it("add_free_variables_to_joinfields", () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const joinFields = {};
    const freeVars = freeVariables("publisherⱵname");
    add_free_variables_to_joinfields(freeVars, joinFields, table.fields);
    expect(joinFields).toStrictEqual({
      publisherⱵname: {
        ref: "publisher",
        target: "name",
      },
    });
  });
  it("should generate formulas", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const q = generate_joined_query({
      table,
      state: { pages: 728 },
      formulas: ["publisherⱵname"],
    });

    expect(q?.joinFields?.publisherⱵname?.target).toBe("name");
    const rows = await table.getJoinedRows(q);
    expect(rows.length).toBe(1);
    expect(rows[0].publisher).toBe(1);
    expect(rows[0].publisherⱵname).toBe("AK Press");
  });
});

describe("plugin helper", () => {
  it("get parent views", async () => {
    const patients = Table.findOne({ name: "patients" });
    const x = await get_parent_views(patients, "foobar");
    expect(x[0].views.map((v: View) => v.name).sort()).toStrictEqual([
      "author_multi_edit",
      "authoredit",
      "authoredit_identicals",
      "authoredit_with_independent_list",
      "authoredit_with_independent_list_legacy",
      "authoredit_with_show",
      "authoredit_with_show_legacy",
      "authorshow",
      "authorshow_with_list_legacy",
      "show_author_with_disc_books_list",
    ]);
  });
  it("get child views", async () => {
    const books = Table.findOne({ name: "books" });
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
      const sourceTbl = Table.findOne({ name: "users" });
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
      const sourceTbl = Table.findOne({ name: "users" });
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
      const sourceTbl = Table.findOne({ name: "users" });
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
      const sourceTbl = Table.findOne({ name: "users" });
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
      const sourceTbl = Table.findOne({ name: "users" });
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
      const sourceTbl = Table.findOne({ name: "users" });
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
      const employee = Table.findOne({ name: "employee" });
      assertIsSet(employee);
      const result: any = await get_inbound_self_relation_opts(
        employee,
        "show_employee"
      );
      expect(result.length).toBe(1);
      expect(result[0].path).toBe(".employee.department.manager");
      expect(result[0].views.length).toBe(3);
      expect(result[0].views[0].name).toBe("create_employee");
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

  describe("many to many relations", () => {
    it("artist_plays_on_album", async () => {
      const artists = Table.findOne({ name: "artists" });
      const opts = await get_many_to_many_relation_opts(
        artists,
        "show_artist",
        null,
        [".artists"]
      );
      const expected = [".artists.artist_plays_on_album$artist.album"];
      for (const expectedPath of expected) {
        const actual = opts.find(
          (val: any) => val.path === expectedPath && val.views.length > 0
        );
        expect(actual).toBeDefined();
      }
    });

    it("show pressing_job with embedded fan club feed", async () => {
      const pressingJob = Table.findOne({ name: "pressing_job" });
      const opts = await get_many_to_many_relation_opts(
        pressingJob,
        "show_pressing_job",
        null,
        [".pressing_job"]
      );
      const expected = [
        ".pressing_job.album.artist_plays_on_album$album.artist.fan_club$artist",
      ];
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
    new Field({ name: "dob", type: "Date", attributes: { day_only: true } }),
    new Field({ name: "tob", type: "Date", attributes: { day_only: false } }),
    new Field({ name: "favbook", type: "Key to books" }),
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
  it("not", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { _not_age: 5 },
    });
    expect(w).toStrictEqual({
      not: { age: 5 },
    });
  });
  it("date bounds", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { _fromneqdate_dob: 5, _toneqdate_dob: 15 },
    });
    expect(w).toStrictEqual({
      dob: [
        { gt: new PlainDate(5), day_only: true },
        { lt: new PlainDate(15), day_only: true },
      ],
    });
  });
  it("date bounds inclusive", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { _fromdate_dob: "2025-07-24", _todate_dob: "2025-07-27" },
    });
    expect(w).toStrictEqual({
      dob: [
        { gt: new PlainDate("2025-07-24"), equal: true, day_only: true },
        { lt: new PlainDate("2025-07-27"), equal: true, day_only: true },
      ],
    });
  });
  it("date bounds inclusive with time", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { _fromdate_tob: "2025-07-24", _todate_tob: "2025-07-27" },
    });
    expect(w).toStrictEqual({
      tob: [
        { gt: new Date("2025-07-24"), equal: true, day_only: false },
        { lt: new Date("2025-07-28"), equal: true, day_only: false },
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
  it("multifield or", async () => {
    const w = stateFieldsToWhere({
      fields,
      state: { age: 15, astr: "foo", _or_field: ["age", "astr"] },
    });
    expect(w).toStrictEqual({ or: [{ age: 15 }, { astr: { ilike: "foo" } }] });
  });
  it("fkey", async () => {
    expect(
      stateFieldsToWhere({
        fields,
        state: { favbook: 1 },
      })
    ).toStrictEqual({ favbook: 1 });
  });
  it("array or fkey", async () => {
    expect(
      stateFieldsToWhere({
        fields,
        state: { favbook: [1, 2] },
      })
    ).toStrictEqual({ favbook: { or: [1, 2] } });
  });
  it("readState array or fkey", async () => {
    const state = { favbook: ["1", "2"] };
    readState(state, fields, mockReqRes.req);
    expect(state).toStrictEqual({ favbook: [1, 2] });
  });
  it("or array age", async () => {
    expect(
      stateFieldsToWhere({
        fields,
        state: { or: [{ age: 1 }] },
      })
    ).toStrictEqual({ or: [{ age: 1 }] });
  });
  it("readState fkey", async () => {
    const state = { favbook: "1" };
    readState(state, fields, mockReqRes.req);
    expect(state).toStrictEqual({ favbook: 1 });
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
describe("urlStringToObject", () => {
  it("works", async () => {
    expect(urlStringToObject(null)).toStrictEqual({});
    expect(urlStringToObject("")).toStrictEqual({});
    expect(urlStringToObject("http://bar.com")).toStrictEqual({});
    expect(urlStringToObject("http://bar.com?a=1&b=foo")).toStrictEqual({
      a: "1",
      b: "foo",
    });
    expect(urlStringToObject("http://bar.com?a=1&b=foo#mylink")).toStrictEqual({
      a: "1",
      b: "foo",
    });
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

describe("objectToQueryString", () => {
  it("ordinary works", async () => {
    expect(objectToQueryString({})).toBe("");
    expect(objectToQueryString({ a: 5 })).toBe("a=5");
    expect(objectToQueryString({ a: 5, b: "Foo" })).toBe("a=5&b=Foo");
    expect(objectToQueryString({ a: 5, b: "F oo" })).toBe("a=5&b=F%20oo");
  });
  it("collects or", async () => {
    expect(objectToQueryString({ a: { or: ["Foo", "Bar"] } })).toBe(
      "a=Foo&a=Bar"
    );
    expect(objectToQueryString({ a: ["Foo", "Bar"] })).toBe("a=Foo&a=Bar");
  });
});
