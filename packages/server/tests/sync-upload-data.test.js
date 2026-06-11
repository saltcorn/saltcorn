const {
  topoSortTables,
} = require("../../saltcorn-cli/src/commands/sync-upload-data");

const fks = (map) => (tblName) =>
  (map[tblName] || []).map((ref) => ({ reftable_name: ref }));

describe("topoSortTables", () => {
  test("single table is returned as-is", () => {
    const result = topoSortTables({ books: {} }, fks({}));
    expect(result).toEqual(["books"]);
  });

  test("two independent tables are both returned", () => {
    const result = topoSortTables({ books: {}, authors: {} }, fks({}));
    expect(result).toHaveLength(2);
    expect(result).toContain("books");
    expect(result).toContain("authors");
  });

  test("parent comes before child", () => {
    const result = topoSortTables(
      { books: {}, publishers: {} },
      fks({ books: ["publishers"] })
    );
    expect(result.indexOf("publishers")).toBeLessThan(result.indexOf("books"));
  });

  test("three-level chain is ordered correctly", () => {
    // chapters -> books -> publishers
    const result = topoSortTables(
      { chapters: {}, books: {}, publishers: {} },
      fks({ chapters: ["books"], books: ["publishers"] })
    );
    expect(result.indexOf("publishers")).toBeLessThan(result.indexOf("books"));
    expect(result.indexOf("books")).toBeLessThan(result.indexOf("chapters"));
  });

  test("diamond dependency: shared parent comes first, shared child comes last", () => {
    // both b and c depend on a; d depends on both b and c
    const result = topoSortTables(
      { a: {}, b: {}, c: {}, d: {} },
      fks({ b: ["a"], c: ["a"], d: ["b", "c"] })
    );
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("c"));
    expect(result.indexOf("b")).toBeLessThan(result.indexOf("d"));
    expect(result.indexOf("c")).toBeLessThan(result.indexOf("d"));
  });

  test("FK to a table not in changes is ignored", () => {
    // books has a FK to external_table which is not being synced
    const result = topoSortTables(
      { books: {} },
      fks({ books: ["external_table"] })
    );
    expect(result).toEqual(["books"]);
  });

  test("self-referencing FK does not affect order", () => {
    const result = topoSortTables(
      { categories: {} },
      fks({ categories: ["categories"] })
    );
    expect(result).toEqual(["categories"]);
  });

  test("cyclic dependency: all tables still appear in result", () => {
    const result = topoSortTables(
      { a: {}, b: {} },
      fks({ a: ["b"], b: ["a"] })
    );
    expect(result).toHaveLength(2);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  test("multiple FKs to the same parent table", () => {
    // books has two FK fields both pointing to publisher
    const result = topoSortTables(
      { books: {}, publishers: {} },
      fks({ books: ["publishers", "publishers"] })
    );
    expect(result.indexOf("publishers")).toBeLessThan(result.indexOf("books"));
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(2);
  });

  test("all tables appear exactly once", () => {
    const result = topoSortTables(
      { a: {}, b: {}, c: {}, d: {} },
      fks({ b: ["a"], c: ["a"], d: ["b", "c"] })
    );
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
  });
});
