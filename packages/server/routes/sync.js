const { error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Router = require("express-promise-router");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");

const router = new Router();
module.exports = router;

/**
 * Send all rows from a user, so that they can be used in an offline session with the mobile app
 */
router.get(
  "/table_data",
  error_catcher(async (req, res) => {
    // TODO optimsie: hash over all rows or dynamic user specific
    // TODO public user
    // TODO split large data 10 000 rows?
    getState().log(
      4,
      `GET /sync/table_data user: '${req.user ? req.user.id : "public"}'`
    );
    const allTables = await Table.find();
    const result = {};
    const selectOpts = req.user ? { forUser: req.user } : { forPublic: true };
    for (const table of allTables) {
      const rows = await table.getRows({}, selectOpts);
      if (
        req.user &&
        table.name === "users" &&
        !rows.find((row) => row.id === req.user.id)
      ) {
        rows.push(await table.getRow({ id: req.user.id }));
      }
      result[table.name] = {
        rows:
          table.name !== "users"
            ? rows
            : rows.map(({ id, email, role_id, language, disabled }) => {
                return { id, email, role_id, language, disabled };
              }),
      };
    }
    res.json(result);
  })
);

const pickFields = (table, row) => {
  const result = {};
  for (const { name, type } of table.getFields()) {
    if (type?.name === "Date") {
      result[name] = row[name] ? new Date(row[name]) : undefined;
    } else {
      result[name] = row[name];
    }
  }
  return result;
};

const getChanges = (table, dbRow, appRow) => {
  const changes = {};
  for (const { name, type } of table.getFields()) {
    if (name !== "id") {
      const dbVal = dbRow[name];
      const appVal = appRow[name];
      let valHasChanged = false;
      if (type?.name === "Date") {
        valHasChanged = dbVal?.valueOf() !== appVal?.valueOf();
      } else {
        valHasChanged = dbVal !== appVal;
      }
      // TODO Float with decimal_places
      if (valHasChanged) {
        changes[name] = appRow[name];
      }
    }
  }
  return changes;
};

const allowUpdate = (table, row, user) => {
  const role = user?.role_id || 100;
  return table.min_role_write >= role || table.is_owner(user, row);
};

const allowInsert = (table, row, user) => {
  const role = user?.role_id || 100;
  return table.min_role_write >= role;
};

const syncRows = async (table, dbRows, appRows, user, dbClient) => {
  const dbRowsLookup = {};
  for (const row of dbRows) {
    dbRowsLookup[row.id] = row;
  }
  const translatedIds = [];
  for (const appRow of appRows.map((row) => pickFields(table, row))) {
    if (!appRow.id) continue;
    const dbRow = dbRowsLookup[appRow.id];
    if (dbRow) {
      const changes = getChanges(table, dbRow, appRow);
      if (Object.keys(changes).length > 0 && allowUpdate(table, dbRow, user)) {
        await db.update(table.name, changes, dbRow.id, { client: dbClient });
      }
    } else if (allowInsert(table, appRow, user)) {
      const idFromApp = appRow.id;
      delete appRow.id;
      const newId = await db.insert(table.name, appRow, { client: dbClient });
      if (newId !== idFromApp)
        translatedIds.push({ from: idFromApp, to: newId });
    } else {
      getState().log(
        3,
        `Skipping id: '${appRow.id}' from app of table '${table.name}'`
      );
    }
  }
  return translatedIds;
};

/**
 * Sync the database to the state of an offline session with the mobile app
 */
router.post(
  "/table_data",
  error_catcher(async (req, res) => {
    // TODO public user
    // TODO sqlite
    getState().log(
      4,
      `POST /sync/table_data user: '${req.user ? req.user.id : "public"}'`
    );
    const role = req.user ? req.user.role_id : 100;
    const client = db.isSQLite ? db : await db.getClient();
    const selectOpts = req.user ? { forUser: req.user } : { forPublic: true };
    try {
      await client.query("BEGIN");
      await client.query("SET CONSTRAINTS ALL DEFERRED");
      const translateIds = {};
      for (const [tblName, appRows] of Object.entries(req.body.data) || []) {
        if (tblName !== "users") {
          const table = Table.findOne({ name: tblName });
          if (table) {
            const dbRows =
              role <= table.min_role_write
                ? await table.getRows({}, selectOpts)
                : (await table.getRows({}, selectOpts)).filter((row) =>
                    table.is_owner(req.user, row)
                  );
            const translated = await syncRows(
              table,
              dbRows,
              appRows,
              req.user,
              client
            );
            if (translated.length > 0) translateIds[tblName] = translated;
          }
        }
      }
      await client.query("COMMIT");
      if (!db.isSQLite) await client.release(true);
      res.json({ translateIds });
    } catch (error) {
      await client.query("ROLLBACK");
      getState().log(2, `POST /sync/table_data error: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);
