/**
 * Preload for node's built-in test runner: isolate each test process so test
 * files can run in parallel against the test database (instead of being
 * serialized by --test-concurrency=1).
 *
 * `node --test` runs each test file in its own child process, so we derive a
 * per-process identity from process.pid:
 *
 *  - Postgres: every Saltcorn query is schema-qualified via getTenantSchema(),
 *    which falls back to connectObj.default_schema when no tenant is set in
 *    async-local storage. Setting a pid-derived default_schema isolates each
 *    file; resetToFixtures() (called in each suite's beforeAll) then creates
 *    the schema, since reset() -> drop_reset_schema() does CREATE SCHEMA.
 *    Leftover schemas are dropped at suite start by the run-tests CLI.
 *
 *  - SQLite (no schemas): point the connection at a per-process db file before
 *    the db module reads SQLITE_FILEPATH, so parallel files don't share a file.
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
}

const db = require("@saltcorn/data/db");
if (!db.isSQLite) {
  db.connectObj.default_schema = "test_p" + process.pid;
}
