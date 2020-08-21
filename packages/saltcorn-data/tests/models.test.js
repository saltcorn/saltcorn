const db = require("../db/index.js");
const renderLayout = require("@saltcorn/markup/layout");
const Table = require("../models/table");
const Form = require("../models/form");
const Field = require("../models/field");
const Crash = require("../models/crash");
const File = require("../models/file");
const View = require("../models/view");
const User = require("../models/user");
const Page = require("../models/page");
const { getViews } = require("../models/layout");

const { getState } = require("../db/state");
const fs = require("fs").promises;

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

const mockReqRes = { req: { csrfToken: () => "" }, res: {} };

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
            textStyle: ""
          },
          { type: "line_break" },
          { type: "blank", isHTML: true, contents: "<h1> foo</h1>" },
          {
            url: "https://saltcorn.com/",
            text: "Click here",
            type: "link",
            block: false,
            textStyle: ""
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
                          textStyle: ""
                        },
                        {
                          type: "view",
                          view: "authorlist",
                          name: "v46748",
                          state: "fixed"
                        }
                      ]
                    },
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          block: false,
                          contents: "Bye bye",
                          textStyle: ""
                        },
                        {
                          type: "view",
                          view: "authorlist",
                          name: "v46747",
                          state: "shared"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      },
      fixed_states: { v46748: { author: "Melville" } }
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
    await File.ensure_file_store();
    const mv = async fnm => {
      await fs.writeFile(fnm, "nevergonnagiveyouup");
    };
    await File.from_req_files(
      { mimetype: "image/png", name: "rick.png", mv, size: 245752 },
      1,
      10
    );
    const cs = await File.find();

    expect(cs[0].mime_super).toBe("image");
    const f = await File.findOne({ filename: "rick.png" });
    expect(f.mime_sub).toBe("png");
    expect(f.mimetype).toBe("image/png");
    await File.update(f.id, { size_kb: 56 });
    await f.delete();
  });
});

describe("User", () => {
  it("should create", async () => {
    await User.create({ email: "foo@bar.com", password: "secret" });
    const u = await User.findOne({ email: "foo@bar.com" });
    expect(u.email).toBe("foo@bar.com");
    expect(u.password === "secret").toBe(false);
    const hasu = await User.nonEmpty();
    expect(hasu).toBe(true);
  });
  it("should authenticate", async () => {
    const u = await User.authenticate({
      email: "foo@bar.com",
      password: "secret"
    });
    expect(u.email).toBe("foo@bar.com");
    const u0 = await User.authenticate({
      email: "foo@bar.com",
      password: "secrat"
    });
    expect(u0).toBe(false);
    const u00 = await User.authenticate({
      email: "foo@baz.com",
      password: "secret"
    });
    expect(u00).toBe(false);
  });
  it("should delete", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    await u.delete();
    const us = await User.find({ email: "foo@bar.com" });
    expect(us.length).toBe(0);
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
          input_type: "text"
        })
      ]
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
          input_type: "text"
        }
      ]
    });
    expect(form.fields[0].constructor.name).toBe(Field.name);
  });
});
