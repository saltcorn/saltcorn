const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");
const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const fs = require("fs").promises;
const { rick_file } = require("./mocks");
const { mockReqRes } = require("./mocks");

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
jest.setTimeout(30000);

describe("TableIO", () => {
  it("should store attributes", async () => {
    const tc = await Table.create("mytesttable");
    await Field.create({
      table: tc,
      name: "foo_height1",
      label: "height1",
      type: "Integer",
      attributes: { max: 18 },
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
    const tc = await Table.create("mytable1");
    const tf = await Table.findOne({ id: tc.id });

    expect(tf.name).toStrictEqual("mytable1");
    expect(tf.sql_name).toStrictEqual(
      db.isSQLite ? '"mytable1"' : '"public"."mytable1"'
    );
  });
  it("toggle bools", async () => {
    const tc = await Table.create("mytable17");

    await Field.create({
      table: tc,
      label: "Group",
      type: "Bool",
      required: true,
    });
    const tall_id = await tc.insertRow({ group: true });
    await tc.toggleBool(tall_id, "group");
    const row = await tc.getRow({ id: tall_id });
    expect(row.group).toBe(false);
  });
  it("should create required field in empty table without default", async () => {
    const mytable1 = await Table.findOne({ name: "mytable1" });
    await Field.create({
      table: mytable1,
      name: "height1",
      label: "height1",
      type: "Integer",
      required: true,
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
      where: { name: "Michael Douglas" },
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
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaels.length).toStrictEqual(1);
    expect(michaels[0].pages).toBe(728);
    expect(michaels[0].author).toBe("Leo Tolstoy");
  });
  it("should get joined rows with limit and order", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id",
    });
    expect(all.length).toStrictEqual(2);
    expect(all[1].favbook).toBe(2);
  });
  it("should get joined rows with limit and desc order", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const all = await patients.getJoinedRows({
      limit: 2,
      orderBy: "id",
      orderDesc: true,
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
          aggregate: "avg",
        },
      },
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
          aggregate: "avg",
        },
      },
      joinFields: {
        pages: { ref: "favbook", target: "pages" },
        author: { ref: "favbook", target: "author" },
      },
    });
    expect(michaels.length).toStrictEqual(2);
    expect(Math.round(michaels[0].avg_temp)).toBe(38);
    expect(michaels[1].author).toBe("Leo Tolstoy");
  });

  it("should support full text search", async () => {
    const table = await Table.findOne({ name: "patients" });
    const fields = await table.getFields();
    const rows = await db.select("patients", {
      _fts: { fields, searchTerm: "Douglas" },
    });

    expect(rows.length).toBe(2);
  });
  it("should enable versioning", async () => {
    const table = await Table.findOne({ name: "patients" });
    table.versioned = true;
    await table.update(table);
  });
  it("should save version on insert", async () => {
    const table = await Table.findOne({ name: "patients" });

    await table.insertRow({ name: "Bunny foo-foo", favbook: 1 });
    const bunnyFooFoo = await table.getRow({ name: "Bunny foo-foo" });
    const history1 = await table.get_history(bunnyFooFoo.id);
    expect(history1.length).toBe(1);
    expect(history1[0].id).toBe(bunnyFooFoo.id);
    expect(history1[0]._version).toBe(1);
    expect(history1[0].name).toBe("Bunny foo-foo");
  });
  it("should save version on update", async () => {
    const table = await Table.findOne({ name: "patients" });

    const bunnyFooFoo = await table.getRow({ name: "Bunny foo-foo" });

    await table.updateRow({ name: "Goon" }, bunnyFooFoo.id);
    const history2 = await table.get_history(bunnyFooFoo.id);
    expect(history2.length).toBe(2);
    expect(history2[0].id).toBe(bunnyFooFoo.id);
    expect(history2[0]._version).toBe(1);
    expect(history2[0].name).toBe("Bunny foo-foo");
    expect(history2[0].favbook).toBe(1);
    expect(history2[1].id).toBe(bunnyFooFoo.id);
    expect(history2[1]._version).toBe(2);
    expect(history2[1].name).toBe("Goon");
    expect(history2[1].favbook).toBe(1);
    const goon = await table.getRow({ id: bunnyFooFoo.id });
    expect(goon.name).toBe("Goon");
    expect(goon.favbook).toBe(1);
  });
  it("create field on version table", async () => {
    const table = await Table.findOne({ name: "patients" });

    const fc = await Field.create({
      table: table,
      name: "Height19",
      label: "height19",
      type: "Integer",
      required: true,
      attributes: { default: 6 },
    });
    await fc.delete();
  });
  it("should disable versioning", async () => {
    const table = await Table.findOne({ name: "patients" });
    await table.getFields();
    await table.update({ versioned: false });
  });
});

describe("relations", () => {
  it("get parent relations", async () => {
    const table = await Table.findOne({ name: "patients" });
    const rels = await table.get_parent_relations();
    expect(rels.parent_field_list).toContain("favbook.author");
    expect(rels.parent_relations.length).toBe(2);
  });
  it("get parent relations", async () => {
    const table = await Table.findOne({ name: "books" });
    const rels = await table.get_child_relations();
    expect(rels.child_field_list).toEqual(["patients.favbook"]);
    expect(rels.child_relations.length).toBe(1);
  });
});

describe("CSV import", () => {
  it("should import into existing table", async () => {
    const csv = `author,Pages
Joe Celko, 856
Gordon Kane, 217`;
    const fnm = "/tmp/test1.csv";
    await fs.writeFile(fnm, csv);
    const table = await Table.findOne({ name: "books" });
    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({ success: "Imported 2 rows into table books" });
    const rows = await table.getRows({ author: "Gordon Kane" });
    expect(rows.length).toBe(1);
    expect(rows[0].pages).toBe(217);
  });
  it("fail on required field", async () => {
    const csv = `author,Pagez
Joe Celko, 856
Gordon Kane, 217`;
    const fnm = "/tmp/test1f.csv";
    await fs.writeFile(fnm, csv);
    const table = await Table.findOne({ name: "books" });
    expect(!!table).toBe(true);
    const impres = await table.import_csv_file(fnm);
    expect(impres).toEqual({ error: "Required field missing: Pages" });
  });
  it("should create by importing", async () => {
    const csv = `item,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const { table } = await Table.create_from_csv("Invoice", fnm);
    const fields = await table.getFields();
    const vatField = fields.find((f) => f.name === "vatable");
    expect(vatField.type.name).toBe("Bool");
    const costField = fields.find((f) => f.name === "cost");
    expect(costField.type.name).toBe("Float");
    const countField = fields.find((f) => f.name === "count");
    expect(countField.type.name).toBe("Integer");
    const rows = await table.getRows({ item: "Pencil" });
    expect(rows.length).toBe(1);
    expect(rows[0].vatable).toBe(true);
  });
  it("should fail on bad col nm", async () => {
    const csv = `item,cost,!, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice1", fnm);
    expect(res).toEqual({
      error: "Invalid column name ! - Use A-Z, a-z, 0-9, _ only",
    });
    const table = await Table.findOne({ name: "Invoice1" });
    expect(table).toBe(null);
  });
  it("ignores a col on duplicate col nm", async () => {
    const csv = `item,cost,cost, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice1", fnm);
    expect(res.table.fields.length).toEqual(3);
  });
  it("should fail non-int id", async () => {
    const csv = `id,cost,!, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice2", fnm);
    expect(res).toEqual({
      error: `Columns named "id" must have only integers`,
    });
    const table = await Table.findOne({ name: "Invoice2" });
    expect(table).toBe(null);
  });
  it("should fail missing id", async () => {
    const csv = `id,cost,!, vatable
1, 5,4, f
, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice3", fnm);
    expect(res).toEqual({
      error: `Columns named "id" must not have missing values`,
    });
    const table = await Table.findOne({ name: "Invoice3" });
    expect(table).toBe(null);
  });
  it("should succeed on good id", async () => {
    const csv = `id,cost,count, vatable
1, 5,4, f
2, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice3", fnm);
    expect(res.table.fields.length).toEqual(3);
    const table = await Table.findOne({ name: "Invoice3" });
    const rows = await table.getRows();
    expect(rows.length).toBe(2);
    await table.insertRow({ cost: 0.2, count: 1, vatable: true });
    const rows3 = await table.getRows();
    expect(rows3.length).toBe(3);
  });
  it("should fail on repeat id", async () => {
    const csv = `id,cost,count, vatable
1, 5,4, f
1, 0.5,2, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const res = await Table.create_from_csv("Invoice4", fnm);
    expect(res.error).toContain("Invoice4");
    const table = await Table.findOne({ name: "Invoice4" });
    expect(table).toBe(null);
  });
  it("should import with missing", async () => {
    const csv = `item,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,, t`;
    const fnm = "/tmp/test2.csv";
    await fs.writeFile(fnm, csv);
    const { table, error } = await Table.create_from_csv("InvoiceMissing", fnm);
    expect(error).toBe(undefined);
    expect(!!table).toBe(true);
    const fields = await table.getFields();
    const countField = fields.find((f) => f.name === "count");
    expect(countField.type.name).toBe("Integer");
    expect(countField.required).toBe(false);
    const rows = await table.getRows({ item: "Pencil" });
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(null);
    const brows = await table.getRows({ item: "Book" });
    expect(brows[0].count).toBe(4);
  });
});

describe("Table field uppercase", () => {
  it("should create by importing", async () => {
    const csv = `Item,cost,Count,Vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const fnm = "/tmp/test_uc.csv";
    await fs.writeFile(fnm, csv);
    const { table } = await Table.create_from_csv("InvoiceUC", fnm);
    const fields = await table.getFields();
    const rows1 = await table.getJoinedRows({
      where: { item: { ilike: "East" } },
    });
    expect(rows1.length).toBe(0);
    const rows2 = await table.getJoinedRows({
      where: { count: 2 },
    });
    expect(rows2.length).toBe(1);
    const rows3 = await table.getJoinedRows({
      where: { _fts: { searchTerm: "Book", fields } },
    });
    expect(rows3.length).toBe(1);
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
      is_unique: true,
    });
    await table.insertRow({ name: "Bill" });
    const ted_id = await table.insertRow({ name: "Ted" });
    const ins_res = await table.tryInsertRow({ name: "Bill" });
    expect(ins_res).toEqual({
      error: "Duplicate value for unique field: name",
    });
    const ins_res1 = await table.tryInsertRow({ name: "Billy" });
    expect(typeof ins_res1.success).toEqual("number");
    const upd_res = await table.tryUpdateRow({ name: "Bill" }, ted_id);
    expect(upd_res).toEqual({
      error: "Duplicate value for unique field: name",
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
      required: true,
    });
    await Field.create({
      table,
      name: "age",
      type: "Integer",
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
  it("should query null", async () => {
    const table = await Table.findOne({ name: "TableWithNotNulls" });
    await table.insertRow({ name: "Ageless", age: null });

    const rows = await table.getRows({ age: null });
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Ageless");
    const rows1 = await table.getRows({ age: null, name: "Ageless" });
    expect(rows1.length).toBe(1);
    expect(rows1[0].name).toBe("Ageless");
    const rows2 = await table.getRows({ name: "Ageless", age: null });
    expect(rows2.length).toBe(1);
    expect(rows2[0].name).toBe("Ageless");
  });
});
describe("Table with users and files", () => {
  it("should create table", async () => {
    //db.set_sql_logging()
    const rick = await rick_file();
    const table = await Table.create("TableWithUsers");
    await Field.create({
      table,
      name: "name",
      type: "String",
      is_unique: true,
    });
    await Field.create({
      table,
      name: "owner",
      type: "Key to users",
    });
    await Field.create({
      table,
      name: "mugshot",
      type: "File",
    });
    await table.insertRow({ name: "Rocket", owner: 1, mugshot: rick.id });
    const rels = await table.get_parent_relations();
    expect(rels.parent_field_list).toEqual(["owner.email"]);
    const joined = await table.getJoinedRows();
    // expect(joined).toEqual("rick.png")
    expect(joined[0].mugshot__filename).toEqual("rick.png");
  });
});

describe("Table and view deletion ", () => {
  it("should setup", async () => {
    const tc = await Table.create("mytable19");
    await Field.create({
      table: tc,
      name: "name",
      type: "String",
      is_unique: true,
    });
    const v = await View.create({
      table_id: tc.id,
      name: "anewview",
      viewtemplate: "List",
      configuration: { columns: [], default_state: {} },
      min_role: 10,
      on_root_page: true,
    });
    let error;
    try {
      await tc.delete();
    } catch (e) {
      error = e;
    }
    //expect(error).toBeInstanceOf(Error); - not on SQLite
    await v.delete();
  });
  it("should delete table after view delete", async () => {
    const tc = await Table.findOne({ name: "mytable19" });
    if (tc) await tc.delete();
  });
});

describe("Table with date", () => {
  it("should create table", async () => {
    //db.set_sql_logging()
    const table = await Table.create("TableWithDates");
    await Field.create({
      table,
      name: "time",
      type: "Date",
    });
    await table.insertRow({ time: new Date() });
    const rows = await table.getRows();
    var dif = new Date(rows[0].time).getTime() - new Date().getTime();

    expect(Math.abs(dif)).toBeLessThanOrEqual(1000);
  });
});
describe("Tables with name clashes", () => {
  it("should create tables", async () => {
    //db.set_sql_logging()
    const cars = await Table.create("TableClashCar");
    const persons = await Table.create("TableClashPerson");
    await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: cars,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: cars,
      name: "owner",
      type: "Key to TableClashPerson",
    });
    const sally = await persons.insertRow({ name: "Sally" });
    await cars.insertRow({ name: "Mustang", owner: sally });
  });
  it("should query", async () => {
    const cars = await Table.findOne({ name: "TableClashCar" });

    const rows = await cars.getJoinedRows({
      joinFields: {
        owner_name: { ref: "owner", target: "name" },
      },
    });
    expect(rows[0]).toEqual({
      id: 1,
      name: "Mustang",
      owner: 1,
      owner_name: "Sally",
    });
  });

  it("should show list view", async () => {
    const cars = await Table.findOne({ name: "TableClashCar" });
    const v = await View.create({
      table_id: cars.id,
      name: "patientlist",
      viewtemplate: "List",
      configuration: {
        columns: [
          { type: "Field", field_name: "name" },
          { type: "JoinField", join_field: "owner.name" },
        ],
      },
      min_role: 10,
      on_root_page: true,
    });
    const res = await v.run({}, mockReqRes);
    expect(res).toContain("Mustang");
    expect(res).toContain("Sally");
  });
  it("should show show view", async () => {
    const cars = await Table.findOne({ name: "TableClashCar" });
    const v = await View.create({
      table_id: cars.id,
      name: "patientlist",
      viewtemplate: "Show",
      configuration: {
        columns: [
          { type: "Field", field_name: "name" },
          { type: "JoinField", join_field: "owner.name" },
        ],
        layout: {
          above: [
            { type: "field", fieldview: "show", field_name: "name" },
            { type: "join_field", join_field: "owner.name" },
          ],
        },
      },
      min_role: 10,
      on_root_page: true,
    });
    const res = await v.run({ id: 1 }, mockReqRes);
    expect(res).toContain("Mustang");
    expect(res).toContain("Sally");
  });
});
