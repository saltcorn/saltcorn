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
const { getState } = require("../db/state");
const fs = require("fs").promises;

getState().registerPlugin("base", require("../base-plugin"));

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
      fixed_states: {}
    });

    const cs = await Page.findOne({ name: "foo" });
    expect(cs.name).toBe("foo");
    const layout = await cs.run({}, mockReqRes);
    const html = renderLayout({ layout });
    expect(html).toContain(">Bye bye<");
    expect(html).toContain("Tolstoy");
    await cs.delete();
  });
});

describe("File", () => {
  it("should create", async () => {
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
