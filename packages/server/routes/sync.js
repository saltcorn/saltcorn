const { error_catcher } = require("./utils.js");
const Router = require("express-promise-router");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");

const router = new Router();
module.exports = router;

const pickFields = (table, row) => {
  const result = {};
  for (const { name, type } of table.getFields()) {
    if (name === "id") continue;
    if (type?.name === "Date") {
      result[name] = row[name] ? new Date(row[name]) : undefined;
    } else {
      result[name] = row[name];
    }
  }
  return result;
};

const allowInsert = (table, user) => {
  const role = user?.role_id || 100;
  return table.min_role_write >= role;
};

const throwWithCode = (message, code) => {
  const err = new Error(message);
  err.statusCode = code;
  throw err;
};

/**
 * insert the offline data uploaded by the mobile-app
 */
router.post(
  "/table_data",
  error_catcher(async (req, res) => {
    // TODO sqlite
    getState().log(
      4,
      `POST /sync/table_data user: '${req.user ? req.user.id : "public"}'`
    );
    let aborted = false;
    req.socket.on("close", () => {
      aborted = true;
    });
    req.socket.on("timeout", () => {
      aborted = true;
    });
    const client = db.isSQLite ? db : await db.getClient();
    try {
      await client.query("BEGIN");
      await client.query("SET CONSTRAINTS ALL DEFERRED");
      for (const [tblName, offlineRows] of Object.entries(req.body.data) ||
        []) {
        const table = Table.findOne({ name: tblName });
        if (!table) throw new Error(`The table '${tblName}' does not exist.`);
        if (!allowInsert(table, req.user))
          throwWithCode(req.__("Not authorized"), 401);
        if (tblName !== "users") {
          for (const newRow of offlineRows.map((row) =>
            pickFields(table, row)
          )) {
            if (aborted) throw new Error("connection closed by client");
            await db.insert(table.name, newRow, { client: client });
          }
        }
      }
      if (aborted) throw new Error("connection closed by client");
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      getState().log(2, `POST /sync/table_data error: '${error.message}'`);
      res
        .status(error.statusCode || 400)
        .json({ error: error.message || error });
    } finally {
      if (!db.isSQLite) await client.release(true);
    }
  })
);
