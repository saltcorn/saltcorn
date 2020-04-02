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
  name: "number",
  check: x => typeof x === "number" && x > 0,
  generate: gen.num_positive
};

const fun = {
  name: "fun",
  check: x => typeof x === "function"
};

const bool = {
  name: "fun",
  check: x => typeof x === "boolean"
};

const obj = o => ({
  name: "obj",
  options: o,
  check: x => Object.entries(o).every(([k, v]) => v.check(x[k]))
});

const num = {
  name: "number",
  check: x => typeof x === "number",
  generate: gen.any_num
};

const str = {
  name: "str",
  check: x => typeof x === "string"
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
      ? `${x} violates (in and) ${failing.name}(${failing.options})`
      : `${x} in and violates (in and) ${failing.name}`;
  },
  options: contrs,
  check: x => contrs.every(c => c.check(x))
});

const or = (...contrs) => ({
  name: "or(" + contrs.map(c => c.name).join + ")",
  options: contrs,
  check: x => contrs.some(c => c.check(x))
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
  positive
};
