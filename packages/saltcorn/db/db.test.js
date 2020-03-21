const { sqlsanitize, mkWhere } = require("./internal");
const db = require("./index.js");
const Table = require("../models/table");

describe("sqlsanitize", () => {
  it("should not alter valid name", () => {
    expect(sqlsanitize("ffoo_oo")).toBe("ffoo_oo");
  });
  it("should remove chars from invalid name", () => {
    expect(sqlsanitize("ffoo--oo")).toBe("ffoooo");
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
  it("should support in", async done => {
    await Table.create("myothertable");
    const tf = await db.selectOne("tables", {
      name: { in: ["myothertable", "nosuchtable"] }
    });

    expect(tf.name).toStrictEqual("myothertable");
    done();
  });

  it("should support ilike", async done => {
    const tf = await db.selectOne("tables", {
      name: { ilike: "yothertabl" }
    });

    expect(tf.name).toStrictEqual("myothertable");
    done();
  });
});
