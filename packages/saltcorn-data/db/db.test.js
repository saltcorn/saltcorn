const { sqlsanitize, mkWhere, sqlsanitizeAllowDots } = require("./internal");
const db = require("./index.js");
const Table = require("../models/table");

afterAll(db.close);

describe("sqlsanitize", () => {
  it("should not alter valid name", () => {
    expect(sqlsanitize("ffoo_oo")).toBe("ffoo_oo");
  });
  it("should remove spaces", () => {
    expect(sqlsanitize(" ")).toBe("");
  });
  it("should remove chars from invalid name", () => {
    expect(sqlsanitize("ffoo--oo--uu")).toBe("ffoooouu");
  });
  it("should not allow dots", () => {
    expect(sqlsanitize("ffoo.oo")).toBe("ffoooo");
  });
  it("should allow dots when specified", () => {
    expect(sqlsanitizeAllowDots("ffoo.oo")).toBe("ffoo.oo");
  });
  it("should allow quotes when dots specified", () => {
    expect(sqlsanitizeAllowDots('ffoo."oo"')).toBe('ffoo."oo"');
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
  /*it("should query sql", () => {
    expect(mkWhere({ foo: { sql: "is bar" } })).toStrictEqual({
      values: [],
      where: "where foo is bar",
    });
  });*/
  it("should query json", () => {
    expect(mkWhere({ foo: { json: ["bar", 5] } })).toStrictEqual({
      values: [5],
      where: "where foo->>'bar'=$1",
    });
  });

  it("should set id", () => {
    expect(mkWhere({ id: 5 })).toStrictEqual({
      values: [5],
      where: "where id=$1",
    });
    expect(mkWhere({ id: 5, hello: "world" })).toStrictEqual({
      values: [5, "world"],
      where: "where id=$1 and hello=$2",
    });
  });
  it("should query null", () => {
    expect(mkWhere({ id: null })).toStrictEqual({
      values: [],
      where: "where id is null",
    });
    expect(mkWhere({ id: null, foo: 1 })).toStrictEqual({
      values: [1],
      where: "where id is null and foo=$1",
    });
    expect(mkWhere({ foo: 1, id: null })).toStrictEqual({
      values: [1],
      where: "where foo=$1 and id is null",
    });
  });
  it("should query lt/gt", () => {
    expect(mkWhere({ id: { lt: 5 } })).toStrictEqual({
      values: [5],
      where: "where id<$1",
    });
    expect(mkWhere({ id: { gt: 8 } })).toStrictEqual({
      values: [8],
      where: "where id>$1",
    });
    expect(mkWhere({ id: { lt: 5, equal: true } })).toStrictEqual({
      values: [5],
      where: "where id<=$1",
    });
    expect(mkWhere({ id: { gt: 8, equal: true } })).toStrictEqual({
      values: [8],
      where: "where id>=$1",
    });
    expect(mkWhere({ id: [{ gt: 0 }, { lt: 10 }] })).toStrictEqual({
      values: [0, 10],
      where: "where id>$1 and id<$2",
    });
  });
  it("should query subselect", () => {
    expect(
      mkWhere({
        id: [{ inSelect: { table: "foo", field: "bar", where: { baz: 7 } } }],
      })
    ).toStrictEqual({
      values: [7],
      where: "where id in (select bar from foo where baz=$1)",
    });
    expect(
      mkWhere({
        age: 45,
        id: [{ inSelect: { table: "foo", field: "bar", where: { baz: 7 } } }],
        name: "Alice",
      })
    ).toStrictEqual({
      values: [45, 7, "Alice"],
      where:
        "where age=$1 and id in (select bar from foo where baz=$2) and name=$3",
    });
  });
});

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
