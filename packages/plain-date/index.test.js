const { describe, it } = require("node:test");
const assert = require("node:assert");
const PlainDate = require("./index");

describe("PlainDate", () => {
  it("constructs today's date with no args", () => {
    const today = new Date();
    const pd = new PlainDate();
    assert.strictEqual(pd.getFullYear(), today.getFullYear());
    assert.strictEqual(pd.getMonth(), today.getMonth());
    assert.strictEqual(pd.getDate(), today.getDate());
  });

  it("constructs from ISO string", () => {
    const pd = new PlainDate("2025-08-14");
    assert.strictEqual(pd.toISOString(), "2025-08-14");
    const pd1 = new PlainDate("2003-03-15");
    assert.strictEqual(pd1.toISOString(), "2003-03-15");
    assert.strictEqual(pd1.month, 3);
    assert.strictEqual(pd1.day, 15);
  });

  it("constructs from Date object", () => {
    const d = new Date(2024, 0, 5);
    const pd = new PlainDate(d);
    assert.strictEqual(pd.toISOString(), "2024-01-05");
  });

  it("equals another PlainDate with same year, month, day", () => {
    const pd1 = new PlainDate("2025-01-01");
    const pd2 = new PlainDate("2025-01-01");
    assert.strictEqual(pd1.equals(pd2), true);
  });

  it("adds days correctly", () => {
    const pd = new PlainDate("2025-01-01").addDays(10);
    assert.strictEqual(pd.toISOString(), "2025-01-11");
  });

  it("handles invalid date string", () => {
    const pd = new PlainDate("2025-13-01");
    assert.strictEqual(pd.isValid(), false);
    assert.strictEqual(pd.toString(), "Invalid Date");
  });

  it("returns UTC string with dynamic locale", () => {
    const pd = new PlainDate("2025-07-29");
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-GB";
    const expectedDate = new Date(Date.UTC(2025, 6, 29)).toLocaleDateString(
      locale,
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }
    );
    assert.strictEqual(pd.toUTCString(), expectedDate);
  });

  it("return UTC date string in YYYY-MM-DD format", () => {
    const pd = new PlainDate("2025-07-29");
    const utcDate = pd.toUTCDate();
    assert.strictEqual(typeof utcDate, "string");
    assert.strictEqual(utcDate, "2025-07-29");
  });

  it("converts to JSON correctly", () => {
    const pd = new PlainDate("2025-08-14");
    assert.strictEqual(JSON.stringify(pd), '"2025-08-14"');
  });
});
