const { discoverable_tables, discover_tables } = require("../models/discovery");
const { getState } = require("../db/state");
const db = require("../db");

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
jest.setTimeout(30000);

describe("Table Discovery", () => {
  it("should create tables", async () => {
    await db.query(
      `create table discperson(id serial primary key, name text, age integer not null);`
    );
  });
  it("should list tables", async () => {
    const tbls = await discoverable_tables();
    expect(tbls.map((t) => t.table_name)).toStrictEqual(["discperson"]);
  });
  it("should make pack", async () => {
    const pack = await discover_tables(["discperson"]);
    expect(pack).toStrictEqual({
      tables: [
        {
          fields: [
            {
              label: "id",
              name: "id",
              required: true,
              type: "Integer",
              primary_key: true,
            },
            { label: "name", name: "name", required: false, type: "String" },
            { label: "age", name: "age", required: true, type: "Integer" },
          ],
          name: "discperson",
        },
      ],
    });
  });
});
