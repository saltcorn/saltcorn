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
    const add1C = contract.with(add1, {
      arguments: [is.number()],
      returns: is.number()
    });
    expect(add1C(3)).toBe(4);
    expect(add1("foo")).toBe("foo1");
    expect(() => add1C("foo")).toThrow(Error);
    expect(() => add1C()).toThrow(Error);
  });
});

describe("maybe, or constract", () => {
  it("should compute if valid", () => {
    const add1C = contract.with(add1, {
      arguments: [is.maybe(is.number())],
      returns: is.or(is.str, is.number())
    });
    expect(add1C(3)).toBe(4);
    expect(add1C() === 7).toBe(false); //not throw
    expect(() => add1C("foo")).toThrow(Error);
  });
});

describe("reverse with constract", () => {
  it("should compute if valid", () => {
    const add1C = contract(
      {
        arguments: [is.number()],
        returns: is.number()
      },
      add1
    );
    expect(add1C(3)).toBe(4);
    expect(add1("foo")).toBe("foo1");
    expect(() => add1C("foo")).toThrow(Error);
  });
});

describe("return lambda", () => {
  it("should compute if valid", () => {
    const add1C = contract.with(add1, {
      arguments: [is.number()],
      returns: x => is.number({ gte: x })
    });
    const add1CWrong = contract.with(add1, {
      arguments: [is.number()],
      returns: x => is.number({ lte: x })
    });
    expect(add1C(3)).toBe(4);
    expect(() => add1CWrong(3)).toThrow(Error);
  });

  it("allow and in returns", () => {
    const add1C = contract.with(add1, {
      arguments: [is.number()],
      returns: x => is.and(is.num, is.gte(x))
    });

    expect(add1C(3)).toBe(4);
  });
  it("catch and in returns", () => {
    const add1CWrong = contract.with(add1, {
      arguments: [is.number()],
      returns: x => is.and(is.num, is.lte(x))
    });
    expect(() => add1CWrong(3)).toThrow(Error);
  });
});
