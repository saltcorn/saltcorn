const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const Field = require("saltcorn-data/models/field");
const View = require("saltcorn-data/models/view");

require("./load_base_types")();

describe("Table create", () => {
  it("should create", async done => {
    expect.assertions(1);
    const tc = await Table.create("mytable1");
    const tf = await Table.findOne({ id: tc.id });

    expect(tf.name).toStrictEqual("mytable1");
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

describe("View", () => {
  it("should find", async done => {
    const link_views = await View.find({
      table_id: 1
    });
    expect(link_views.length).toBe(2);
    done();
  });
});
