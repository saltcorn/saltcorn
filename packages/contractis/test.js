const { contract, is, auto_test } = require(".");

describe("disable", () => {
  it("should exist", () => {
    expect(typeof contract.disable).toBe("function");
    expect(typeof contract.disble).toBe("undefined");
  });
});

const add1 = x => x + 1;

class Counter {
  constructor(init) {
    this.count = init || 0;
    contract.class(this, Counter);
  }
  incr() {
    this.count += 1;
    return this.count;
  }
  get_with_added(x) {
    return this.count + x;
  }
  get_with_added1(x) {
    return this.count + x;
  }
  async get_with_added2(x) {
    return this.count + x;
  }
}

Counter.contract = {
  constructs: is.maybe(is.positive),
  variables: { count: is.positive },
  methods: {
    incr: {
      arguments: [],
      returns: is.positive
    },
    get_with_added: {
      arguments: [is.positive],
      returns: is.positive
    },
    get_with_added1: is.fun(is.positive, is.positive),
    get_with_added2: is.fun(is.positive, is.promise)
  }
};

describe("class contract", () => {
  it("should compute if valid", () => {
    const c = new Counter(3);
    c.incr();
    expect(c.count).toBe(4);
    expect(() => new Counter("foo")).toThrow(Error);
    expect(() => c.get_with_added("bar")).toThrow(Error);
  });
});

describe("simple contract", () => {
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
    expect(() => add1C()).toThrow(Error);
  });
});

describe("async function contract", () => {
  it("should compute if valid", () => {
    const add1C = contract(
      {
        arguments: [is.number()],
        returns: is.promise
      },
      async(x) => x+1
    );
    console.log(((async(x) => x+1)(3)).constructor.name)
    add1C(3)
    expect(() => add1C("foo")).toThrow(Error);
    expect(() => add1C()).toThrow(Error);
  });
});

describe("fun shortcut contract", () => {
  it("should compute if valid", () => {
    const add1C = contract(is.fun([is.num], is.num), add1);
    expect(add1C(3)).toBe(4);
    expect(add1("foo")).toBe("foo1");
    expect(() => add1C("foo")).toThrow(Error);
    expect(() => add1C()).toThrow(Error);
  });
});

describe("fun shortcut contract", () => {
  it("should fail if return wrong", () => {
    const add1C = contract(is.fun([is.num], is.str), add1);
    expect(() => add1C(5)).toThrow(Error);
  });
});
describe("value contract", () => {
  it("should compute if valid", () => {
    expect(contract(is.num, 4)).toBe(4);
    expect(() => contract(is.str, 4)).toThrow(Error);
  });
});

describe("object value contract", () => {
  it("should compute if valid", () => {
    const obj = { a: 1, b: "foo" };
    expect(contract(is.obj(), obj)).toBe(obj);
    expect(contract(is.maybe(is.obj()), obj)).toBe(obj);
    expect(() => contract(is.str, obj)).toThrow(Error);
  });
});

describe("class value contract", () => {
  it("detect class", () => {
    const c = new Counter(3);
    expect(contract(is.klass(Counter), c)).toBe(c);
    expect(() => contract(is.klass(Counter), 4)).toThrow(Error);
  });
});

describe("maybe, or contract", () => {
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

describe("reverse with contract", () => {
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

describe("autotest function", () => {
  it("run", () => {
    const add1C = contract(
      {
        arguments: [is.number()],
        returns: is.number()
      },
      add1
    );
    auto_test(add1C);
  });
});

describe("autotest shortcut function", () => {
  it("run", () => {
    const add1C = contract(is.fun([is.num], is.num), add1);
    auto_test(add1C);
  });
});
describe("autotest class", () => {
  it("run", () => {
    auto_test(Counter);
  });
});
