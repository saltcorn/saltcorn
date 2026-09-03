/**
 * Random test-data generators, used by field types' `presets`/fuzz tests.
 * @category saltcorn-types
 * @module generators
 */

/**
 * A random number between lo and hi.
 * @param lo - lower bound (inclusive)
 * @param hi - upper bound (exclusive)
 * @returns a random number in [lo, hi)
 */
export const num_between = (lo: number, hi: number) =>
  lo + Math.random() * (hi - lo);

/**
 * A random element of an array-like value.
 * @param vs - the array-like value to pick from
 * @returns a randomly chosen element of vs
 */
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

/**
 * A random alphanumeric string, at least minLength characters, never one of excludes.
 * @param minLength - shortest string to allow (default 0)
 * @param excludes - values that must not be returned; a match is retried
 * @returns the generated string
 */
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

/**
 * A random boolean.
 * @returns true or false with equal probability
 */
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
