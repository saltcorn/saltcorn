const { contract, is, auto_test } = require(".");
const { ContractViolation } = require("./util.js");
const gen = require("./generators");

describe("disable", () => {
  it("should exist", () => {
    expect(typeof contract.disable).toBe("function");
    expect(typeof contract.disble).toBe("undefined");
  });
});

const add1 = (x) => x + 1;

class Counter {
  constructor(init) {
    this.count = init || 0;
    contract.class(this);
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
  get mygetter() {
    return this.count;
  }

  static with_one_less_than(x) {
    return new Counter(x - 1);
  }
}

Counter.contract = {
  constructs: is.maybe(is.positive),
  variables: { count: is.positive },
  methods: {
    incr: {
      arguments: [],
      returns: is.positive,
    },
    get_with_added: {
      arguments: [is.positive],
      returns: is.positive,
    },
    get_with_added1: is.fun(is.positive, is.positive),
    get_with_added2: is.fun(is.positive, is.promise(is.positive)),
    mygetter: is.getter(is.positive),
  },
  static_methods: {
    with_one_less_than: is.fun(
      is.maybe(is.number({ gte: 1 })),
      is.class("Counter")
    ),
  },
};

class AsyncWrong {
  constructor(init) {
    this.count = init || 0;
    contract.class(this);
  }

  async get_in_wrong(x) {
    return this.count + x;
  }
}
AsyncWrong.contract = {
  constructs: is.maybe(is.positive),
  variables: { count: is.positive },
  methods: {
    get_in_wrong: is.fun(is.positive, is.promise(is.str)),
  },
};

describe("class contract", () => {
  it("should compute if valid", () => {
    const c = new Counter(3);
    c.incr();
    expect(c.count).toBe(4);
    expect(() => new Counter("foo")).toThrow(Error);
    expect(() => c.get_with_added("bar")).toThrow(Error);
  });
  it("should run function if valid", () => {
    const c = new Counter(3);
    c.incr();
    expect(c.get_with_added1(1)).toBe(5);
    expect(() => new Counter("foo")).toThrow(Error);
    expect(() => c.get_with_added("bar")).toThrow(Error);
  });
});

describe("static methodclass contract", () => {
  it("should compute if valid", () => {
    const c = Counter.with_one_less_than(3);
    c.incr();
    expect(c.count).toBe(3);
    expect(() => Counter.with_one_less_than("3")).toThrow(Error);
  });
});
describe("simple contract", () => {
  it("should compute if valid", () => {
    const add1C = contract(
      {
        arguments: [is.num],
        returns: is.num,
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
  it("should compute if valid", async () => {
    const add1C = contract(
      {
        arguments: [is.num],
        returns: is.promise(is.num),
      },
      async (x) => x + 1
    );
    await add1C(3);
    expect(() => add1C("foo")).toThrow(Error);
    expect(() => add1C()).toThrow(Error);
  });
  it("should throw if wrong", async () => {
    const add1C = contract(
      {
        arguments: [is.num],
        returns: is.promise(is.str),
      },
      async (x) => x + 1
    );

    await add1C(3)
      .then(() => {
        throw new Error("Should go to .catch, not enter .then");
      })
      .catch((err) => {
        expect(err).toBeInstanceOf(ContractViolation);
      });
  });
});

describe("argcheck contract", () => {
  it("should compute if valid", () => {
    const btw = contract(
      {
        arguments: [is.num, is.num],
        argcheck: (lo, hi) => hi > lo,
        returns: is.positive,
      },
      (lo, hi) => hi - lo
    );
    expect(btw(3, 4)).toBe(1);
    expect(() => btw(5, 4)).toThrow(Error);
  });
});

describe("retcheck contract", () => {
  it("should compute if valid", () => {
    const add1C = contract(
      {
        arguments: [is.num],
        returns: is.num,
        retcheck: (x) => (r) => r > x,
      },
      add1
    );
    const add2C = contract(
      {
        arguments: [is.num],
        returns: is.num,
        retcheck: (x) => (r) => r < x,
      },
      add1
    );
    expect(add1C(3)).toBe(4);
    expect(() => add2C(3)).toThrow(Error);
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
  it("should fail if return wrong", () => {
    const add1C = contract(is.fun([is.num], is.str), add1);
    expect(() => add1C(5)).toThrow(Error);
  });
});

describe("value contract", () => {
  it("should compute if valid", () => {
    expect(is.num(4)).toBe(4);
    expect(() => is.str(4)).toThrow(Error);
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
    expect(contract(is.class(Counter), c)).toBe(c);
    expect(() => contract(is.class(Counter), 4)).toThrow(Error);
  });
});

describe("maybe, or contract", () => {
  it("should compute if valid", () => {
    const add1C = contract.with(add1, {
      arguments: [is.maybe(is.num)],
      returns: is.or(is.str, is.num),
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
        arguments: [is.num],
        returns: is.num,
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
      arguments: [is.num],
      returns: (x) => is.number({ gte: x }),
    });
    const add1CWrong = contract.with(add1, {
      arguments: [is.num],
      returns: (x) => is.number({ lte: x }),
    });
    expect(add1C(3)).toBe(4);
    expect(() => add1CWrong(3)).toThrow(Error);
  });

  it("allow and in returns", () => {
    const add1C = contract.with(add1, {
      arguments: [is.num],
      returns: (x) => is.and(is.num, is.gte(x)),
    });

    expect(add1C(3)).toBe(4);
  });
  it("catch and in returns", () => {
    const add1CWrong = contract.with(add1, {
      arguments: [is.num],
      returns: (x) => is.and(is.num, is.lte(x)),
    });
    expect(() => add1CWrong(3)).toThrow(Error);
  });
});

describe("autotest function", () => {
  it("pass when correct", () => {
    const add1C = contract(
      {
        arguments: [is.num],
        returns: is.num,
      },
      add1
    );
    auto_test(add1C);
  });
  it("fail when return contract is wrong", () => {
    const add1C = contract(
      {
        arguments: [is.num],
        returns: is.str,
      },
      add1
    );
    expect(() => auto_test(add1C)).toThrow(Error);
  });
});

describe("autotest async function", () => {
  it("run when correct", async () => {
    const add1C = contract(
      is.fun(is.num, is.promise(is.num)),
      async (x) => x + 1
    );
    await auto_test(add1C);
  });
  it("fail when return contract is wrong", async () => {
    const add1C = contract(
      is.fun(is.num, is.promise(is.str)),
      async (x) => x + 1
    );
    await auto_test(add1C)
      .then(() => {
        throw new Error("Should go to .catch, not enter .then");
      })
      .catch((err) => {
        expect(err).toBeInstanceOf(ContractViolation);
      });
  });
});

describe("autotest shortcut function", () => {
  it("run", () => {
    const add1C = contract(is.fun([is.num], is.num), add1);
    auto_test(add1C);
  });
});

describe("autotest string function", () => {
  it("run", () => {
    const f1 = contract(is.fun(is.str, is.posint), (v) => v.length);
    auto_test(f1);
  });
});

describe("autotest or function", () => {
  it("run", () => {
    const f1 = contract(
      is.fun(is.or(is.str, is.array(is.int)), is.posint),
      (v) => v.length
    );
    auto_test(f1);
  });
});

describe("autotest array of any function", () => {
  it("run", () => {
    const f1 = contract(
      is.fun(is.or(is.str, is.array(is.any)), is.posint),
      (v) => v.length
    );
    auto_test(f1);
  });
});

describe("autotest and function", () => {
  it("run", () => {
    const f1 = contract(
      is.fun(is.and(is.str, is.str), is.posint),
      (v) => v.length
    );
    auto_test(f1);
  });
});

describe("autotest class", () => {
  it("run when correct", async () => {
    await auto_test(Counter);
  });
  it("fail when return contract is wrong", async () => {
    await auto_test(AsyncWrong)
      .then(() => {
        throw new Error("Should go to .catch, not enter .then");
      })
      .catch((err) => {
        expect(err).toBeInstanceOf(ContractViolation);
      });
  });
});

describe("autotest function with class as arg", () => {
  it("run when correct", () => {
    const f1 = contract(is.fun(is.class(Counter), is.positive), (c) => c.count);
    auto_test(f1);
  });

  it("fail when incorrect", () => {
    const f1 = contract(is.fun(is.class(Counter), is.str), (c) => c.count);
    expect(() => auto_test(f1)).toThrow(Error);
  });
});

describe("contract names", () => {
  it("should be str for str", () => {
    expect(is.str.contract_name).toBe("str");
  });
  it("should be maybe", () => {
    expect(is.maybe(is.str).contract_name).toBe("maybe(str)");
  });
  it("should be or", () => {
    expect(is.or(is.str, is.num).contract_name).toBe("or(str,num)");
  });
});

describe("generate", () => {
  it("gen pos not nan", () => {
    const rnd = gen.num_positive();
    expect(typeof rnd).toBe("number");
    expect(isNaN(rnd)).toBe(false);
  });

  it("num not nan", () => {
    const rnd = is.number({ lte: 5.0 }).generate();
    expect(typeof rnd).toBe("number");
    expect(isNaN(rnd)).toBe(false);
  });
  it("int not nan", () => {
    const rnd = is.integer({ lte: 5 }).generate();
    expect(typeof rnd).toBe("number");
    expect(isNaN(rnd)).toBe(false);
  });
});
