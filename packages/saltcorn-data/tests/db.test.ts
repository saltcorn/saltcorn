import db from "../db";
const Table = require("../models/table");

afterAll(db.close);

describe("where", () => {
  it("should support in", async () => {
    await Table.create("myothertable");
    if (!db.isSQLite) {
      const tf = await db.selectOne("_sc_tables", {
        name: { in: ["myothertable", "nosuchtable"] },
      });

      expect(tf.name).toStrictEqual("myothertable");
    }
  });

  it("should support ilike", async () => {
    const tf = await db.selectOne("_sc_tables", {
      name: { ilike: "yothertabl" },
    });

    expect(tf.name).toStrictEqual("myothertable");
  });

  it("should  count", async () => {
    const tbls = await db.count("_sc_tables", {
      name: { ilike: "yothertabl" },
    });

    expect(tbls).toStrictEqual(1);
  });
});
