import db from "../db/index";
import layoutMarkup from "@saltcorn/markup/layout";
const renderLayout = layoutMarkup;
import Table from "../models/table";
import TableConstraint from "../models/table_constraints";
import Form from "../models/form";
import Field from "../models/field";
import Crash from "../models/crash";
import Model from "../models/model";
import ModelInstance from "../models/model_instance";
import File from "../models/file";
import View from "../models/view";
import Page from "../models/page";
import PageGroup from "../models/page_group";
import PageGroupMember from "../models/page_group_member";
import layoutModel from "../models/layout";
const { getViews } = layoutModel;

const { getState } = require("../db/state");
import mocks from "./mocks";
const { rick_file, mockReqRes } = mocks;
import Library from "../models/library";
import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { existsSync } from "fs";
import { join } from "path";

getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("Table create", () => {
  it("should create", async () => {
    expect.assertions(3);
    const tc = await Table.create("mytable");
    const tf = Table.findOne({ id: tc.id });
    assertIsSet(tf);
    expect(tf.name).toStrictEqual("mytable");
  });
});

describe("Crash", () => {
  it("should create", async () => {
    const oldConsoleError = console.error;
    console.error = jest.fn();

    await Crash.create(new Error("my error"), { url: "/", headers: {} });
    const cs = await Crash.find();

    expect(cs[0].reltime.length > 0).toBe(true);
    const cs0 = await Crash.findOne({ id: cs[0].id });
    expect(cs0.msg_short).toBe("my error");
    expect(console.error).toHaveBeenCalled();
    console.error = oldConsoleError;
  });
});

describe("Page", () => {
  it("should create", async () => {
    await Page.create({
      name: "foo",
      title: "grgw",
      description: "rgerg",
      min_role: 1,
      layout: {
        above: [
          {
            type: "blank",
            block: false,
            contents: "Hello world",
            textStyle: "",
          },
          { type: "line_break" },
          { type: "blank", isHTML: true, contents: "<h1> foo</h1>" },
          {
            url: "https://saltcorn.com/",
            text: "Click here",
            type: "link",
            block: false,
            textStyle: "",
          },
          {
            type: "card",
            title: "header",
            contents: {
              above: [
                null,
                {
                  aligns: ["left", "left"],
                  widths: [6, 6],
                  besides: [
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          block: false,
                          contents: "Hello world",
                          textStyle: "",
                        },
                        {
                          type: "view",
                          view: "authorlist",
                          name: "v46748",
                          state: "fixed",
                        },
                      ],
                    },
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          block: false,
                          contents: "Bye bye",
                          textStyle: "",
                        },
                        {
                          type: "view",
                          view: "authorlist",
                          name: "v46747",
                          state: "shared",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
      fixed_states: { v46748: { author: "Melville" } },
    });

    const cs = await Page.findOne({ name: "foo" });
    assertIsSet(cs);
    assertIsSet(cs.id);
    expect(cs.name).toBe("foo");
    const layout = await cs.run({}, mockReqRes);
    const html = renderLayout({ layout });
    expect(html).toContain(">Bye bye<");
    expect(html).toContain("Tolstoy");
    const vs = await getViews(cs.layout);
    expect(vs[0].name).toEqual("v46748");
    expect(vs[0].view).toEqual("authorlist");
    expect(vs[0].contents).toContain("Herman");
    expect(vs[0].contents).not.toContain("Tolstoy");
    expect(vs[1].name).toEqual("v46747");
    expect(vs[1].contents).toContain("Herman");
    expect(vs[1].contents).toContain("Tolstoy");
    await getState().setConfig("staff_home", "foo");
    await Page.update(cs.id, { description: "miaw" });
    await cs.clone();
    const cs1 = await Page.findOne({ name: "foo-copy" });
    expect(!!cs1).toBe(true);
  });
  it("should delelete", async () => {
    const cs = await Page.findOne({ name: "foo" });
    assertIsSet(cs);
    await cs.delete();
  });
});

describe("PageGroup", () => {
  it("should create", async () => {
    await PageGroup.create({
      name: "foo",
      description: "grgw",
      members: [],
      min_role: 100,
    });
    const cs = PageGroup.findOne({ name: "foo" });
    assertIsSet(cs);
    assertIsSet(cs.id);
    expect(cs.name).toBe("foo");
  });

  it("should update", async () => {
    const cs = PageGroup.findOne({ name: "foo" });
    assertIsSet(cs);
    assertIsSet(cs.id);
    await PageGroup.update(cs.id, { name: "bar" });
    expect(PageGroup.findOne({ name: "foo" })).toBeUndefined();
    expect(PageGroup.findOne({ name: "bar" })).toBeDefined();
  });

  it("should add pages", async () => {
    const pageGroup = PageGroup.findOne({ name: "bar" });
    assertIsSet(pageGroup);
    const aPage = Page.findOne({ name: "a_page" });
    const pageWithFile = Page.findOne({ name: "page_with_html_file" });
    const pageWithEmbeddedHtml = Page.findOne({
      name: "page_with embedded_html_page",
    });
    assertIsSet(aPage);
    assertIsSet(pageWithFile);
    assertIsSet(pageWithEmbeddedHtml);
    await pageGroup.addMember({
      page_id: aPage.id as number,
      eligible_formula: "true",
      sequence: 1,
    });
    await pageGroup.addMember({
      page_id: pageWithFile.id as number,
      eligible_formula: "true",
      sequence: 2,
    });
    await pageGroup.addMember({
      page_id: pageWithEmbeddedHtml.id as number,
      eligible_formula: "true",
      sequence: 3,
    });
    const updated = PageGroup.findOne({ name: "bar" });
    assertIsSet(updated);
    expect(updated.members.length).toBe(3);
  });

  it("should move members up/down", async () => {
    const pageGroup = PageGroup.findOne({ name: "bar" });
    assertIsSet(pageGroup);
    const members = pageGroup.sortedMembers();
    expect(members.map((m) => m.id)).toEqual([5, 6, 7]);
    await pageGroup.moveMember(members[1], "Down");
    const updated = PageGroup.findOne({ name: "bar" });
    assertIsSet(updated);
    const updatedMembers = updated.sortedMembers();
    expect(updatedMembers.map((m) => m.id)).toEqual([5, 7, 6]);
  });

  it("should find members", async () => {
    const allMembers = await PageGroupMember.find();
    const allMembersCached = await PageGroupMember.find({}, { cached: true });
    expect(allMembers.length).toBe(allMembersCached.length);
    expect(allMembers).toEqual(expect.arrayContaining(allMembersCached));
  });

  it("should clone the page group", async () => {
    const source = PageGroup.findOne({ name: "bar" });
    assertIsSet(source);
    const copy = await source.clone();
    assertIsSet(copy);
    assertIsSet(copy.id);
    expect(source.id).not.toBe(copy.id);
    expect(copy.name).toBe("bar copy");
    const fromState = PageGroup.findOne({ name: "bar copy" });
    assertIsSet(fromState);
    expect(fromState.id).toBe(copy.id);
    expect(fromState.members).toHaveLength(source.members.length);
  });

  it("should delete", async () => {
    const cs = PageGroup.findOne({ name: "bar" });
    assertIsSet(cs);
    const membersBefore = (await PageGroupMember.find()).length;
    await cs.delete();
    expect(PageGroup.findOne({ name: "bar" })).toBeUndefined();
    const membersAfter = (await PageGroupMember.find()).length;
    expect(membersAfter).toBeLessThan(membersBefore);
  });
});

describe("Library", () => {
  it("should create", async () => {
    await Library.create({
      name: "Foos",
      icon: "fa-cog",
      layout: { above: [{ type: "search_bar" }] },
    });
    const libs = await Library.find({});
    expect(libs.length).toBe(1);
    const suitable = libs[0].suitableFor("page");
    expect(suitable).toBe(true);
    const lib = await Library.findOne({ name: "Foos" });
    expect(lib.icon).toBe("fa-cog");
    expect(lib.toJson).toStrictEqual({
      icon: "fa-cog",
      layout: { above: [{ type: "search_bar" }] },
      name: "Foos",
    });
    await lib.update({ icon: "fa-bar" });
    await lib.delete();
  });
  it("should create with field", async () => {
    await Library.create({
      name: "Bars",
      icon: "fa-cog",
      layout: {
        above: [
          { type: "field" },
          { type: "aggregation" },
          { type: "view_link" },
          { type: "join_field" },
        ],
      },
    });
    const lib = await Library.findOne({ name: "Bars" });
    expect(lib.suitableFor("page")).toBe(false);
    expect(lib.suitableFor("show")).toBe(true);
    expect(lib.icon).toBe("fa-cog");
    await lib.delete();
  });
  it("should create with filter", async () => {
    await Library.create({
      name: "Bars",
      icon: "fa-cog",
      layout: {
        above: [{ type: "dropdown_filter" }, { type: "toggle_filter" }],
      },
    });
    const lib = await Library.findOne({ name: "Bars" });
    expect(lib.suitableFor("show")).toBe(false);
    expect(lib.suitableFor("filter")).toBe(true);
    expect(lib.icon).toBe("fa-cog");
    await lib.delete();
  });
});

describe("TableConstraint", () => {
  it("should create", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    const con = await TableConstraint.create({
      table,
      type: "Unique",
      configuration: { fields: ["author", "pages"] },
    });
    const con1 = await TableConstraint.findOne({ id: con.id });
    assertIsSet(con1);
    expect(con1.type).toBe("Unique");
    expect(con1.toJson.type).toBe("Unique");
    expect(con1.id).toBe(con.id);
    expect(con1.configuration.fields).toContain("pages");
    await con1.delete();
  });
});

describe("Form new", () => {
  it("should retain field class", () => {
    const form = new Form({
      action: "/",
      fields: [
        new Field({
          name: "summary_field",
          label: "Summary field",
          input_type: "text",
        }),
      ],
    });
    expect(form.fields[0].constructor.name).toBe(Field.name);
  });
  it("should add field class", () => {
    const form = new Form({
      action: "/",
      fields: [
        {
          name: "summary_field",
          label: "Summary field",
          input_type: "text",
        },
      ],
    });
    expect(form.fields[0].constructor.name).toBe(Field.name);
  });
});

describe("Model", () => {
  it("should create", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);
    const mdl = await Model.create({
      name: "mymodel",
      table_id: table.id as number,
      modelpattern: "modtype",
      configuration: { numcluster: 2 },
    });
    const mdl1 = await Model.findOne({ name: "mymodel" });
    expect(JSON.stringify(mdl1.configuration)).toBe(
      JSON.stringify(mdl.configuration)
    );
  });
  it("should create instance", async () => {
    const mdl = await Model.findOne({ name: "mymodel" });
    const inst = await ModelInstance.create({
      name: "mymodel",
      model_id: mdl.id as number,
      fit_object: Buffer.from("foo"),
      hyperparameters: { numcluster: 2 },
      trained_on: new Date(),
      is_default: false,
      metric_values: {},
      parameters: {},
      state: {},
      report: "",
    });
    await inst.make_default();
    expect(inst.is_default).toBe(true);
    await inst.make_default(true);
    expect(inst.is_default).toBe(false);
  });
});
