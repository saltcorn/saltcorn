const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const db = require("saltcorn-data/db");
const State = require("../db/state");
State.registerPlugin(require("../base-plugin"));

afterAll(db.close);

describe("Table create", () => {
  it("should create", async done => {
    expect.assertions(1);
    const tc = await Table.create("mytable1");
    const tf = await Table.findOne({ id: tc.id });

    expect(tf.name).toStrictEqual("mytable1");
    done();
  });
  it("should create required field in empty table without default", async done => {
    const mytable1 = await Table.findOne({ name: "mytable1" });
    await Field.create({
      table: mytable1,
      name: "height1",
      label: "height1",
      type: "Integer",
      required: true
    });
    done();
  });
  it("should delete", async done => {
    const table = await Table.findOne({ name: "mytable1" });
    await table.delete();
    const table1 = await Table.find({ name: "mytable1" });
    expect(table1.length).toBe(0);
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
    const michaels = await patients.getJoinedRows({
      where: { name: "Michael Douglas" }
    });
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].favbook).toBe("Leo Tolstoy");
    done();
  });
  it("should get joined rows with arbitrary fieldnames", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getJoinedRows({
      where: { name: "Michael Douglas" },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" }
      }
    });
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].pages).toBe(728);
    expect(michaels[0].author).toBe("Leo Tolstoy");
    done();
  });
  it("should get joined rows with limit and order", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id"
    });
    expect(all.length).toStrictEqual(2);
    expect(all[1].favbook).toBe("Leo Tolstoy");
    done();
  });
  it("should get joined rows with limit and desc order", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id",
      orderDesc: true
    });
    expect(all.length).toStrictEqual(2);
    expect(all[0].favbook).toBe("Leo Tolstoy");
    done();
  });
  it("should get joined rows with aggregations", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg"
        }
      }
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].avg_temp)).toBe(38);
    done();
  });
  it("should get joined rows with aggregations and joins", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getJoinedRows({
      orderBy: "id",
      aggregations: {
        avg_temp: {
          table: "readings",
          ref: "patient_id",
          field: "temperature",
          aggregate: "avg"
        }
      },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" }
      }
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].avg_temp)).toBe(38);
    expect(michaels[1].author).toBe("Leo Tolstoy");

    done();
  });
});

describe("Field", () => {
  it("should add and then delete required field", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const fc = await Field.create({
      table: patients,
      name: "Height1",
      label: "height1",
      type: "Integer",
      required: true,
      attributes: { default: 6 }
    });
    expect(fc.id > 0).toBe(true);
    const f = await Field.findOne({ id: fc.id });

    await f.delete();
    const fs = await Field.find({ name: "Height1" });
    expect(fs.length).toBe(0);

    done();
  });
  it("should add and then delete nonrequired field", async done => {
    const patients = await Table.findOne({ name: "patients" });
    const fc = await Field.create({
      table: patients,
      name: "Height11",
      label: "height11",
      type: "Integer",
      required: false
    });
    expect(fc.id > 0).toBe(true);
    const f = await Field.findOne({ id: fc.id });

    await f.delete();
    const fs = await Field.find({ name: "Height11" });
    expect(fs.length).toBe(0);

    done();
  });
});
