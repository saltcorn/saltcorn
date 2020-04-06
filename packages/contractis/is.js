const gen = require("./generators");

isnum = x => typeof x === "number";

const number = opts => ({
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

const positive = {
  name: "positive",
  check: x => typeof x === "number" && x >= 0,
  generate: gen.num_positive
};

const fun = (args, ret) => ({
  name: "fun",
  options: [args, ret],
  check: x => typeof x === "function"
});

const bool = {
  name: "fun",
  check: x => typeof x === "boolean",
  generate: gen.bool
};

const klass = cls => ({
  name: "klass",
  options: cls,
  check: x => x.constructor.name === (typeof cls === "string" ? cls : cls.name)
});

const promise = t => ({
  name: "promise",
  options: t,
  check: x => x.constructor.name === Promise.name
});

const obj = o => ({
  name: "obj",
  options: o,
  check: x =>
    typeof x === "object" &&
    Object.entries(o || {}).every(([k, v]) => v.check(x[k]))
});

const num = {
  name: "number",
  check: x => typeof x === "number",
  generate: gen.any_num
};

const int = {
  name: "int",
  check: x => typeof x === "number" && Math.round(x) === x,
  generate: () => Math.round(gen.any_num())
};

const posint = {
  name: "posint",
  check: x => typeof x === "number" && Math.round(x) === x && x >= 0,
  generate: () => Math.round(gen.num_positive())
};

const str = {
  name: "str",
  check: x => typeof x === "string",
  generate: gen.string
};

const eq = v => ({
  name: "eq",
  options: v,
  check: x => x === v,
  generate: () => v
});

const lte = v => ({
  name: "lte",
  options: v,
  check: x => x <= v
});

const gte = v => ({
  name: "gte",
  options: v,
  check: x => x >= v
});

const sat = f => ({
  name: "sat",
  options: f.toString(),
  check: x => f(x)
});

const any = {
  name: "any",
  check: x => true
};

const maybe = c => ({
  name: "maybe",
  options: c,
  check: x => typeof x === "undefined" || c.check(x),
  generate: () => (gen.bool() ? undefined : gen.generate_from(c))
});

const and = (...contrs) => ({
  name: "and(" + contrs.map(c => c.name).join + ")",
  get_error_message: x => {
    const failing = contrs.find(c => !c.check(x));
    return failing.options
      ? `${x} violates (in and) ${failing.name}(${JSON.stringify(
          failing.options
        )})`
      : `${x} in and violates (in and) ${JSON.stringify(failing.name)}`;
  },
  options: contrs,
  check: x => contrs.every(c => c.check(x))
});
function log_it(x) {
  console.log(x)
  return x
}

const or = (...contrs) => ({
  name: "or(" + contrs.map(c => c.name).join + ")",
  options: contrs,
  check: x => contrs.some(c => c.check(x)),
  generate: contrs.filter(c=>c.generate).length>0 && 
    gen.oneOf(contrs.filter(c=>c.generate))  
});

const array = c => ({
  name: "array",
  options: c,
  check: vs => Array.isArray(vs) && vs.every(v => c.check(v))
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
  maybe,
  array,
  bool,
  positive,
  klass,
  any,
  int,
  posint,
  promise
};
