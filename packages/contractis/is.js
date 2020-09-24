const gen = require("./generators");
const check_contract = require("./check");

const isnum = (x) => typeof x === "number";

const mkContract = (c) => {
  function checker(x) {
    check_contract(checker, x, "value check", undefined, checker);
    return x;
  }
  checker.contract_name = c.name;
  checker.options = c.options;
  checker.check = c.check;
  checker.generate = c.generate;
  checker.get_error_message = c.get_error_message;
  return checker;
};

const number = (opts) =>
  mkContract({
    name: "number",
    options: opts,
    check: (x) =>
      typeof x === "number" &&
      (isnum((opts || {}).lte) ? x <= opts.lte : true) &&
      (isnum((opts || {}).gte) ? x >= opts.gte : true),
    generate: () =>
      isnum((opts || {}).gte) && isnum((opts || {}).lte)
        ? gen.num_between(opts.lte, opts.gte)
        : isnum((opts || {}).lte)
        ? opts.lte - gen.num_positive()
        : isnum((opts || {}).gte)
        ? opts.gte + gen.num_positive()
        : gen.any_num(),
  });

const integer = (opts) =>
  mkContract({
    name: "integer",
    options: opts,
    check: (x) => number(opts).check(x) && x === Math.round(x),
    generate: () => Math.round(number(opts).generate()),
  });

const positive = mkContract({
  name: "positive",
  check: (x) => typeof x === "number" && x >= 0,
  generate: gen.num_positive,
});

const fun = (args, ret) =>
  mkContract({
    name: "fun",
    options: [args, ret],
    check: (x) => typeof x === "function",
  });

const getter = (ret) => fun(null, ret);

const bool = mkContract({
  name: "fun",
  check: (x) => typeof x === "boolean",
  generate: gen.bool,
});

const defined = mkContract({
  name: "defined",
  check: (x) => typeof x !== "undefined",
  generate: gen.reject_if(gen.any, (x) => typeof x === "undefined"),
});

const klass = (cls) =>
  mkContract({
    name: "class",
    options: cls,
    check: (x) =>
      x &&
      x.constructor &&
      x.constructor.name === (typeof cls === "string" ? cls : cls.name),
    generate: cls.contract && gen.generate_class(cls),
  });

const promise = (t) =>
  mkContract({
    name: "promise",
    options: typeof t === "undefined" ? any : t,
    check: (x) => x.constructor.name === Promise.name,
    generate: t && t.generate ? () => Promise.resolve(t.generate()) : undefined,
  });

const contract = mkContract({
  name: "contract",
  check: (x) =>
    x && typeof x.contract_name === "string" && typeof x.check === "function",
});

const obj = (o, alsoCheckThat) =>
  mkContract({
    name: "obj",
    options: o,
    get_error_message: (x) => {
      if (typeof x !== "object")
        return `Expected object with fields ${JSON.stringify(
          o
        )}, got type ${typeof x}`;
      const failing = Object.entries(o || {}).find(([k, v]) => !v.check(x[k]));
      if (failing) {
        if (o[failing[0]].get_error_message)
          return `key ${failing[0]}: ${o[failing[0]].get_error_message(
            x[failing[0]]
          )}`;
        return "Unknown failure in key " + failing[0];
      }
      if (typeof alsoCheckThat === "function" && !alsoCheckThat(o))
        return "failed instance check";
    },
    check: (x) =>
      typeof x === "object" &&
      x !== null &&
      !(x && x.constructor && x.constructor.name === Promise.name) &&
      (typeof alsoCheckThat === "undefined" || alsoCheckThat(x)) &&
      Object.entries(o || {}).every(([k, v]) => v.check(x[k])),
    generate:
      typeof alsoCheckThat === "undefined"
        ? gen.obj(o)
        : gen.accept_if(gen.obj(o), alsoCheckThat),
  });

const objVals = (c) =>
  mkContract({
    name: "objVals",
    options: c,
    get_error_message: (x) => {
      if (typeof x !== "object") return `Expected object, got type ${typeof x}`;
      const failing = Object.entries(x).find(([k, v]) => !c.check(c));
      if (failing) {
        if (c.get_error_message)
          return `key ${failing[0]}: ${c.get_error_message(x[failing[0]])}`;
        return "Unknown failure in key " + failing[0];
      }
    },
    check: (x) =>
      typeof x === "object" && Object.entries(x).every(([k, v]) => c.check(v)),
  });

const num = mkContract({
  name: "num",
  check: (x) => typeof x === "number",
  generate: gen.any_num,
});

const int = mkContract({
  name: "int",
  check: (x) => typeof x === "number" && Math.round(x) === x,
  generate: () => Math.round(gen.any_num()),
});

const posint = mkContract({
  name: "posint",
  check: (x) => typeof x === "number" && Math.round(x) === x && x >= 0,
  generate: () => Math.round(gen.num_positive()),
});

const date = mkContract({
  name: "date",
  check: (v) => v instanceof Date && !isNaN(v),
  generate: gen.date,
});

const str = mkContract({
  name: "str",
  check: (x) => typeof x === "string",
  generate: gen.string,
});

const eq = (v) =>
  mkContract({
    name: "eq",
    options: v,
    check: (x) => x === v,
    generate: () => v,
  });

const one_of = (vs) =>
  mkContract({
    name: "one_of",
    options: vs,
    check: (x) => vs.includes(x),
    generate: () => gen.oneOf(vs),
  });

const lte = (v) =>
  mkContract({
    name: "lte",
    options: v,
    check: (x) => x <= v,
  });

const gte = (v) =>
  mkContract({
    name: "gte",
    options: v,
    check: (x) => x >= v,
  });

const sat = (f) =>
  mkContract({
    name: "sat",
    options: f.toString(),
    check: (x) => f(x),
  });

const any = mkContract({
  name: "any",
  check: (x) => true,
  generate: gen.any,
});

const maybe = (c) =>
  mkContract({
    name: `maybe(${c.contract_name})`,
    options: c,
    get_error_message: c.get_error_message
      ? (x) => c.get_error_message(x)
      : undefined,
    check: (x) => typeof x === "undefined" || x === null || c.check(x),
    generate: () => (gen.bool() ? undefined : gen.generate_from(c)),
  });

const and = (...contrs) =>
  mkContract({
    name: `and(${contrs.map((c) => c.contract_name).join()})`,
    get_error_message: (x) => {
      const failing = contrs.find((c) => !c.check(x));
      return failing.options
        ? `${x} violates (in and) ${failing.contract_name}(${JSON.stringify(
            failing.options
          )})`
        : `${x} in and violates (in and) ${JSON.stringify(
            failing.contract_name
          )}`;
    },
    options: contrs,
    check: (x) => contrs.every((c) => c.check(x)),
    generate:
      contrs.filter((c) => c.generate).length > 0 && (() => and_gen(contrs)),
  });

function and_gen(contrs) {
  const val = gen.oneOf(contrs.filter((c) => c.generate)).generate();
  if (contrs.every((c) => c.check(val))) return val;
  else return and_gen(contrs);
}

const or = (...contrs) =>
  mkContract({
    name: `or(${contrs.map((c) => c.contract_name).join()})`,
    options: contrs,
    check: (x) => contrs.some((c) => c.check(x)),
    generate:
      contrs.filter((c) => c.generate).length > 0 &&
      (() => gen.oneOf(contrs.filter((c) => c.generate)).generate()),
  });

const xor = (...contrs) =>
  mkContract({
    name: `xor(${contrs.map((c) => c.contract_name).join()})`,
    options: contrs,
    check: (x) => contrs.filter((c) => c.check(x)).length === 1,
    //todo check only one is right in generate
    generate:
      contrs.filter((c) => c.generate).length > 0 &&
      (() => gen.oneOf(contrs.filter((c) => c.generate)).generate()),
  });

const array = (c) =>
  mkContract({
    name: "array",
    options: c,
    get_error_message: (vs) => {
      if (!Array.isArray(vs)) return `Expected Array, got type ${typeof x}`;
      const failingIx = vs.findIndex((v) => !c.check(v));

      if (c.get_error_message)
        return `index ${failingIx}: ${c.get_error_message(vs[failingIx])}`;
      return "failure in index " + failingIx;
    },
    check: (vs) => Array.isArray(vs) && vs.every((v) => c.check(v)),
    generate: c.generate && gen.array(c.generate),
  });

module.exports = {
  number,
  integer,
  eq,
  sat,
  and,
  num,
  str,
  lte,
  gte,
  fun,
  obj,
  objVals,
  or,
  xor,
  maybe,
  array,
  bool,
  positive,
  class: klass,
  any,
  int,
  posint,
  promise,
  defined,
  one_of,
  getter,
  date,
  contract,
  undefined: eq(undefined),
};
