const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
  sqlsanitizeAllowDots,
  sqlFun,
  sqlBinOp,
} = require("./internal");

const someday = new Date("2019-11-11T10:34:00.000Z");

describe("mkWhere", () => {
  it("should empty on no arg", () => {
    assert.deepStrictEqual(mkWhere(), { values: [], where: "" });
  });
  it("should empty on null obj arg", () => {
    assert.deepStrictEqual(mkWhere({}), { values: [], where: "" });
  });
  it("should query json", () => {
    assert.deepStrictEqual(mkWhere({ foo: { json: ["bar", 5] } }), {
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar'))->>0=$1`,
    });
  });
  it("should query json deeply", () => {
    assert.deepStrictEqual(mkWhere({ foo: { json: [["bar", 2], 5] } }), {
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar[2]'))->>0=$1`,
    });
  });
  it("should query json with object syntax", () => {
    assert.deepStrictEqual(mkWhere({ foo: { json: { bar: 5 } } }), {
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar'))->>0=$1`,
    });
  });
  it("should query json path", () => {
    assert.deepStrictEqual(mkWhere({ foo: { json: { "$.bar[2]": 5 } } }), {
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar[2]'))->>0=$1`,
    });
  });
  it("should query json escapes", () => {
    assert.deepStrictEqual(mkWhere({ foo: { json: { "bar.baz": 5 } } }), {
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$."bar.baz"'))->>0=$1`,
    });
  });
  it("should query json approx", () => {
    assert.deepStrictEqual(
      mkWhere({ foo: { json: { bar: { ilike: "baz" } } } }),
      {
        values: ["baz"],
        where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar'))->>0 ILIKE '%' || $1 || '%'`,
      }
    );
  });
  it("should query json gte", () => {
    assert.deepStrictEqual(mkWhere({ foo: { json: { bar: { gte: 6 } } } }), {
      values: [6],
      where: `where jsonb_path_query_first(\"foo\", '$.bar') >= $1`,
    });
  });
  it("should query json gte and lte", () => {
    assert.deepStrictEqual(
      mkWhere({ foo: { json: { bar: { gte: 6, lte: 1 } } } }),
      {
        values: [6, 1],
        where: `where jsonb_path_query_first(\"foo\", '$.bar') >= $1 and jsonb_path_query_first(\"foo\", '$.bar') <= $2`,
      }
    );
  });
  it("should not sql inject in json", () => {
    assert.deepStrictEqual(
      mkWhere({ "Robert'); DROP TABLE Students; --": { json: ["bar", 5] } }),
      {
        values: [5],
        where: `where jsonb_build_array(jsonb_path_query_first(\"RobertDROPTABLEStudents\", '$.bar'))->>0=$1`,
      }
    );
    assert.deepStrictEqual(
      mkWhere({ foo: { json: ["Robert'); DROP TABLE Students; --", 5] } }),
      {
        values: [5],
        where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.\"Robert''); DROP TABLE Students; --\"'))->>0=$1`,
      }
    );
    assert.deepStrictEqual(
      mkWhere({ foo: { json: ['Robert"); DROP TABLE Students; --', 5] } }),
      {
        values: [5],
        where:
          'where jsonb_build_array(jsonb_path_query_first("foo", \'$."Robert\\"); DROP TABLE Students; --"\'))->>0=$1',
      }
    );
  });

  it("should set id", () => {
    assert.deepStrictEqual(mkWhere({ id: 5 }), {
      values: [5],
      where: 'where "id"=$1',
    });
    assert.deepStrictEqual(mkWhere({ id: 5, hello: "world" }), {
      values: [5, "world"],
      where: 'where "id"=$1 and "hello"=$2',
    });
  });
  it("should read eq", () => {
    assert.deepStrictEqual(mkWhere({ eq: [Symbol("id"), 5] }), {
      values: [5],
      where: 'where "id"=$1',
    });
    assert.deepStrictEqual(mkWhere({ eq: [Symbol("id"), null] }), {
      values: [],
      where: 'where "id" is null',
    });
    assert.deepStrictEqual(mkWhere({ eq: ["id", null] }), {
      values: ["id"],
      where: "where $1::text is null",
    });
    assert.deepStrictEqual(mkWhere({ eq: [4, 5] }), {
      values: [4, 5],
      where: "where $1=$2",
    });
    assert.deepStrictEqual(mkWhere({ eq: [null, 5] }), {
      values: [5],
      where: "where $1 is null",
    });
    assert.deepStrictEqual(mkWhere({ not: { eq: [Symbol("id"), 5] } }), {
      values: [5],
      where: 'where not ("id"=$1)',
    });
  });
  it("should query null", () => {
    assert.deepStrictEqual(mkWhere({ id: null }), {
      values: [],
      where: 'where "id" is null',
    });
    assert.deepStrictEqual(mkWhere({ id: null, foo: 1 }), {
      values: [1],
      where: 'where "id" is null and "foo"=$1',
    });
    assert.deepStrictEqual(mkWhere({ foo: 1, id: null }), {
      values: [1],
      where: 'where "foo"=$1 and "id" is null',
    });
  });
  it("should query not null", () => {
    assert.deepStrictEqual(mkWhere({ not: { id: null, x: null } }), {
      values: [],
      where: 'where not ("id" is null and "x" is null)',
    });
    assert.deepStrictEqual(
      mkWhere({ and: [{ not: { id: null } }, { not: { x: null } }] }),
      {
        values: [],
        where: 'where (not ("id" is null) and not ("x" is null))',
      }
    );
    assert.deepStrictEqual(mkWhere({ not: { id: null } }), {
      values: [],
      where: 'where not ("id" is null)',
    });
    assert.deepStrictEqual(mkWhere({ not: { id: null }, x: 5 }), {
      values: [5],
      where: 'where not ("id" is null) and "x"=$1',
    });
  });
  it("should query not true", () => {
    assert.deepStrictEqual(mkWhere({ not: { foo: true } }), {
      values: [true],
      where: 'where not ("foo"=$1)',
    });
    assert.deepStrictEqual(mkWhere({ not: { foo: true, bar: false } }), {
      values: [true, false],
      where: 'where not ("foo"=$1 and "bar"=$2)',
    });
  });
  it("should query lt/gt", () => {
    assert.deepStrictEqual(mkWhere({ id: { lt: 5 } }), {
      values: [5],
      where: 'where "id"<$1',
    });
    assert.deepStrictEqual(mkWhere({ id: { gt: 8 } }), {
      values: [8],
      where: 'where "id">$1',
    });
    assert.deepStrictEqual(mkWhere({ id: { gt: 8, lt: 15 } }), {
      values: [8, 15],
      where: 'where "id">$1 and "id"<$2',
    });
    assert.deepStrictEqual(mkWhere({ id: { gt: 8, lt: 15, equal: true } }), {
      values: [8, 15],
      where: 'where "id">=$1 and "id"<=$2',
    });
    assert.deepStrictEqual(mkWhere({ id: { lt: 5, equal: true } }), {
      values: [5],
      where: 'where "id"<=$1',
    });
    assert.deepStrictEqual(mkWhere({ id: { gt: 8, equal: true } }), {
      values: [8],
      where: 'where "id">=$1',
    });
    assert.deepStrictEqual(mkWhere({ id: [{ gt: 0 }, { lt: 10 }] }), {
      values: [0, 10],
      where: 'where "id">$1 and "id"<$2',
    });
    assert.deepStrictEqual(mkWhere({ id: { or: [{ gt: 10 }, { lt: 5 }] } }), {
      values: [10, 5],
      where: 'where ("id">$1 or "id"<$2)',
    });
  });
  it("should query days", () => {
    assert.deepStrictEqual(
      mkWhere({ theday: { gt: someday, day_only: true } }),
      {
        values: [someday],
        where: 'where "theday"::date>$1::date',
      }
    );
  });

  it("should query ilike", () => {
    assert.deepStrictEqual(mkWhere({ name: { ilike: "imon" } }), {
      values: ["imon"],
      where: `where "name" ILIKE '%' || $1 || '%'`,
    });
    assert.deepStrictEqual(
      mkWhere({ name: { ilike: "Simon", fullMatch: true } }),
      {
        values: ["Simon"],
        where: `where "name" ILIKE $1`,
      }
    );
  });
  it("should query ilike on sqlite", () => {
    assert.deepStrictEqual(mkWhere({ name: { ilike: "imon" } }, true), {
      values: ["imon"],
      where: `where "name" LIKE '%' || ? || '%'`,
    });
  });

  it("should query string as regexp", () => {
    assert.deepStrictEqual(mkWhere({ name: /imon/ }), {
      values: ["imon"],
      where: `where "name" ~ $1`,
    });
  });

  it("should query regexp on sqlite", () => {
    assert.deepStrictEqual(mkWhere({ name: /imon/ }, true), {
      values: ["imon"],
      where: `where "name" REGEXP ?`,
    });
  });

  it("should query FTS", () => {
    const fld = (name) => ({
      name,
      type: { sql_name: "text" },
    });
    assert.deepStrictEqual(
      mkWhere({
        _fts: {
          fields: [fld("name"), fld("description")],
          searchTerm: "foo bar",
        },
      }),
      {
        values: ["foo bar"],
        where: `where to_tsvector('english', coalesce("description",'') || ' ' || coalesce("name",'')) @@ plainto_tsquery('english', $1)`,
      }
    );
    assert.deepStrictEqual(
      mkWhere({
        _fts: { fields: [fld("name"), fld("description")], searchTerm: "foo" },
      }),
      {
        values: ["foo:*"],
        where: `where to_tsvector('english', coalesce("description",'') || ' ' || coalesce("name",'')) @@ to_tsquery('english', $1)`,
      }
    );
    assert.deepStrictEqual(
      mkWhere(
        {
          _fts: {
            fields: [fld("name"), fld("description")],
            searchTerm: "foo",
          },
        },
        true
      ),
      {
        values: ["foo"],
        where: `where coalesce("description",'') || ' ' || coalesce("name",'') LIKE '%' || ? || '%'`,
      }
    );
  });
  it("should query subselect", () => {
    assert.deepStrictEqual(
      mkWhere({
        id: [{ inSelect: { table: "foo", field: "bar", where: { baz: 7 } } }],
      }),
      {
        values: [7],
        where: 'where "id" in (select "bar" from "foo" where "baz"=$1)',
      }
    );
    //sanitizes table name
    assert.deepStrictEqual(
      mkWhere({
        id: [
          { inSelect: { table: "foo-bar", field: "bar", where: { baz: 7 } } },
        ],
      }),
      {
        values: [7],
        where: 'where "id" in (select "bar" from "foobar" where "baz"=$1)',
      }
    );
    assert.deepStrictEqual(
      mkWhere({
        id: [{ inSelect: { table: "foo", field: "bar", where: { baz: 7 } } }],
      }),
      {
        values: [7],
        where: 'where "id" in (select "bar" from "foo" where "baz"=$1)',
      }
    );
    assert.deepStrictEqual(
      mkWhere({
        id: [
          {
            inSelect: {
              table: "foo",
              field: "bar",
              tenant: "sub1",
              where: { baz: 7 },
            },
          },
        ],
      }),
      {
        values: [7],
        where: 'where "id" in (select "bar" from "sub1"."foo" where "baz"=$1)',
      }
    );
    assert.deepStrictEqual(
      mkWhere({
        id: [
          {
            inSelect: {
              table: "foo",
              field: "bar",
              tenant: "sub1",
              valField: "id",
              through: "baz",
              where: { baz: 7 },
            },
          },
        ],
      }),
      {
        values: [7],
        where:
          'where "id" in (select ss1."id" from "sub1"."foo" ss1 join "sub1"."baz" ss2 on ss2."id" = ss1."bar" where "ss2"."baz"=$1)',
      }
    );
    //where "id" in (select foo."iz" from "foo" join "bazzy"  on bazzy."id" = foo."bar" where "ss2"."baz"=$1)
    assert.deepStrictEqual(
      mkWhere({
        id: [
          {
            inSelect: {
              table: "foo",
              field: "bar",
              tenant: "sub1",
              valField: "iz",
              through: "bazzy",
              where: { baz: 7 },
            },
          },
        ],
      }),
      {
        values: [7],
        where:
          'where "id" in (select ss1."iz" from "sub1"."foo" ss1 join "sub1"."bazzy" ss2 on ss2."id" = ss1."bar" where "ss2"."baz"=$1)',
      }
    );

    assert.deepStrictEqual(
      mkWhere({
        age: 45,
        id: [{ inSelect: { table: "foo", field: "bar", where: { baz: 7 } } }],
        name: "Alice",
      }),
      {
        values: [45, 7, "Alice"],
        where: `where "age"=$1 and "id" in (select "bar" from "foo" where "baz"=$2) and "name"=$3`,
      }
    );
  });
  it("should query or", () => {
    assert.deepStrictEqual(mkWhere({ or: [{ id: 5 }, { x: 7 }] }), {
      values: [5, 7],
      where: 'where ("id"=$1 or "x"=$2)',
    });
    assert.deepStrictEqual(mkWhere({ or: [{ id: 5 }, { x: { gt: 7 } }] }), {
      values: [5, 7],
      where: 'where ("id"=$1 or "x">$2)',
    });
    assert.deepStrictEqual(
      mkWhere({ or: [{ id: 5 }, { x: [{ gt: 7 }, { lt: 12 }] }] }),
      {
        values: [5, 7, 12],
        where: 'where ("id"=$1 or "x">$2 and "x"<$3)',
      }
    );
    assert.deepStrictEqual(
      mkWhere({ y: 6, or: [{ id: 5 }, { x: [{ gt: 7 }, { lt: 12 }] }] }),
      {
        values: [6, 5, 7, 12],
        where: 'where "y"=$1 and ("id"=$2 or "x">$3 and "x"<$4)',
      }
    );
    assert.deepStrictEqual(mkWhere({ or: [{ id: 5 }, { x: 7, y: 8 }] }), {
      values: [5, 7, 8],
      where: 'where ("id"=$1 or "x"=$2 and "y"=$3)',
    });
    assert.deepStrictEqual(mkWhere({ not: { id: 5 } }), {
      values: [5],
      where: 'where not ("id"=$1)',
    });
    assert.deepStrictEqual(mkWhere({ not: { id: 5, y: 1 } }), {
      values: [5, 1],
      where: 'where not ("id"=$1 and "y"=$2)',
    });
    assert.deepStrictEqual(mkWhere({ not: { y: { in: [1, 2, 3] } } }), {
      values: [[1, 2, 3]],
      where: 'where not ("y" = ANY ($1))',
    });
    assert.deepStrictEqual(mkWhere({ y: { not: { in: [1, 2, 3] } } }), {
      values: [[1, 2, 3]],
      where: 'where not ("y" = ANY ($1))',
    });
    assert.deepStrictEqual(mkWhere({ y: { in: [1, 2, 3] } }), {
      values: [[1, 2, 3]],
      where: 'where "y" = ANY ($1)',
    });
    assert.deepStrictEqual(mkWhere({ not: { y: { in: [1, 2, 3] } } }, true), {
      values: [1, 2, 3],
      where: 'where not ("y" IN (?, ?, ?))',
    });
    assert.deepStrictEqual(mkWhere({ y: { not: { in: [1, 2, 3] } } }, true), {
      values: [1, 2, 3],
      where: 'where not ("y" IN (?, ?, ?))',
    });
    assert.deepStrictEqual(mkWhere({ y: { in: [1, 2, 3] } }, true), {
      values: [1, 2, 3],
      where: 'where "y" IN (?, ?, ?)',
    });
    assert.deepStrictEqual(
      mkWhere({
        or: [
          { not: { eq: ["1", null] } },
          { not: { eq: [null, null] }, married_to: null },
        ],
      }),
      {
        values: ["1"],
        where:
          'where (not ($1::text is null) or not (null is null) and "married_to" is null)',
      }
    );
    /*

    assert.deepStrictEqual(mkWhere([{ id: 5 }, { x: 7 }]), {
      values: [5, 7],
      where: 'where "id"=$1 and "x"=$2',
    });
    assert.deepStrictEqual(mkWhere([{ or: [{ id: 5 }, { x: 7 }] }, { z: 9 }]), {
      values: [5, 7, 9],
      where: 'where ("id"=$1 or "x"=$2) and "z"=$3',
    });*/
  });
  it("should query and", () => {
    assert.deepStrictEqual(mkWhere({ and: [{ id: 5 }, { x: 7 }] }), {
      values: [5, 7],
      where: 'where ("id"=$1 and "x"=$2)',
    });
    assert.deepStrictEqual(
      mkWhere({
        and: [
          { or: [{ bar: "Zoo" }, { bar: "Baz" }] },
          { or: [{ foo: false }, { foo: null }] },
        ],
      }),
      {
        values: ["Zoo", "Baz", false],
        where: 'where (("bar"=$1 or "bar"=$2) and ("foo"=$3 or "foo" is null))',
      }
    );
  });
  it("should false", () => {
    assert.deepStrictEqual(mkWhere({ _false: true }), {
      values: [],
      where: "where FALSE",
    });
  });
  it("equate strings", () => {
    assert.deepStrictEqual(mkWhere({ eq: ["ALL", "ALL"] }), {
      values: ["ALL", "ALL"],
      where: "where $1::text=$2::text",
    });
  });
  it("equate strings in or", () => {
    assert.deepStrictEqual(
      mkWhere({ or: [{ eq: ["ALL", Symbol("name")] }, { eq: ["ALL", "ALL"] }] }),
      {
        values: ["ALL", "ALL", "ALL"],
        where: 'where ($1::text="name" or $2::text=$3::text)',
      }
    );
  });
});

describe("sqlsanitize", () => {
  it("should not alter valid name", () => {
    assert.strictEqual(sqlsanitize("ffoo_oo"), "ffoo_oo");
  });
  it("should not alter valid symbol", () => {
    assert.strictEqual(sqlsanitize(Symbol("ffoo_oo")), "ffoo_oo");
  });
  it("should remove spaces", () => {
    assert.strictEqual(sqlsanitize(" "), "");
  });
  it("should remove chars from invalid name", () => {
    assert.strictEqual(sqlsanitize("ffoo--oo--uu"), "ffoooouu");
    assert.strictEqual(sqlsanitize("ffoo--oo;-uu"), "ffoooouu");
    assert.strictEqual(sqlsanitize('ffoo-"oo--uu'), "ffoooouu");
    assert.strictEqual(sqlsanitize('ffoo-"oo-"uu'), "ffoooouu");
  });
  it("should remove chars from invalid symbol", () => {
    assert.strictEqual(sqlsanitize(Symbol("ffoo--oo--uu")), "ffoooouu");
  });
  it("should not allow dots", () => {
    assert.strictEqual(sqlsanitize("ffoo.oo"), "ffoooo");
  });
  it("should allow dots when specified", () => {
    assert.strictEqual(sqlsanitizeAllowDots("ffoo.oo"), "ffoo.oo");
  });
  it("should allow quotes when dots specified", () => {
    assert.strictEqual(sqlsanitizeAllowDots('ffoo."oo"'), 'ffoo."oo"');
  });
  it("should allow numbers", () => {
    assert.strictEqual(sqlsanitize("ff1oo_oo"), "ff1oo_oo");
  });
  it("should not allow numbers in initial position", () => {
    assert.strictEqual(sqlsanitize("1ffoo_o1o"), "_1ffoo_o1o");
  });
});

describe("mkSelectOptions", () => {
  it("should empty on no arg", () => {
    assert.strictEqual(mkSelectOptions({}), "");
  });
  it("should order by", () => {
    assert.strictEqual(mkSelectOptions({ orderBy: "foo" }), 'order by "foo"');
  });
  it("should order by qualified ", () => {
    assert.strictEqual(
      mkSelectOptions({ orderBy: "a.foo" }),
      'order by "a"."foo"'
    );
  });
  it("should order by desc", () => {
    assert.strictEqual(
      mkSelectOptions({ orderBy: "foo", orderDesc: true }),
      'order by "foo" DESC'
    );
  });
  it("should limit", () => {
    assert.strictEqual(mkSelectOptions({ limit: 10 }), "limit 10");
    assert.strictEqual(mkSelectOptions({ limit: "10" }), "limit 10");
  });
  it("should order by distance", () => {
    assert.ok(
      mkSelectOptions({
        orderBy: {
          distance: { latField: "x", longField: "y", lat: 5, long: 10 },
        },
      }).includes("order by ((x - 5)*(x - 5)) + ((y - 10)*(y - 10)*0.99240")
    );
  });
  it("should order by operator", () => {
    const nearOp = sqlFun("ABS", sqlBinOp("-", "target", "field"));
    assert.ok(
      mkSelectOptions(
        {
          orderBy: {
            operator: nearOp,
            target: 5,
            field: "y",
          },
        },
        [],
        false
      ).includes("order by ABS($1-y)")
    );
  });
});
