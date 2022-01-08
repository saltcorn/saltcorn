const num_between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

const oneOf = (vs: any) => vs[Math.floor(Math.random() * vs.length)];

const char = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789";
  return oneOf(chars);
};

const ntimes = (n: number, f: Function) => {
  var res = new Array(n);
  for (let index = 0; index < n; index++) {
    res[index] = f();
  }
  return res;
};

const generateString = () => {
  const n = Math.round(num_between(0, 15));
  return ntimes(n, char).join("");
};

export = {
  num_between,
  oneOf,
  generateString,
};
