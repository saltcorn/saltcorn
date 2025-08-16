const PlainDate = require("./index");

describe("PlainDate", () => {
  it("constructs today's date with no args", () => {
    const today = new Date();
    const pd = new PlainDate();
    expect(pd.getFullYear()).toBe(today.getFullYear());
    expect(pd.getMonth()).toBe(today.getMonth());
    expect(pd.getDate()).toBe(today.getDate());
  });

  it("constructs from ISO string", () => {
    const pd = new PlainDate("2025-08-14");
    expect(pd.toISOString()).toBe("2025-08-14");
  });

  it("constructs from Date object", () => {
    const d = new Date(2024, 0, 5);
    const pd = new PlainDate(d);
    expect(pd.toISOString()).toBe("2024-01-05");
  });

  it("equals another PlainDate with same year, month, day", () => {
    const pd1 = new PlainDate("2025-01-01");
    const pd2 = new PlainDate("2025-01-01");
    expect(pd1.equals(pd2)).toBe(true);
  });

  it("adds days correctly", () => {
    const pd = new PlainDate("2025-01-01").addDays(10);
    expect(pd.toISOString()).toBe("2025-01-11");
  });

  it("handles invalid date string", () => {
    const pd = new PlainDate("2025-13-01");
    expect(pd.isValid()).toBe(false);
    expect(pd.toString()).toBe("Invalid Date");
  });

  it("returns UTC string with dynamic locale", () => {
    const pd = new PlainDate("2025-07-29");
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-GB";
    const expectedDate = new Date(Date.UTC(2025, 6, 29)).toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(pd.toUTCString()).toBe(expectedDate);
  });

  it('return UTC date string in YYYY-MM-DD format', ()=> {
    const pd = new PlainDate("2025-07-29");
    const utcDate = pd.toUTCDate();
    expect(typeof utcDate).toBe("string");
    expect(utcDate).toBe("2025-07-29");
  })

  it("converts to JSON correctly", () => {
    const pd = new PlainDate("2025-08-14");
    expect(JSON.stringify(pd)).toBe('"2025-08-14"');
  });
});
