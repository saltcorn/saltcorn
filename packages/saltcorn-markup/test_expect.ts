/**
 * Minimal jest-compatible `expect` shim backed by node:assert, so the test
 * suites can run on node's built-in test runner without a jest dependency.
 * Only the matchers used by this package's tests are implemented.
 */
import assert from "node:assert";

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

  toBe(expected: any): void {
    if (this.isNot) assert.notStrictEqual(this.actual, expected);
    else assert.strictEqual(this.actual, expected);
  }

  toEqual(expected: any): void {
    if (this.isNot) assert.notDeepStrictEqual(this.actual, expected);
    else assert.deepStrictEqual(this.actual, expected);
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

export const expect = (actual: any): Expectation => new Expectation(actual);
