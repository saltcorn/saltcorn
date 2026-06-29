import {
  kahnSort,
  orderCycleTables,
} from "@saltcorn/cli/src/commands/sync-upload-data.js";

const fks = (map) => (tblName) =>
  (map[tblName] || []).map((ref) => ({ reftable_name: ref }));

const flat = (changes, fkMap) => {
  const { sorted, cycleTables } = kahnSort(changes, fks(fkMap));
  return [...sorted, ...cycleTables];
};

describe("kahnSort", () => {
  test("single table is returned as-is", () => {
    const { sorted, cycleTables } = kahnSort({ books: {} }, fks({}));
    expect(sorted).toEqual(["books"]);
    expect(cycleTables).toEqual([]);
  });

  test("two independent tables are both returned", () => {
    const result = flat({ books: {}, authors: {} }, {});
    expect(result).toHaveLength(2);
    expect(result).toContain("books");
    expect(result).toContain("authors");
  });

  test("parent comes before child", () => {
    const result = flat(
      { books: {}, publishers: {} },
      { books: ["publishers"] }
    );
    expect(result.indexOf("publishers")).toBeLessThan(result.indexOf("books"));
  });

  test("three-level chain is ordered correctly", () => {
    // chapters -> books -> publishers
    const result = flat(
      { chapters: {}, books: {}, publishers: {} },
      { chapters: ["books"], books: ["publishers"] }
    );
    expect(result.indexOf("publishers")).toBeLessThan(result.indexOf("books"));
    expect(result.indexOf("books")).toBeLessThan(result.indexOf("chapters"));
  });

  test("diamond dependency: shared parent comes first, shared child comes last", () => {
    // both b and c depend on a; d depends on both b and c
    const result = flat(
      { a: {}, b: {}, c: {}, d: {} },
      { b: ["a"], c: ["a"], d: ["b", "c"] }
    );
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("c"));
    expect(result.indexOf("b")).toBeLessThan(result.indexOf("d"));
    expect(result.indexOf("c")).toBeLessThan(result.indexOf("d"));
  });

  test("FK to a table not in changes is ignored", () => {
    const result = flat({ books: {} }, { books: ["external_table"] });
    expect(result).toEqual(["books"]);
  });

  test("self-referencing FK does not affect order", () => {
    const result = flat({ categories: {} }, { categories: ["categories"] });
    expect(result).toEqual(["categories"]);
  });

  test("cyclic dependency: cycle tables are separated out", () => {
    const { sorted, cycleTables } = kahnSort(
      { a: {}, b: {} },
      fks({ a: ["b"], b: ["a"] })
    );
    expect(sorted).toHaveLength(0);
    expect(cycleTables).toHaveLength(2);
    expect(cycleTables).toContain("a");
    expect(cycleTables).toContain("b");
  });

  test("multiple FKs to the same parent table", () => {
    const result = flat(
      { books: {}, publishers: {} },
      { books: ["publishers", "publishers"] }
    );
    expect(result.indexOf("publishers")).toBeLessThan(result.indexOf("books"));
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(2);
  });

  test("all tables appear exactly once", () => {
    const result = flat(
      { a: {}, b: {}, c: {}, d: {} },
      { b: ["a"], c: ["a"], d: ["b", "c"] }
    );
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
  });
});

// Mock a table with FK fields: [{ field, ref, required? }]
const mockTable = (fkSpecs) => ({
  getFields: () =>
    fkSpecs.map(({ field, required = false }) => ({ name: field, required })),
  getForeignKeys: () =>
    fkSpecs.map(({ field, ref }) => ({ name: field, reftable_name: ref })),
});
const makeGetTable = (specs) => (name) => {
  const s = specs[name];
  return s ? mockTable(s) : null;
};

describe("orderCycleTables", () => {
  test("nullable side inserted before required side", () => {
    // A.b_ref -> B (required), B.a_ref -> A (nullable)
    const getTable = makeGetTable({
      A: [{ field: "b_ref", ref: "B", required: true }],
      B: [{ field: "a_ref", ref: "A", required: false }],
    });
    const { cycleOrder, deferFields } = orderCycleTables(["A", "B"], getTable);
    expect(cycleOrder[0]).toBe("B");
    expect(cycleOrder[1]).toBe("A");
  });

  test("nullable FK field is deferred for the first-inserted table", () => {
    const getTable = makeGetTable({
      A: [{ field: "b_ref", ref: "B", required: true }],
      B: [{ field: "a_ref", ref: "A", required: false }],
    });
    const { deferFields } = orderCycleTables(["A", "B"], getTable);
    expect(deferFields.get("B")).toEqual(new Set(["a_ref"]));
    expect(deferFields.has("A")).toBe(false);
  });

  test("required FK field is never deferred", () => {
    const getTable = makeGetTable({
      A: [{ field: "b_ref", ref: "B", required: true }],
      B: [{ field: "a_ref", ref: "A", required: false }],
    });
    const { deferFields } = orderCycleTables(["A", "B"], getTable);
    expect(deferFields.has("A")).toBe(false);
  });

  test("both nullable: first table has its FK deferred, second does not", () => {
    const getTable = makeGetTable({
      A: [{ field: "b_ref", ref: "B", required: false }],
      B: [{ field: "a_ref", ref: "A", required: false }],
    });
    const { cycleOrder, deferFields } = orderCycleTables(["A", "B"], getTable);
    expect(cycleOrder).toHaveLength(2);
    // Only the first-inserted table needs deferral; the second can translate normally.
    expect(deferFields.size).toBe(1);
    expect(deferFields.has(cycleOrder[0])).toBe(true);
    expect(deferFields.has(cycleOrder[1])).toBe(false);
  });

  test("all cycle tables appear in cycleOrder exactly once", () => {
    const getTable = makeGetTable({
      A: [{ field: "b_ref", ref: "B", required: true }],
      B: [{ field: "a_ref", ref: "A", required: false }],
    });
    const { cycleOrder } = orderCycleTables(["A", "B"], getTable);
    expect(cycleOrder).toHaveLength(2);
    expect(new Set(cycleOrder).size).toBe(2);
  });
});
