const db = require("../db/index.js");
const Table = require("./table");
const Form = require("./form");
const Field = require("./field");
const Crash = require("./crash");
const File = require("./file");
const View = require("./view");

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
