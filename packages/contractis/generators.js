const bool = () => Math.random() > 0.5;

const num_between = (lo, hi) => lo + Math.random() * (hi - lo);

const num_positive = () => Math.pow(10, num_between(-3, 8));

const any_num = () => (bool() ? num_positive() : -num_positive());

const generate_from = contr =>
  contr.generate ? contr.generate() : rejection_sample(contr);

const oneOf = vs => vs[Math.floor(Math.random() * vs.length)];

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

const array = g => () => {
  const n = Math.round(num_between(0, 20));
  return ntimes(n, g);
};

const konst = x => () => x;

const anyObj = () => {
  const n = Math.round(num_between(0, 10));
  var res = {};
  for (let index = 0; index < n; index++) {
    res[string()] = any();
  }
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
    anyObj
  ])();

module.exports = {
  bool,
  num_between,
  num_positive,
  any_num,
  generate_from,
  oneOf,
  string,
  any,
  array
};
