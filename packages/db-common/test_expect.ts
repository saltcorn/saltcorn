/**
 * Minimal jest-compatible `expect` shim backed by node:assert, so test suites
 * can run on node's built-in test runner without a jest dependency. Lives in
 * db-common so it can be shared across packages via
 * `import { expect } from "@saltcorn/db-common/test_expect"`.
 * Only the matchers used by the migrated test suites are implemented.
 */
import assert from "node:assert";

const deepEqual = (a: any, b: any): boolean => {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
};

// Asymmetric matcher, returned by expect.arrayContaining and recognised by
// toEqual/toStrictEqual.
class ArrayContaining {
  readonly sample: any[];
  constructor(sample: any[]) {
    this.sample = sample;
  }
}

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

  private assertPass(pass: boolean, message: string): void {
    assert.ok(this.isNot ? !pass : pass, message);
  }

  private deepEqualAssert(expected: any): void {
    if (expected instanceof ArrayContaining) {
      const pass =
        Array.isArray(this.actual) &&
        expected.sample.every((e) =>
          this.actual.some((a: any) => deepEqual(a, e))
        );
      this.assertPass(
        pass,
        `expected ${JSON.stringify(this.actual)} to contain all of ${JSON.stringify(
          expected.sample
        )}`
      );
      return;
    }
    if (this.isNot) assert.notDeepStrictEqual(this.actual, expected);
    else assert.deepStrictEqual(this.actual, expected);
  }

  toBe(expected: any): void {
    if (this.isNot) assert.notStrictEqual(this.actual, expected);
    else assert.strictEqual(this.actual, expected);
  }

  toEqual(expected: any): void {
    this.deepEqualAssert(expected);
  }

  toStrictEqual(expected: any): void {
    this.deepEqualAssert(expected);
  }

  toContain(expected: any): void {
    const pass =
      (typeof this.actual === "string" || Array.isArray(this.actual)) &&
      this.actual.includes(expected);
    this.assertPass(
      pass,
      `expected ${JSON.stringify(this.actual)} to contain ${JSON.stringify(
        expected
      )}`
    );
  }

  toMatch(expected: RegExp | string): void {
    const pass =
      typeof expected === "string"
        ? String(this.actual).includes(expected)
        : expected.test(this.actual);
    this.assertPass(
      pass,
      `expected ${JSON.stringify(String(this.actual))} to match ${expected}`
    );
  }

  toHaveLength(length: number): void {
    this.assertPass(
      this.actual != null && this.actual.length === length,
      `expected length ${this.actual?.length} to be ${length}`
    );
  }
}

interface ExpectFn {
  (actual: any): Expectation;
  arrayContaining: (sample: any[]) => ArrayContaining;
}

export const expect = ((actual: any) => new Expectation(actual)) as ExpectFn;
expect.arrayContaining = (sample: any[]) => new ArrayContaining(sample);
