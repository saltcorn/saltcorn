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

describe("Table get data", () => {
  it("should get rows", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getRows();
    expect(all.length).toStrictEqual(2);
    done();
  });
  it("should get rows where name is Michael", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getRows({ name: "Michael Douglas" });
    expect(michaels.length).toStrictEqual(1);
    done();
  });
  it("should get limited rows", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getRows(
      { name: { ilike: "Douglas" } },
      { limit: 1, orderBy: "id", offset: 1 }
    );
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].name).toStrictEqual("Michael Douglas");

    done();
  });
  it("should get joined rows where name is Michael", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getJoinedRows({ name: "Michael Douglas" });
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].favbook).toBe("Leo Tolstoy");
    done();
  });
});

describe("Table add field", () => {
  it("should add field", async done => {
    const patients = await Table.findOne({ name: "patients" });
    await Field.create({
      table: patients,
      name: "height1",
      label: "height1",
      type: "Integer",
      required: true,
      attributes: { default: 6 }
    });
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
