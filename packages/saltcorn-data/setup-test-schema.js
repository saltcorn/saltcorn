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
 *  - File store (both backends): the file store lives on disk, outside the
 *    database, so it must be isolated too. Otherwise parallel suites read and
 *    write the same shared directory: one suite's fixtures create/delete files
 *    (e.g. rick.png) while another suite's File.find() is listing the folder,
 *    so readdir() lists a name that stat() then can't find - File.find throws
 *    "File not found". A per-process store removes the cross-suite race.
 *
 * The run-tests CLI sets SQLITE_FILEPATH only when running on SQLite, so its
 * presence is a reliable signal for which backend we're on.
 */
const path = require("path");
const os = require("os");
if (process.env.SQLITE_FILEPATH) {
  process.env.SQLITE_FILEPATH = path.join(
    os.tmpdir(),
    `sctest_p${process.pid}.sqlite`
  );
} else {
  process.env.SALTCORN_DEFAULT_SCHEMA = "test_p" + process.pid;
}
process.env.SALTCORN_FILE_STORE = path.join(
  os.tmpdir(),
  `sctest_filestore_p${process.pid}`
);
