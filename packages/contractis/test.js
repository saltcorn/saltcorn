const { contract, is } = require(".");

describe("disable", () => {
  it("should exist", () => {
    expect(typeof contract.disable).toBe("function");
    expect(typeof contract.disble).toBe("undefined");
  });
});

const add1 = x => x + 1;

describe("simple constract", () => {
  it("should compute if valid", () => {
    const add1C = contract(add1, {
      arguments: [is.number()],
      returns: is.number()
    });
    expect(add1C(3)).toBe(4);
    expect(add1("foo")).toBe("foo1");
    expect(() => add1C("foo")).toThrow(Error);
  });
});
