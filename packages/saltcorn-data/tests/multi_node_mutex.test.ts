import {
  MultiNodeMutex,
  DEFAULT_TIMEOUT_MS,
} from "../models/multi_node_mutex.js";
import db from "../db/index.js";
import {
  afterAll,
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@saltcorn/db-common/test_expect";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
import { sleep } from "../utils.js";

afterAll(db.close);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
});

jest.setTimeout(10000);

describe("MultiNodeMutex timeouts", () => {
  it("has a 30s default timeout", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30000);
  });

  it("fails with an explicit short timeout while another instance holds the lock", async () => {
    const holder = new MultiNodeMutex();
    await holder.acquire("test-timeout-short");
    try {
      const waiter = new MultiNodeMutex();
      let err: any = null;
      try {
        await waiter.acquire("test-timeout-short", { timeoutMs: 200 });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(String(err?.message || err)).toMatch(/lock timeout/i);
    } finally {
      await holder.release("test-timeout-short");
    }
  });

  // The holder releases after 500ms - long enough that the 200ms case
  // above would already have failed - proving timeoutMs: 0 genuinely
  // waits it out instead of also failing fast.
  it("timeoutMs: 0 waits for the lock instead of failing fast", async () => {
    const holder = new MultiNodeMutex();
    await holder.acquire("test-timeout-zero");

    const waiter = new MultiNodeMutex();
    const waitPromise = waiter.acquire("test-timeout-zero", { timeoutMs: 0 });

    await sleep(500);
    await holder.release("test-timeout-zero");

    await waitPromise;
    await waiter.release("test-timeout-zero");
  });
});
