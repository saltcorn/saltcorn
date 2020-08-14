const Table = require("../models/table");
const Field = require("../models/field");
const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const fs = require("fs").promises;

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("TableIO", () => {
  it("should store attributes", async () => {
    const tc = await Table.create("mytesttable");
    await Field.create({
      table: tc,
      name: "foo_height1",
      label: "height1",
      type: "Integer",
      attributes: { max: 18 }
    });
    const fs = await db.selectOne("_sc_fields", { name: "foo_height1" });
    expect(fs.table_id).toBe(tc.id);
    expect(fs.table_id > 0).toBe(true);
    expect(fs.id > 0).toBe(true);
    const fields = await tc.getFields();
    expect(fields[0].attributes).toStrictEqual({ max: 18 });
  });
});
describe("Table create", () => {
  it("should create", async () => {
    expect.assertions(1);
    const tc = await Table.create("mytable1");
    const tf = await Table.findOne({ id: tc.id });

    expect(tf.name).toStrictEqual("mytable1");
  });
  it("should create required field in empty table without default", async () => {
    const mytable1 = await Table.findOne({ name: "mytable1" });
    await Field.create({
      table: mytable1,
      name: "height1",
      label: "height1",
      type: "Integer",
      required: true
    });
  });
  it("should insert", async () => {
    const mytable1 = await Table.findOne({ name: "mytable1" });
    expect(mytable1.name).toBe("mytable1");
    const id = await db.insert(mytable1.name, { height1: 6 });
    expect(typeof id).toBe("number");
    expect(id > 0).toBe(true);

    const row = await db.selectOne(mytable1.name, { id });
    expect(row.height1).toBe(6);
    await db.update(mytable1.name, { height1: 7 }, id);
    const rowup = await db.selectOne(mytable1.name, { id });
    expect(rowup.height1).toBe(7);
  });
  it("should select one or zero", async () => {
    const rows = await db.select("mytable1", {});
    expect(rows.length).toBe(1);
    const row = await db.selectMaybeOne("mytable1", { id: rows[0].id });
    expect(row.height1).toBe(7);
    const norow = await db.selectMaybeOne("mytable1", { id: 789 });
    expect(norow).toBe(null);
    await expect(
      (async () => await db.selectOne("mytable1", { id: 789 }))()
    ).rejects.toThrow(Error);
  });
  it("should delete", async () => {
    const table = await Table.findOne({ name: "mytable1" });
    await table.delete();
    const table1 = await Table.find({ name: "mytable1" });
    expect(table1.length).toBe(0);
  });
});

describe("Table get data", () => {
  it("should get rows", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getRows();
    expect(all.length).toStrictEqual(2);
  });
  it("should get rows where name is Michael", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getRows({ name: "Michael Douglas" });
    expect(michaels.length).toStrictEqual(1);
  });
  it("should get limited rows", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getRows(
      { name: { ilike: "Douglas" } },
      { limit: 1, orderBy: "id", offset: 1 }
    );
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].name).toStrictEqual("Michael Douglas");
  });
  it("should get joined rows where name is Michael", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const michaels = await patients.getJoinedRows({
      where: { name: "Michael Douglas" }
    });
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].favbook).toBe(2);
  });
  it("should get joined rows with arbitrary fieldnames", async () => {
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
  });
  it("should get joined rows with limit and order", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id"
    });
    expect(all.length).toStrictEqual(2);
    expect(all[1].favbook).toBe(2);
  });
  it("should get joined rows with limit and desc order", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id",
      orderDesc: true
    });
    expect(all.length).toStrictEqual(2);
    expect(all[0].favbook).toBe(2);
  });
  it("should get joined rows with aggregations", async () => {
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
  });
  it("should get joined rows with aggregations and joins", async () => {
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
  });

  it("should support full text search", async () => {
    const table = await Table.findOne({ name: "patients" });
    const fields = await table.getFields();
    const rows = await db.select("patients", {
      _fts: { fields, searchTerm: "Douglas" }
    });

    expect(rows.length).toBe(2);
  });
  it("should enable versioning", async () => {
    const table = await Table.findOne({ name: "patients" });
    table.versioned = true;
    await table.update(table);
    await table.insertRow({ name: "Bunny foo-foo" });
    const bunnyFooFoo = await table.getRow({ name: "Bunny foo-foo" });
    const history1 = await table.get_history(bunnyFooFoo.id);
    expect(history1.length).toBe(1);
    expect(history1[0].id).toBe(bunnyFooFoo.id);
    expect(history1[0]._version).toBe(1);
    expect(history1[0].name).toBe("Bunny foo-foo");
    await table.updateRow({ name: "Goon" }, bunnyFooFoo.id);
    const history2 = await table.get_history(bunnyFooFoo.id);
    expect(history2.length).toBe(2);
    expect(history2[0].id).toBe(bunnyFooFoo.id);
    expect(history2[0]._version).toBe(1);
    expect(history2[0].name).toBe("Bunny foo-foo");
    expect(history2[1].id).toBe(bunnyFooFoo.id);
    expect(history2[1]._version).toBe(2);
    expect(history2[1].name).toBe("Goon");
    const goon = await table.getRow({ id: bunnyFooFoo.id });
    expect(goon.name).toBe("Goon");
    const fc = await Field.create({
      table: table,
      name: "Height19",
      label: "height19",
      type: "Integer",
      required: true,
      attributes: { default: 6 }
    });
    await fc.delete();

    table.versioned = false;
    await table.update(table);
  });
});
describe("CSV import", () => {
  it("should import into existing table", async () => {
    const csv = `author,pages
Joe Celko, 856
Gordon Kane, 217`;
    const fnm = "/tmp/test1.csv";
    await fs.writeFile(fnm, csv);
    const table = await Table.findOne({ name: "books" });
    expect(!!table).toBe(true);
    await table.import_csv_file(fnm);
    const rows = await table.getRows({ author: "Gordon Kane" });
    expect(rows.length).toBe(1);
    expect(rows[0].pages).toBe(217);
  });
  it("should create by importing", async () => {
    const csv = `item,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const { table } = await Table.create_from_csv("Invoice", fnm);
    const fields = await table.getFields();
    const vatField = fields.find(f => f.name === "vatable");
    expect(vatField.type.name).toBe("Bool");
    const costField = fields.find(f => f.name === "cost");
    expect(costField.type.name).toBe("Float");
    const countField = fields.find(f => f.name === "count");
    expect(countField.type.name).toBe("Integer");
    const rows = await table.getRows({ item: "Pencil" });
    expect(rows.length).toBe(1);
    expect(rows[0].vatable).toBe(db.isSQLite ? "t" : true);
  });
});

describe("Table unique constraint", () => {
  it("should create table", async () => {
    //db.set_sql_logging()
    const table = await Table.create("TableWithUniques");
    const field = await Field.create({
      table,
      name: "name",
      type: "String",
      is_unique: true
    });
    await table.insertRow({ name: "Bill" });
    const ted_id = await table.insertRow({ name: "Ted" });
    const ins_res = await table.tryInsertRow({ name: "Bill" });
    expect(ins_res).toEqual({
      error: "Duplicate value for unique field: name"
    });
    const ins_res1 = await table.tryInsertRow({ name: "Billy" });
    expect(typeof ins_res1.success).toEqual("number");
    const upd_res = await table.tryUpdateRow({ name: "Bill" }, ted_id);
    expect(upd_res).toEqual({
      error: "Duplicate value for unique field: name"
    });
    const upd_res1 = await table.tryUpdateRow({ name: "teddy" }, ted_id);
    expect(upd_res1.success).toEqual(true);
    await field.update({ is_unique: false });
    const field1 = await Field.findOne({ id: field.id });
    expect(field1.is_unique).toBe(false);
    //const bill2_id = await table.insertRow({ name: "Bill" });

    await field1.update({ is_unique: true });
    const field2 = await Field.findOne({ id: field.id });
    expect(field2.is_unique).toBe(true);
    expect(field1.is_unique).toBe(true);
  });
});
describe("Table not null constraint", () => {
  it("should create table", async () => {
    //db.set_sql_logging()
    const table = await Table.create("TableWithNotNulls");
    const field = await Field.create({
      table,
      name: "name",
      type: "String",
      required: true
    });
    await Field.create({
      table,
      name: "age",
      type: "Integer"
    });
    await table.insertRow({ name: "Bill", age: 13 });
    await table.insertRow({ name: "Bill", age: 13 });
    const ins_res = await table.tryInsertRow({ age: 17, name: null });
    expect(!!ins_res.error).toBe(true);
    expect(ins_res.error).toContain("name");
    if (!db.isSQLite) {
      await field.update({ required: false });
      const ted_id = await table.insertRow({ age: 17 });
      await table.deleteRows({ id: ted_id });
      await field.update({ required: true });
      const ins_res1 = await table.tryInsertRow({ age: 167 });
      expect(!!ins_res1.error).toBe(true);
    }
  });
});
