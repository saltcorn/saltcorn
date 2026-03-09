interface Assert {
  (value: unknown, message?: string | Error): asserts value;

  ok(value: unknown, message?: string | Error): asserts value;
  fail(message?: string | Error): never;
  equal(actual: unknown, expected: unknown, message?: string | Error): void;
  notEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  strictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
  notStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  notDeepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  deepStrictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
  notDeepStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  throws(fn: () => unknown, message?: string | Error): void;
  doesNotThrow(fn: () => unknown, message?: string | Error): void;
  rejects(fn: () => Promise<unknown>, message?: string | Error): Promise<void>;
  doesNotReject(fn: () => Promise<unknown>, message?: string | Error): Promise<void>;
  ifError(value: unknown): asserts value is null | undefined;
  match(value: string, regExp: RegExp, message?: string | Error): void;
  doesNotMatch(value: string, regExp: RegExp, message?: string | Error): void;
}

declare const assert: Assert;