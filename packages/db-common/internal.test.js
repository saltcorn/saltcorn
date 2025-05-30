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
    expect(mkWhere()).toStrictEqual({ values: [], where: "" });
  });
  it("should empty on null obj arg", () => {
    expect(mkWhere({})).toStrictEqual({ values: [], where: "" });
  });
  it("should query json", () => {
    expect(mkWhere({ foo: { json: ["bar", 5] } })).toStrictEqual({
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar'))->>0=$1`,
    });
  });
  it("should query json deeply", () => {
    expect(mkWhere({ foo: { json: [["bar", 2], 5] } })).toStrictEqual({
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar[2]'))->>0=$1`,
    });
  });
  it("should query json with object syntax", () => {
    expect(mkWhere({ foo: { json: { bar: 5 } } })).toStrictEqual({
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar'))->>0=$1`,
    });
  });
  it("should query json path", () => {
    expect(mkWhere({ foo: { json: { "$.bar[2]": 5 } } })).toStrictEqual({
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar[2]'))->>0=$1`,
    });
  });
  it("should query json escapes", () => {
    expect(mkWhere({ foo: { json: { "bar.baz": 5 } } })).toStrictEqual({
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$."bar.baz"'))->>0=$1`,
    });
  });
  it("should query json approx", () => {
    expect(mkWhere({ foo: { json: { bar: { ilike: "baz" } } } })).toStrictEqual(
      {
        values: ["baz"],
        where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.bar'))->>0 ILIKE '%' || $1 || '%'`,
      }
    );
  });
  it("should query json gte", () => {
    expect(mkWhere({ foo: { json: { bar: { gte: 6 } } } })).toStrictEqual({
      values: [6],
      where: `where jsonb_path_query_first(\"foo\", '$.bar') >= $1`,
    });
  });
  it("should query json gte and lte", () => {
    expect(
      mkWhere({ foo: { json: { bar: { gte: 6, lte: 1 } } } })
    ).toStrictEqual({
      values: [6, 1],
      where: `where jsonb_path_query_first(\"foo\", '$.bar') >= $1 and jsonb_path_query_first(\"foo\", '$.bar') <= $2`,
    });
  });
  it("should not sql inject in json", () => {
    expect(
      mkWhere({ "Robert'); DROP TABLE Students; --": { json: ["bar", 5] } })
    ).toStrictEqual({
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"RobertDROPTABLEStudents\", '$.bar'))->>0=$1`,
    });
    expect(
      mkWhere({ foo: { json: ["Robert'); DROP TABLE Students; --", 5] } })
    ).toStrictEqual({
      values: [5],
      where: `where jsonb_build_array(jsonb_path_query_first(\"foo\", '$.\"Robert''); DROP TABLE Students; --\"'))->>0=$1`,
    });
    expect(
      mkWhere({ foo: { json: ['Robert"); DROP TABLE Students; --', 5] } })
    ).toStrictEqual({
      values: [5],
      where:
        'where jsonb_build_array(jsonb_path_query_first("foo", \'$."Robert\\"); DROP TABLE Students; --"\'))->>0=$1',
    });
  });

  it("should set id", () => {
    expect(mkWhere({ id: 5 })).toStrictEqual({
      values: [5],
      where: 'where "id"=$1',
    });
    expect(mkWhere({ id: 5, hello: "world" })).toStrictEqual({
      values: [5, "world"],
      where: 'where "id"=$1 and "hello"=$2',
    });
  });
  it("should read eq", () => {
    expect(mkWhere({ eq: [Symbol("id"), 5] })).toStrictEqual({
      values: [5],
      where: 'where "id"=$1',
    });
    expect(mkWhere({ eq: [Symbol("id"), null] })).toStrictEqual({
      values: [],
      where: 'where "id" is null',
    });
    expect(mkWhere({ eq: ["id", null] })).toStrictEqual({
      values: ["id"],
      where: "where $1::text is null",
    });
    expect(mkWhere({ eq: [4, 5] })).toStrictEqual({
      values: [4, 5],
      where: "where $1=$2",
    });
    expect(mkWhere({ eq: [null, 5] })).toStrictEqual({
      values: [5],
      where: "where $1 is null",
    });
    expect(mkWhere({ not: { eq: [Symbol("id"), 5] } })).toStrictEqual({
      values: [5],
      where: 'where not ("id"=$1)',
    });
  });
  it("should query null", () => {
    expect(mkWhere({ id: null })).toStrictEqual({
      values: [],
      where: 'where "id" is null',
    });
    expect(mkWhere({ id: null, foo: 1 })).toStrictEqual({
      values: [1],
      where: 'where "id" is null and "foo"=$1',
    });
    expect(mkWhere({ foo: 1, id: null })).toStrictEqual({
      values: [1],
      where: 'where "foo"=$1 and "id" is null',
    });
  });
  it("should query not null", () => {
    expect(mkWhere({ not: { id: null, x: null } })).toStrictEqual({
      values: [],
      where: 'where not ("id" is null and "x" is null)',
    });
    expect(
      mkWhere({ and: [{ not: { id: null } }, { not: { x: null } }] })
    ).toStrictEqual({
      values: [],
      where: 'where (not ("id" is null) and not ("x" is null))',
    });
    expect(mkWhere({ not: { id: null } })).toStrictEqual({
      values: [],
      where: 'where not ("id" is null)',
    });
    expect(mkWhere({ not: { id: null }, x: 5 })).toStrictEqual({
      values: [5],
      where: 'where not ("id" is null) and "x"=$1',
    });
  });
  it("should query not true", () => {
    expect(mkWhere({ not: { foo: true } })).toStrictEqual({
      values: [true],
      where: 'where not ("foo"=$1)',
    });
    expect(mkWhere({ not: { foo: true, bar: false } })).toStrictEqual({
      values: [true, false],
      where: 'where not ("foo"=$1 and "bar"=$2)',
    });
  });
  it("should query lt/gt", () => {
    expect(mkWhere({ id: { lt: 5 } })).toStrictEqual({
      values: [5],
      where: 'where "id"<$1',
    });
    expect(mkWhere({ id: { gt: 8 } })).toStrictEqual({
      values: [8],
      where: 'where "id">$1',
    });
    expect(mkWhere({ id: { gt: 8, lt: 15 } })).toStrictEqual({
      values: [8, 15],
      where: 'where "id">$1 and "id"<$2',
    });
    expect(mkWhere({ id: { gt: 8, lt: 15, equal: true } })).toStrictEqual({
      values: [8, 15],
      where: 'where "id">=$1 and "id"<=$2',
    });
    expect(mkWhere({ id: { lt: 5, equal: true } })).toStrictEqual({
      values: [5],
      where: 'where "id"<=$1',
    });
    expect(mkWhere({ id: { gt: 8, equal: true } })).toStrictEqual({
      values: [8],
      where: 'where "id">=$1',
    });
    expect(mkWhere({ id: [{ gt: 0 }, { lt: 10 }] })).toStrictEqual({
      values: [0, 10],
      where: 'where "id">$1 and "id"<$2',
    });
    expect(mkWhere({ id: { or: [{ gt: 10 }, { lt: 5 }] } })).toStrictEqual({
      values: [10, 5],
      where: 'where ("id">$1 or "id"<$2)',
    });
  });
  it("should query days", () => {
    expect(mkWhere({ theday: { gt: someday, day_only: true } })).toStrictEqual({
      values: [someday],
      where: 'where "theday"::date>$1::date',
    });
  });

  it("should query ilike", () => {
    expect(mkWhere({ name: { ilike: "imon" } })).toStrictEqual({
      values: ["imon"],
      where: `where "name" ILIKE '%' || $1 || '%'`,
    });
  });
  it("should query ilike on sqlite", () => {
    expect(mkWhere({ name: { ilike: "imon" } }, true)).toStrictEqual({
      values: ["imon"],
      where: `where "name" LIKE '%' || ? || '%'`,
    });
  });

  it("should query string as regexp", () => {
    expect(mkWhere({ name: /imon/ })).toStrictEqual({
      values: ["imon"],
      where: `where "name" ~ $1`,
    });
  });

  it("should query regexp on sqlite", () => {
    expect(mkWhere({ name: /imon/ }, true)).toStrictEqual({
      values: ["imon"],
      where: `where "name" REGEXP ?`,
    });
  });

  it("should query FTS", () => {
    const fld = (name) => ({
      name,
      type: { sql_name: "text" },
    });
    expect(
      mkWhere({
        _fts: {
          fields: [fld("name"), fld("description")],
          searchTerm: "foo bar",
        },
      })
    ).toStrictEqual({
      values: ["foo bar"],
      where: `where to_tsvector('english', coalesce("description",'') || ' ' || coalesce("name",'')) @@ plainto_tsquery('english', $1)`,
    });
    expect(
      mkWhere({
        _fts: { fields: [fld("name"), fld("description")], searchTerm: "foo" },
      })
    ).toStrictEqual({
      values: ["foo:*"],
      where: `where to_tsvector('english', coalesce("description",'') || ' ' || coalesce("name",'')) @@ to_tsquery('english', $1)`,
    });
    expect(
      mkWhere(
        {
          _fts: {
            fields: [fld("name"), fld("description")],
            searchTerm: "foo",
          },
        },
        true
      )
    ).toStrictEqual({
      values: ["foo"],
      where: `where coalesce("description",'') || ' ' || coalesce("name",'') LIKE '%' || ? || '%'`,
    });
  });
  it("should query subselect", () => {
    expect(
      mkWhere({
        id: [{ inSelect: { table: "foo", field: "bar", where: { baz: 7 } } }],
      })
    ).toStrictEqual({
      values: [7],
      where: 'where "id" in (select "bar" from "foo" where "baz"=$1)',
    });
    expect(
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
      })
    ).toStrictEqual({
      values: [7],
      where: 'where "id" in (select "bar" from "sub1"."foo" where "baz"=$1)',
    });
    expect(
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
      })
    ).toStrictEqual({
      values: [7],
      where:
        'where "id" in (select ss1."id" from "sub1"."foo" ss1 join "sub1"."baz" ss2 on ss2."id" = ss1."bar" where "ss2"."baz"=$1)',
    });
    expect(
      mkWhere({
        age: 45,
        id: [{ inSelect: { table: "foo", field: "bar", where: { baz: 7 } } }],
        name: "Alice",
      })
    ).toStrictEqual({
      values: [45, 7, "Alice"],
      where: `where "age"=$1 and "id" in (select "bar" from "foo" where "baz"=$2) and "name"=$3`,
    });
  });
  it("should query or", () => {
    expect(mkWhere({ or: [{ id: 5 }, { x: 7 }] })).toStrictEqual({
      values: [5, 7],
      where: 'where ("id"=$1 or "x"=$2)',
    });
    expect(mkWhere({ or: [{ id: 5 }, { x: { gt: 7 } }] })).toStrictEqual({
      values: [5, 7],
      where: 'where ("id"=$1 or "x">$2)',
    });
    expect(
      mkWhere({ or: [{ id: 5 }, { x: [{ gt: 7 }, { lt: 12 }] }] })
    ).toStrictEqual({
      values: [5, 7, 12],
      where: 'where ("id"=$1 or "x">$2 and "x"<$3)',
    });
    expect(
      mkWhere({ y: 6, or: [{ id: 5 }, { x: [{ gt: 7 }, { lt: 12 }] }] })
    ).toStrictEqual({
      values: [6, 5, 7, 12],
      where: 'where "y"=$1 and ("id"=$2 or "x">$3 and "x"<$4)',
    });
    expect(mkWhere({ or: [{ id: 5 }, { x: 7, y: 8 }] })).toStrictEqual({
      values: [5, 7, 8],
      where: 'where ("id"=$1 or "x"=$2 and "y"=$3)',
    });
    expect(mkWhere({ not: { id: 5 } })).toStrictEqual({
      values: [5],
      where: 'where not ("id"=$1)',
    });
    expect(mkWhere({ not: { id: 5, y: 1 } })).toStrictEqual({
      values: [5, 1],
      where: 'where not ("id"=$1 and "y"=$2)',
    });
    expect(mkWhere({ not: { y: { in: [1, 2, 3] } } })).toStrictEqual({
      values: [[1, 2, 3]],
      where: 'where not ("y" = ANY ($1))',
    });
    expect(mkWhere({ y: { not: { in: [1, 2, 3] } } })).toStrictEqual({
      values: [[1, 2, 3]],
      where: 'where not ("y" = ANY ($1))',
    });
    expect(mkWhere({ y: { in: [1, 2, 3] } })).toStrictEqual({
      values: [[1, 2, 3]],
      where: 'where "y" = ANY ($1)',
    });
    expect(mkWhere({ not: { y: { in: [1, 2, 3] } } }, true)).toStrictEqual({
      values: [1, 2, 3],
      where: 'where not ("y" IN (?, ?, ?))',
    });
    expect(mkWhere({ y: { not: { in: [1, 2, 3] } } }, true)).toStrictEqual({
      values: [1, 2, 3],
      where: 'where not ("y" IN (?, ?, ?))',
    });
    expect(mkWhere({ y: { in: [1, 2, 3] } }, true)).toStrictEqual({
      values: [1, 2, 3],
      where: 'where "y" IN (?, ?, ?)',
    });
    expect(
      mkWhere({
        or: [
          { not: { eq: ["1", null] } },
          { not: { eq: [null, null] }, married_to: null },
        ],
      })
    ).toStrictEqual({
      values: ["1"],
      where:
        'where (not ($1::text is null) or not (null is null) and "married_to" is null)',
    });
    /*

    expect(mkWhere([{ id: 5 }, { x: 7 }])).toStrictEqual({
      values: [5, 7],
      where: 'where "id"=$1 and "x"=$2',
    });
    expect(mkWhere([{ or: [{ id: 5 }, { x: 7 }] }, { z: 9 }])).toStrictEqual({
      values: [5, 7, 9],
      where: 'where ("id"=$1 or "x"=$2) and "z"=$3',
    });*/
  });
  it("should query and", () => {
    expect(mkWhere({ and: [{ id: 5 }, { x: 7 }] })).toStrictEqual({
      values: [5, 7],
      where: 'where ("id"=$1 and "x"=$2)',
    });
    expect(
      mkWhere({
        and: [
          { or: [{ bar: "Zoo" }, { bar: "Baz" }] },
          { or: [{ foo: false }, { foo: null }] },
        ],
      })
    ).toStrictEqual({
      values: ["Zoo", "Baz", false],
      where: 'where (("bar"=$1 or "bar"=$2) and ("foo"=$3 or "foo" is null))',
    });
  });
  it("should false", () => {
    expect(mkWhere({ _false: true })).toStrictEqual({
      values: [],
      where: "where FALSE",
    });
  });
  it("equate strings", () => {
    expect(mkWhere({ eq: ["ALL", "ALL"] })).toStrictEqual({
      values: ["ALL", "ALL"],
      where: "where $1::text=$2::text",
    });
  });
  it("equate strings in or", () => {
    expect(
      mkWhere({ or: [{ eq: ["ALL", Symbol("name")] }, { eq: ["ALL", "ALL"] }] })
    ).toStrictEqual({
      values: ["ALL", "ALL", "ALL"],
      where: 'where ($1::text="name" or $2::text=$3::text)',
    });
  });
});

describe("sqlsanitize", () => {
  it("should not alter valid name", () => {
    expect(sqlsanitize("ffoo_oo")).toBe("ffoo_oo");
  });
  it("should not alter valid symbol", () => {
    expect(sqlsanitize(Symbol("ffoo_oo"))).toBe("ffoo_oo");
  });
  it("should remove spaces", () => {
    expect(sqlsanitize(" ")).toBe("");
  });
  it("should remove chars from invalid name", () => {
    expect(sqlsanitize("ffoo--oo--uu")).toBe("ffoooouu");
    expect(sqlsanitize("ffoo--oo;-uu")).toBe("ffoooouu");
    expect(sqlsanitize('ffoo-"oo--uu')).toBe("ffoooouu");
    expect(sqlsanitize('ffoo-"oo-"uu')).toBe("ffoooouu");
  });
  it("should remove chars from invalid symbol", () => {
    expect(sqlsanitize(Symbol("ffoo--oo--uu"))).toBe("ffoooouu");
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

describe("mkSelectOptions", () => {
  it("should empty on no arg", () => {
    expect(mkSelectOptions({})).toBe("");
  });
  it("should order by", () => {
    expect(mkSelectOptions({ orderBy: "foo" })).toBe('order by "foo"');
  });
  it("should order by qualified ", () => {
    expect(mkSelectOptions({ orderBy: "a.foo" })).toBe('order by "a"."foo"');
  });
  it("should order by desc", () => {
    expect(mkSelectOptions({ orderBy: "foo", orderDesc: true })).toBe(
      'order by "foo" DESC'
    );
  });
  it("should limit", () => {
    expect(mkSelectOptions({ limit: 10 })).toBe("limit 10");
    expect(mkSelectOptions({ limit: "10" })).toBe("limit 10");
  });
  it("should order by distance", () => {
    expect(
      mkSelectOptions({
        orderBy: {
          distance: { latField: "x", longField: "y", lat: 5, long: 10 },
        },
      })
    ).toContain("order by ((x - 5)*(x - 5)) + ((y - 10)*(y - 10)*0.99240");
  });
  it("should order by operator", () => {
    const nearOp = sqlFun("ABS", sqlBinOp("-", "target", "field"));
    expect(
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
      )
    ).toContain("order by ABS($1-y)");
  });
});
