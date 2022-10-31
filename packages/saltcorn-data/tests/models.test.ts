import db from "../db/index";
import layoutMarkup from "@saltcorn/markup/layout";
const renderLayout = layoutMarkup;
import Table from "../models/table";
import TableConstraint from "../models/table_constraints";
import Form from "../models/form";
import Field from "../models/field";
import Crash from "../models/crash";
import File from "../models/file";
import View from "../models/view";
import Page from "../models/page";
import layoutModel from "../models/layout";
const { getViews } = layoutModel;

const { getState } = require("../db/state");
import mocks from "./mocks";
const { rick_file, mockReqRes } = mocks;
import Library from "../models/library";
import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

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
    const tf = await Table.findOne({ id: tc.id });
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
    const cs1 = await Page.findOne({ name: "foo copy" });
    expect(!!cs1).toBe(true);
  });
  it("should delelete", async () => {
    const cs = await Page.findOne({ name: "foo" });
    await cs.delete();
  });
});

describe("File", () => {
  it("should create", async () => {
    await rick_file();
    const cs = await File.find();
    const f_rick = cs.find((f) => f.filename === "rick.png");

    expect(f_rick?.mime_super).toBe("image");
    const f = await File.findOne({ filename: "rick.png" });
    assertIsSet(f);
    //assertIsSet(f.id);
    expect(f.mime_sub).toBe("png");
    expect(f.mimetype).toBe("image/png");
    expect(f.user_id).toBe(1);
    //await File.update(f.id, { size_kb: 56 });
    await f.delete();
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
    const table = await Table.findOne({ name: "books" });
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
