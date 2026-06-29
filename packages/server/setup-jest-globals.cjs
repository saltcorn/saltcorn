/**
 * Preload module for node's built-in test runner (`node --test`).
 *
 * The server tests were written for jest, which provides `describe`, `it`,
 * `test`, `expect`, `beforeAll`/`afterAll`/`beforeEach`/`afterEach` and `jest`
 * as globals. This file is loaded with `--require` before each test file (the
 * test runner forwards preloads to the child process it spawns per file) and
 * installs the same names as globals, backed by the jest-compatible shim that
 * db-common exports over node:assert and node:test.
 */
const shim = require("@saltcorn/db-common/test_expect");

const globals = [
  "describe",
  "it",
  "test",
  "expect",
  "beforeAll",
  "afterAll",
  "beforeEach",
  "afterEach",
  "jest",
];
for (const name of globals) globalThis[name] = shim[name];
