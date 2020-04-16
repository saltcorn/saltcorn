const gen = require("./generators");
const check_contract = require("./check");

isnum = x => typeof x === "number";

const mkContract = c => {
  function checker(x) {
    check_contract(checker, x, "value check", undefined, checker);
    return x;
  }
  checker.contract_name = c.name;
  checker.options = c.options;
  checker.check = c.check;
  checker.generate = c.generate;
  return checker;
};

const number = opts =>
  mkContract({
    name: "number",
    options: opts,
    check: x =>
      typeof x === "number" &&
      (isnum((opts || {}).lte) ? x <= opts.lte : true) &&
      (isnum((opts || {}).gte) ? x >= opts.gte : true),
    generate: () =>
      isnum((opts || {}).lte) && isnum((opts || {}).lte)
        ? gen.num_between(opts.lte, opts.gte)
        : isnum((opts || {}).lte)
        ? opts.lte - gen.num_positive
        : isnum((opts || {}).gte)
        ? opts.gte + gen.num_positive
        : gen.any_num()
  });

const positive = mkContract({
  name: "positive",
  check: x => typeof x === "number" && x >= 0,
  generate: gen.num_positive
});

const fun = (args, ret) =>
  mkContract({
    name: "fun",
    options: [args, ret],
    check: x => typeof x === "function"
  });

const getter = (ret) => fun(null,ret)

const bool = mkContract({
  name: "fun",
  check: x => typeof x === "boolean",
  generate: gen.bool
});

const defined = mkContract({
  name: "defined",
  check: x => typeof x !== "undefined",
  generate: gen.any //todo check not undefined
});

const klass = cls =>
  mkContract({
    name: "klass",
    options: cls,
    check: x =>
      x.constructor.name === (typeof cls === "string" ? cls : cls.name),
    generate: cls.contract && gen.generate_class(cls)
  });

const promise = t =>
  mkContract({
    name: "promise",
    options: typeof t ==="undefined" ? any: t,
    check: x => x.constructor.name === Promise.name
  });

const obj = o =>
  mkContract({
    name: "obj",
    options: o,
    check: x =>
      typeof x === "object" &&
      Object.entries(o || {}).every(([k, v]) => v.check(x[k]))
  });

const num = mkContract({
  name: "num",
  check: x => typeof x === "number",
  generate: gen.any_num
});

const int = mkContract({
  name: "int",
  check: x => typeof x === "number" && Math.round(x) === x,
  generate: () => Math.round(gen.any_num())
});

const posint = mkContract({
  name: "posint",
  check: x => typeof x === "number" && Math.round(x) === x && x >= 0,
  generate: () => Math.round(gen.num_positive())
});

const str = mkContract({
  name: "str",
  check: x => typeof x === "string",
  generate: gen.string
});

const eq = v =>
  mkContract({
    name: "eq",
    options: v,
    check: x => x === v,
    generate: () => v
  });

const one_of = vs =>
  mkContract({
    name: "one_of",
    options: vs,
    check: x => vs.includes(x),
    generate: () => gen.oneOf(vs)
  });

const lte = v =>
  mkContract({
    name: "lte",
    options: v,
    check: x => x <= v
  });

const gte = v =>
  mkContract({
    name: "gte",
    options: v,
    check: x => x >= v
  });

const sat = f =>
  mkContract({
    name: "sat",
    options: f.toString(),
    check: x => f(x)
  });

const any = mkContract({
  name: "any",
  check: x => true,
  generate: gen.any
});

const maybe = c =>
  mkContract({
    name: `maybe(${c.contract_name})`,
    options: c,
    check: x => typeof x === "undefined" || c.check(x),
    generate: () => (gen.bool() ? undefined : gen.generate_from(c))
  });

const and = (...contrs) =>
  mkContract({
    name: `and(${contrs.map(c => c.contract_name).join()})`,
    get_error_message: x => {
      const failing = contrs.find(c => !c.check(x));
      return failing.options
        ? `${x} violates (in and) ${failing.contract_name}(${JSON.stringify(
            failing.options
          )})`
        : `${x} in and violates (in and) ${JSON.stringify(
            failing.contract_name
          )}`;
    },
    options: contrs,
    check: x => contrs.every(c => c.check(x)),
    generate:
      contrs.filter(c => c.generate).length > 0 && (() => and_gen(contrs))
  });

function and_gen(contrs) {
  const val = gen.oneOf(contrs.filter(c => c.generate)).generate();
  if (contrs.every(c => c.check(val))) return val;
  else return and_gen(contrs);
}

const or = (...contrs) =>
  mkContract({
    name: `or(${contrs.map(c => c.contract_name).join()})`,
    options: contrs,
    check: x => contrs.some(c => c.check(x)),
    generate:
      contrs.filter(c => c.generate).length > 0 &&
      (() => gen.oneOf(contrs.filter(c => c.generate)).generate())
  });

const xor = (...contrs) =>
  mkContract({
    name: `xor(${contrs.map(c => c.contract_name).join()})`,
    options: contrs,
    check: x => contrs.filter(c => c.check(x)).length === 1,
    //todo check only one is right in generate
    generate:
      contrs.filter(c => c.generate).length > 0 &&
      (() => gen.oneOf(contrs.filter(c => c.generate)).generate())
  });

const array = c =>
  mkContract({
    name: "array",
    options: c,
    check: vs => Array.isArray(vs) && vs.every(v => c.check(v)),
    generate: c.generate && gen.array(c.generate)
  });

module.exports = {
  number,
  eq,
  sat,
  and,
  num,
  str,
  lte,
  gte,
  fun,
  obj,
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
  getter
};
