const { sqlsanitize, mkWhere } = require("./internal");
const db = require("./index.js");
const Table = require("../models/table");

afterAll(db.close);

describe("sqlsanitize", () => {
  it("should not alter valid name", () => {
    expect(sqlsanitize("ffoo_oo")).toBe("ffoo_oo");
  });
  it("should remove chars from invalid name", () => {
    expect(sqlsanitize("ffoo--oo--uu")).toBe("ffoooouu");
  });
  it("should allow dots", () => {
    expect(sqlsanitize("ffoo.oo")).toBe("ffoo.oo");
  });
  it("should allow numbers", () => {
    expect(sqlsanitize("ff1oo_oo")).toBe("ff1oo_oo");
  });
  it("should not allow numbers in initial position", () => {
    expect(sqlsanitize("1ffoo_o1o")).toBe("_1ffoo_o1o");
  });
});

describe("mkWhere", () => {
  it("should empty on no arg", () => {
    expect(mkWhere()).toStrictEqual({ values: [], where: "" });
  });
  it("should empty on null obj arg", () => {
    expect(mkWhere({})).toStrictEqual({ values: [], where: "" });
  });
  it("should set id", () => {
    expect(mkWhere({ id: 5 })).toStrictEqual({
      values: [5],
      where: "where id=$1"
    });
  });
});

describe("where", () => {
  it("should support in", async () => {
    await Table.create("myothertable");
    const tf = await db.selectOne("_sc_tables", {
      name: { in: ["myothertable", "nosuchtable"] }
    });

    expect(tf.name).toStrictEqual("myothertable");
  });

  it("should support ilike", async () => {
    const tf = await db.selectOne("_sc_tables", {
      name: { ilike: "yothertabl" }
    });

    expect(tf.name).toStrictEqual("myothertable");
  });

  it("should  count", async () => {
    const tbls = await db.count("tables", {
      name: { ilike: "yothertabl" }
    });

    expect(tbls).toStrictEqual(1);
  });
});
