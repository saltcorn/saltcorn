/**
 * Preload for node's built-in test runner: isolate each test process so test
 * files can run in parallel against the test database (instead of being
 * serialized by --test-concurrency=1).
 *
 * `node --test` runs each test file in its own child process, so we derive a
 * per-process identity from process.pid. This must happen via environment
 * variables *before* the db/state modules load, because state.ts captures
 * connectObj.default_schema once at module load (the per-tenant State
 * singleton is keyed by it), so mutating it afterwards is too late.
 *
 *  - Postgres: every Saltcorn query is schema-qualified via getTenantSchema(),
 *    which falls back to connectObj.default_schema. SALTCORN_DEFAULT_SCHEMA
 *    sets that, isolating each file; the reset_schema()/fixtures() each suite
 *    runs in beforeAll then creates the schema (drop_reset_schema does CREATE
 *    SCHEMA). Leftover schemas are dropped at suite start by the run-tests CLI.
 *
 *  - SQLite (no schemas): point the connection at a per-process db file so
 *    parallel files don't share a file.
 *
 * The run-tests CLI sets SQLITE_FILEPATH only when running on SQLite, so its
 * presence is a reliable signal for which backend we're on.
 */
if (process.env.SQLITE_FILEPATH) {
  const path = require("path");
  const os = require("os");
  process.env.SQLITE_FILEPATH = path.join(
    os.tmpdir(),
    `sctest_p${process.pid}.sqlite`
  );
} else {
  process.env.SALTCORN_DEFAULT_SCHEMA = "test_p" + process.pid;
}
