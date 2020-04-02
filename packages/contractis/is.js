const number = opts => ({
  name: "number",
  options: opts,
  check: x =>
    typeof x === "number" &&
    (typeof (opts || {}).lte === "number" ? x <= opts.lte : true) &&
    (typeof (opts || {}).gte === "number" ? x >= opts.gte : true)
});

const num = {
  name: "number",
  check: x => typeof x === "number"
};
const str = {
  name: "str",
  check: x => typeof x === "string"
};
const eq = v => ({
  name: "eq",
  options: v,
  check: x => x === v
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

module.exports = {
  number,
  eq,
  sat,
  and,
  num,
  str,
  lte,
  gte
};
