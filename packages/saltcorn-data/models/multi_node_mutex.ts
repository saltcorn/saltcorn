/**
 * Cross-node mutex, used by workflow steps and (via utils.ts's withLock)
 * run_js_code.
 *
 * Postgres: backed by advisory locks, held on a dedicated connection so the
 * lock's lifetime is just "acquired until released" - not tied to any
 * transaction. SQLite (always single-node): backed by an in-process
 * fallback.
 *
 * @category saltcorn-data
 * @module models/multi_node_mutex
 * @subcategory models
 */
import db from "../db/index.js";

// Own advisory-lock namespace, kept separate from the leader-election lock
// (serve.js, id 11565) so the two can't collide.
const MUTEX_CLASSID = 894213;

export const DEFAULT_TIMEOUT_MS = 30_000;

// SQLite fallback
const localLocksHeld: Set<string> = new Set();
const localLockWaiters: Map<string, Array<() => void>> = new Map();

const acquireLockLocally = async (name: string): Promise<void> => {
  while (localLocksHeld.has(name)) {
    await new Promise<void>((resolve) => {
      const waiters = localLockWaiters.get(name) || [];
      waiters.push(resolve);
      localLockWaiters.set(name, waiters);
    });
  }
  localLocksHeld.add(name);
};

const releaseLockLocally = (name: string): void => {
  localLocksHeld.delete(name);
  const next = localLockWaiters.get(name)?.shift();
  if (next) next();
};

// Clear lock_timeout before returning this connection to the pool, so it
// doesn't affect whoever reuses it next. Discard it instead if that fails.
const releaseClient = async (client: any): Promise<void> => {
  try {
    await client.query("RESET lock_timeout");
    client.release();
  } catch (e) {
    client.release(true);
  }
};

/**
 * A named lock that stays held until you release it, e.g. one workflow run
 * holding a lock across several steps. For a single critical section, use
 * the withLock() helper below instead.
 */
export class MultiNodeMutex {
  private lockConnections: Map<string, any> = new Map();

  /**
   * Acquire a lock that stays held until release() (or releaseAll()) is
   * called. Re-entrant: acquiring a name already held by this
   * MultiNodeMutex is a no-op.
   *
   * @param opts.timeoutMs - throw if the lock isn't acquired within this
   *   many milliseconds. Defaults to DEFAULT_TIMEOUT_MS if not given.
   */
  async acquire(
    name: string,
    opts: { timeoutMs?: number } = {}
  ): Promise<void> {
    if (this.lockConnections.has(name)) return;
    if (db.driverName !== "postgres") {
      await acquireLockLocally(name);
      this.lockConnections.set(name, true);
      return;
    }
    const client = await db.getClient();
    // not given at all -> bounded default; explicitly 0 -> wait forever
    const timeoutMs =
      opts.timeoutMs === undefined ||
      !Number.isFinite(opts.timeoutMs) ||
      opts.timeoutMs < 0
        ? DEFAULT_TIMEOUT_MS
        : Math.floor(opts.timeoutMs);
    try {
      await client.query("select set_config('lock_timeout', $1, false)", [
        String(timeoutMs),
      ]);
      await client.query("select pg_advisory_lock($1, hashtext($2))", [
        MUTEX_CLASSID,
        name,
      ]);
    } catch (e) {
      await releaseClient(client);
      throw e;
    }
    this.lockConnections.set(name, client);
  }

  /** Release a lock acquired with acquire(). No-op if not held. */
  async release(name: string): Promise<void> {
    const client = this.lockConnections.get(name);
    if (client === undefined) return;
    this.lockConnections.delete(name);
    if (db.driverName !== "postgres") {
      releaseLockLocally(name);
      return;
    }
    try {
      await client.query("select pg_advisory_unlock($1, hashtext($2))", [
        MUTEX_CLASSID,
        name,
      ]);
    } finally {
      await releaseClient(client);
    }
  }

  /**
   * Release every lock still held. Call in a finally block around a run's
   * execution so an error, finish, or pause never leaves a lock - and its
   * dedicated connection - stuck open. One lock failing to release doesn't
   * stop the rest from being attempted; any failures are thrown together
   * once all locks have been tried.
   */
  async releaseAll(): Promise<void> {
    const errors: unknown[] = [];
    for (const name of [...this.lockConnections.keys()]) {
      try {
        await this.release(name);
      } catch (e) {
        errors.push(e);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Failed to release one or more locks");
  }

  /**
   * Run fn() while holding an exclusive lock named `name`, released as soon
   * as fn() returns or throws.
   *
   * @param name - lock name; shared names are mutually exclusive across nodes
   * @param fn - critical section to run while the lock is held
   * @param opts.timeoutMs - see acquire()
   */
  async withLock<T>(
    name: string,
    fn: () => Promise<T>,
    opts: { timeoutMs?: number } = {}
  ): Promise<T> {
    await this.acquire(name, opts);
    try {
      return await fn();
    } finally {
      await this.release(name);
    }
  }
}
