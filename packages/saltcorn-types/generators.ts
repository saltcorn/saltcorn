export const num_between = (lo: number, hi: number) =>
  lo + Math.random() * (hi - lo);

export const oneOf = (vs: NonNullable<any>) =>
  vs[Math.floor(Math.random() * vs.length)];

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

export const generateString = (
  minLength: number = 0,
  excludes?: string[]
): string => {
  const n = Math.round(num_between(minLength, 15));
  let result = ntimes(n, char).join("");
  if (excludes && excludes.includes(result))
    return generateString(minLength, excludes);
  return result;
};

export const generateBool = () => Math.random() > 0.5;

// default export keeps the existing `import generators from
// "@saltcorn/types/generators"` call sites working; the named exports above
// keep `import { generateString } from ...` and CJS destructuring working.
export default {
  generateBool,
  num_between,
  oneOf,
  generateString,
};
