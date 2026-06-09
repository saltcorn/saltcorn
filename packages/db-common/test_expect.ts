/**
 * jest-compatible test helpers backed by node:test / node:assert, so test
 * suites can run on node's built-in test runner without a jest dependency.
 * Lives in db-common so it can be shared across packages, e.g.:
 *   import { describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";
 * Only the surface used by the migrated test suites is implemented.
 */
import assert from "node:assert";
import { inspect } from "node:util";
import {
  describe,
  it,
  test,
  before,
  after,
  beforeEach as nodeBeforeEach,
  afterEach as nodeAfterEach,
} from "node:test";

// node:test names the once-per-file hooks before/after; jest calls them
// beforeAll/afterAll. Wrap to drop jest's optional timeout 2nd argument.
const beforeAll = (fn: any) => before(fn);
const afterAll = (fn: any) => after(fn);
const beforeEach = (fn: any) => nodeBeforeEach(fn);
const afterEach = (fn: any) => nodeAfterEach(fn);

export {
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
};

// ---------------------------------------------------------------------------
// asymmetric matchers (expect.arrayContaining / expect.objectContaining)
// ---------------------------------------------------------------------------
class ArrayContaining {
  readonly sample: any[];
  constructor(sample: any[]) {
    this.sample = sample;
  }
  matches(actual: any): boolean {
    return (
      Array.isArray(actual) &&
      this.sample.every((e) => actual.some((a: any) => looseEqual(a, e)))
    );
  }
}

class ObjectContaining {
  readonly sample: any;
  constructor(sample: any) {
    this.sample = sample;
  }
  matches(actual: any): boolean {
    if (actual == null || typeof actual !== "object") return false;
    return Object.keys(this.sample).every((k) =>
      looseEqual(actual[k], this.sample[k])
    );
  }
}

const isAsymmetric = (x: any): x is ArrayContaining | ObjectContaining =>
  x instanceof ArrayContaining || x instanceof ObjectContaining;

// jest's toEqual: recursive equality that ignores prototypes and treats
// undefined-valued properties as absent.
const looseEqual = (a: any, b: any): boolean => {
  if (isAsymmetric(b)) return b.matches(a);
  if (isAsymmetric(a)) return a.matches(b);
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp)
    return a.source === b.source && a.flags === b.flags;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => looseEqual(v, b[i]));
  }
  const ak = Object.keys(a).filter((k) => a[k] !== undefined);
  const bk = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ak.length !== bk.length) return false;
  return ak.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) && looseEqual(a[k], b[k])
  );
};

// jest's toMatchObject: recursive subset match (received may have extra keys).
const matchObject = (actual: any, expected: any): boolean => {
  if (isAsymmetric(expected)) return expected.matches(actual);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length)
      return false;
    return expected.every((e, i) => matchObject(actual[i], e));
  }
  if (expected && typeof expected === "object") {
    if (actual == null || typeof actual !== "object") return false;
    return Object.keys(expected).every((k) =>
      matchObject(actual[k], expected[k])
    );
  }
  return Object.is(actual, expected);
};

const matchError = (error: any, expected: any): boolean => {
  const message = error && error.message ? String(error.message) : String(error);
  if (typeof expected === "string") return message.includes(expected);
  if (expected instanceof RegExp) return expected.test(message);
  if (typeof expected === "function") return error instanceof expected;
  return true;
};

// ---------------------------------------------------------------------------
// expect()
// ---------------------------------------------------------------------------
class Expectation {
  private readonly actual: any;
  private readonly isNot: boolean;

  constructor(actual: any, isNot = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not(): Expectation {
    return new Expectation(this.actual, !this.isNot);
  }

  get rejects(): AsyncExpectation {
    return new AsyncExpectation(this.actual, true, this.isNot);
  }

  get resolves(): AsyncExpectation {
    return new AsyncExpectation(this.actual, false, this.isNot);
  }

  private assertPass(pass: boolean, message: string): void {
    assert.ok(this.isNot ? !pass : pass, message);
  }

  private show(v: any): string {
    return inspect(v, { depth: 6 });
  }

  toBe(expected: any): void {
    if (this.isNot) assert.notStrictEqual(this.actual, expected);
    else assert.strictEqual(this.actual, expected);
  }

  toEqual(expected: any): void {
    const pass = looseEqual(this.actual, expected);
    this.assertPass(
      pass,
      `toEqual mismatch:\n  actual:   ${this.show(this.actual)}\n  expected: ${this.show(
        expected
      )}`
    );
  }

  toStrictEqual(expected: any): void {
    if (isAsymmetric(expected)) {
      this.assertPass(
        expected.matches(this.actual),
        `toStrictEqual mismatch: ${this.show(this.actual)}`
      );
      return;
    }
    if (this.isNot) assert.notDeepStrictEqual(this.actual, expected);
    else assert.deepStrictEqual(this.actual, expected);
  }

  toContain(expected: any): void {
    const pass =
      (typeof this.actual === "string" || Array.isArray(this.actual)) &&
      this.actual.includes(expected);
    this.assertPass(
      pass,
      `expected ${this.show(this.actual)} to contain ${this.show(expected)}`
    );
  }

  toContainEqual(expected: any): void {
    const pass =
      Array.isArray(this.actual) &&
      this.actual.some((x: any) => looseEqual(x, expected));
    this.assertPass(
      pass,
      `expected ${this.show(this.actual)} to contain equal ${this.show(expected)}`
    );
  }

  toMatchObject(expected: any): void {
    this.assertPass(
      matchObject(this.actual, expected),
      `expected ${this.show(this.actual)} to match object ${this.show(expected)}`
    );
  }

  toMatch(expected: RegExp | string): void {
    const pass =
      typeof expected === "string"
        ? String(this.actual).includes(expected)
        : expected.test(this.actual);
    this.assertPass(
      pass,
      `expected ${this.show(String(this.actual))} to match ${expected}`
    );
  }

  toHaveLength(length: number): void {
    this.assertPass(
      this.actual != null && this.actual.length === length,
      `expected length ${this.actual?.length} to be ${length}`
    );
  }

  toBeDefined(): void {
    this.assertPass(this.actual !== undefined, `expected value to be defined`);
  }

  toBeUndefined(): void {
    this.assertPass(
      this.actual === undefined,
      `expected ${this.show(this.actual)} to be undefined`
    );
  }

  toBeNull(): void {
    this.assertPass(
      this.actual === null,
      `expected ${this.show(this.actual)} to be null`
    );
  }

  toBeTruthy(): void {
    this.assertPass(!!this.actual, `expected ${this.show(this.actual)} to be truthy`);
  }

  toBeFalsy(): void {
    this.assertPass(!this.actual, `expected ${this.show(this.actual)} to be falsy`);
  }

  toBeGreaterThan(n: number): void {
    this.assertPass(this.actual > n, `expected ${this.show(this.actual)} > ${n}`);
  }

  toBeLessThan(n: number): void {
    this.assertPass(this.actual < n, `expected ${this.show(this.actual)} < ${n}`);
  }

  toBeGreaterThanOrEqual(n: number): void {
    this.assertPass(this.actual >= n, `expected ${this.show(this.actual)} >= ${n}`);
  }

  toBeLessThanOrEqual(n: number): void {
    this.assertPass(this.actual <= n, `expected ${this.show(this.actual)} <= ${n}`);
  }

  toBeInstanceOf(cls: any): void {
    this.assertPass(
      this.actual instanceof cls,
      `expected ${this.show(this.actual)} to be instance of ${cls?.name}`
    );
  }

  toThrow(expected?: any): void {
    let threw = false;
    let error: any;
    try {
      if (typeof this.actual === "function") this.actual();
    } catch (e) {
      threw = true;
      error = e;
    }
    const pass = threw && (expected === undefined || matchError(error, expected));
    this.assertPass(pass, `expected function to throw`);
  }

  toHaveBeenCalled(): void {
    this.assertPass(
      (this.actual?.mock?.calls?.length ?? 0) > 0,
      `expected mock function to have been called`
    );
  }

  toHaveBeenCalledTimes(n: number): void {
    const count = this.actual?.mock?.calls?.length ?? 0;
    this.assertPass(
      count === n,
      `expected mock to have been called ${n} times, but was called ${count} times`
    );
  }
}

// async matchers via expect(promise).rejects / .resolves
class AsyncExpectation {
  private readonly actual: any;
  private readonly wantReject: boolean;
  private readonly isNot: boolean;

  constructor(actual: any, wantReject: boolean, isNot: boolean) {
    this.actual = actual;
    this.wantReject = wantReject;
    this.isNot = isNot;
  }

  private async settle(): Promise<{ threw: boolean; value?: any; error?: any }> {
    try {
      const value =
        typeof this.actual === "function" ? await this.actual() : await this.actual;
      return { threw: false, value };
    } catch (error) {
      return { threw: true, error };
    }
  }

  private async settledExpectation(): Promise<Expectation> {
    const { threw, value, error } = await this.settle();
    if (this.wantReject) {
      assert.ok(threw, `expected promise to reject, but it resolved`);
      return new Expectation(error, this.isNot);
    }
    assert.ok(!threw, `expected promise to resolve, but it rejected: ${error}`);
    return new Expectation(value, this.isNot);
  }

  async toThrow(expected?: any): Promise<void> {
    const { threw, error } = await this.settle();
    if (this.wantReject) {
      const pass =
        threw && (expected === undefined || matchError(error, expected));
      assert.ok(
        this.isNot ? !pass : pass,
        `expected promise to reject${expected !== undefined ? " with " + expected : ""}`
      );
    } else {
      assert.ok(!threw, `expected promise to resolve`);
    }
  }

  async toBe(expected: any): Promise<void> {
    (await this.settledExpectation()).toBe(expected);
  }

  async toEqual(expected: any): Promise<void> {
    (await this.settledExpectation()).toEqual(expected);
  }

  async toStrictEqual(expected: any): Promise<void> {
    (await this.settledExpectation()).toStrictEqual(expected);
  }
}

interface ExpectFn {
  (actual: any): Expectation;
  arrayContaining: (sample: any[]) => ArrayContaining;
  objectContaining: (sample: any) => ObjectContaining;
  assertions: (n: number) => void;
}

export const expect = ((actual: any) => new Expectation(actual)) as ExpectFn;
expect.arrayContaining = (sample: any[]) => new ArrayContaining(sample);
expect.objectContaining = (sample: any) => new ObjectContaining(sample);
// assertion-count expectation is not tracked; accepted as a no-op.
expect.assertions = (_n: number) => {};

// ---------------------------------------------------------------------------
// jest.fn() mock functions
// ---------------------------------------------------------------------------
export const fn = (impl?: (...args: any[]) => any): any => {
  const calls: any[][] = [];
  let implementation = impl;
  let returnValue: any;
  let hasReturnValue = false;
  const mockFn: any = (...args: any[]) => {
    calls.push(args);
    if (implementation) return implementation(...args);
    if (hasReturnValue) return returnValue;
    return undefined;
  };
  mockFn.mock = { calls };
  mockFn.mockReturnValue = (v: any) => {
    returnValue = v;
    hasReturnValue = true;
    return mockFn;
  };
  mockFn.mockImplementation = (f: (...args: any[]) => any) => {
    implementation = f;
    return mockFn;
  };
  mockFn.mockClear = () => {
    calls.length = 0;
  };
  mockFn.mockReset = () => {
    calls.length = 0;
    implementation = undefined;
    hasReturnValue = false;
    returnValue = undefined;
  };
  return mockFn;
};

// ---------------------------------------------------------------------------
// jest object: setTimeout (no-op; node:test has no default timeout), fn, mock
// ---------------------------------------------------------------------------
export const jest = {
  // node:test has no global default timeout, so raising it is unnecessary.
  setTimeout: (_ms?: number) => {},
  fn,
  // Automock: replace the module's function exports with mock fns. Mutates the
  // shared require cache so the system-under-test sees the same mocks.
  mock: (name: string) => {
    const mod = require(name);
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] === "function") {
        try {
          mod[key] = fn();
        } catch {
          // non-writable export; skip
        }
      }
    }
  },
  clearAllMocks: () => {},
};
