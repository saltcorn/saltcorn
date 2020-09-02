const bool = () => Math.random() > 0.5;

const num_between = (lo, hi) => lo + Math.random() * (hi - lo);

const num_positive = () => Math.pow(10, num_between(-3, 8));

const any_num = () => (bool() ? num_positive() : -num_positive());

const generate_from = (contr) =>
  contr.generate ? contr.generate() : rejection_sample(contr);

const oneOf = (vs) => vs[Math.floor(Math.random() * vs.length)];

const ntimes = (n, f) => {
  var res = new Array(n);
  for (let index = 0; index < n; index++) {
    res[index] = f();
  }
  return res;
};

const char = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789";
  return oneOf(chars);
};

const string = () => {
  const n = Math.round(num_between(0, 15));
  return ntimes(n, char).join("");
};

const date = () => {
  const date = new Date();
  const add_days = Math.round(num_between(-400, 400));
  const add_hours = Math.round(num_between(-30, 30));
  date.setDate(date.getDate() + add_days);
  date.setHours(date.getHours() + add_hours);
  return date;
};

const array = (g) => () => {
  const n = Math.round(num_between(0, 20));
  return ntimes(n, g);
};

const konst = (x) => () => x;

const anyObj = () => {
  const n = Math.round(num_between(0, 10));
  var res = {};
  for (let index = 0; index < n; index++) {
    res[string()] = any();
  }
  return res;
};

const obj = (o) => () => {
  var res = {};
  Object.entries(o).forEach(([k, v]) => {
    res[k] = v.generate();
  });
  return res;
};

const any = () =>
  oneOf([
    bool,
    any_num,
    string,
    konst(undefined),
    konst(null),
    konst(() => any()),
    anyObj,
    date,
  ])();

const gen_arguments = (args) => {
  if (!args) return [];
  const argumentcs = Array.isArray(args) ? args : [args];
  return argumentcs.map((c) => generate_from(c));
};

const generate_class = (cls) => () => {
  const contr = cls.contract;
  const cargs = contr.constructs ? gen_arguments(contr.constructs) : [];
  const inst = new cls(...cargs);
  return inst;
};

const reject_if = (generator, pred) => () => {
  var x = generator();
  while (pred(x)) x = generator();
  return x;
};

const accept_if = (generator, pred) => () => {
  var x = generator();
  while (!pred(x)) x = generator();
  return x;
};

module.exports = {
  bool,
  num_between,
  num_positive,
  any_num,
  generate_from,
  oneOf,
  string,
  any,
  obj,
  array,
  generate_class,
  gen_arguments,
  reject_if,
  accept_if,
  date,
};
