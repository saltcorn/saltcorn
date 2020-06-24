const db = require("../db/index.js");
const Table = require("./table");
const Form = require("./form");
const Field = require("./field");
const Crash = require("./crash");
const File = require("./file");
const View = require("./view");
const User = require("./user");
const Page = require("./page");

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

describe("Page", () => {
  it("should create", async () => {
    await Page.create({
      name: "foo",
      title: "foo",
      description: "foo",
      min_role: 4,
      layout: {},
      fixed_states: {}
    });

    const cs = await Page.find();

    expect(cs[0].name).toBe("foo");
  });
});

describe("File", () => {
  it("should create", async () => {
    await File.from_req_files(
      { mimetype: "image/png", name: "rick.png", mv() {}, size: 245752 },
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
