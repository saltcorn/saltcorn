const { sqlsanitize, mkWhere } = require("./internal");
const Table = require("./table");

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

describe("Table", () => {
  it("should create", async done => {
    expect.assertions(1);
    const tc = await Table.create("mytable");
    const tf = await Table.find({ id: tc.id });

    expect(tf.name).toStrictEqual("mytable");
    done();
  });
});
