const db = require("../db/index.js");
const Table = require("./table");
const Form = require("./form");
const Field = require("./field");
const View = require("./view");

describe("Table create", () => {
  it("should create", async done => {
    expect.assertions(1);
    const tc = await Table.create("mytable");
    const tf = await Table.findOne({ id: tc.id });

    expect(tf.name).toStrictEqual("mytable");
    done();
  });
});

describe("Form new", () => {
  it("should retain field class", () => {
    const form = new Form({
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
