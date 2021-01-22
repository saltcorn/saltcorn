const db = require("../db/index.js");
const renderLayout = require("@saltcorn/markup/layout");
const Table = require("../models/table");
const TableConstraint = require("../models/table_constraints");
const Form = require("../models/form");
const Field = require("../models/field");
const Crash = require("../models/crash");
const File = require("../models/file");
const View = require("../models/view");
const Page = require("../models/page");
const { getViews } = require("../models/layout");

const { getState } = require("../db/state");
const { rick_file, mockReqRes } = require("./mocks");
getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("Table create", () => {
  it("should create", async () => {
    expect.assertions(1);
    const tc = await Table.create("mytable");
    const tf = await Table.findOne({ id: tc.id });

    expect(tf.name).toStrictEqual("mytable");
  });
});

describe("Crash", () => {
  it("should create", async () => {
    await Crash.create(new Error("my error"), { url: "/", headers: {} });
    const cs = await Crash.find();

    expect(cs[0].reltime.length > 0).toBe(true);
    const cs0 = await Crash.findOne({ id: cs[0].id });
    expect(cs0.msg_short).toBe("my error");
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
    await cs.delete();
  });
});

describe("File", () => {
  it("should create", async () => {
    await rick_file();
    const cs = await File.find();

    expect(cs[0].mime_super).toBe("image");
    const f = await File.findOne({ filename: "rick.png" });
    expect(f.mime_sub).toBe("png");
    expect(f.mimetype).toBe("image/png");
    await File.update(f.id, { size_kb: 56 });
    await f.delete();
  });
});

describe("TableConstraint", () => {
  it("should create", async () => {
    const table = await Table.findOne({ name: "books" });
    const con = await TableConstraint.create({
      table,
      type: "Unique",
      configuration: { fields: ["author", "pages"] },
    });
    const con1 = await TableConstraint.findOne({ id: con.id });
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
