const Table = require("../models/table");
const Field = require("../models/field");
const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);

describe("Field", () => {
  it("should add and then delete required field", async () => {
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
    expect(f.toJson.name).toBe("Height1");
    expect(f.listKey).toBe("Height1");
    expect(f.presets).toBe(null);
    await f.delete();
    const fs = await Field.find({ name: "Height1" });
    expect(fs.length).toBe(0);
  });
  it("should add and then delete nonrequired field", async () => {
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
  });
  it("creates file field", async () => {
    const patients = await Table.findOne({ name: "patients" });
    const fc = await Field.create({
      table: patients,
      name: "pic",
      label: "pic",
      type: "File",
      required: false
    });
    expect(fc.reftable_name).toBe("_sc_files");
  });
  it("fills fkey options", async () => {
    const f = await Field.findOne({ name: "favbook" });
    await f.fill_fkey_options();
    expect(f.options).toContainEqual({ label: "Leo Tolstoy", value: 2 });
    if (db.isSQLite) expect(f.sql_type).toBe('int references "books" (id)');
    else expect(f.sql_type).toBe('int references "public"."books" (id)');

    expect(f.is_fkey).toBe(true);
    expect(f.sql_bare_type).toBe("int");
  });
});
