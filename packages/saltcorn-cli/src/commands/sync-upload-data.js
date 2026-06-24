const { Command, Flags } = require("@oclif/core");
const path = require("path");
const { init_multi_tenant } = require("@saltcorn/data/db/state");
const User = require("@saltcorn/data/models/user");
const Table = require("@saltcorn/data/models/table");
const fs = require("fs").promises;
const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const Plugin = require("@saltcorn/data/models/plugin");

const pickFields = (table, pkName, row, keepId) => {
  const result = {};
  for (const { name, type, calculated } of table.getFields()) {
    if (
      (!keepId && name === pkName) ||
      calculated ||
      row[name] === undefined ||
      row[name] === null
    )
      continue;
    if (type?.name === "Date") {
      result[name] = row[name] ? new Date(row[name]) : undefined;
    } else if (type?.name === "JSON") {
      const val = row[name];
      if (typeof val === "string") {
        try {
          result[name] = JSON.parse(val);
        } catch (e) {
          result[name] = val;
        }
      } else {
        result[name] = val;
      }
    } else {
      result[name] = row[name];
    }
  }
  return result;
};

const defaultGetFKs = (tblName) => {
  const table = Table.findOne({ name: tblName });
  return table ? table.getForeignKeys() : [];
};

// Returns { sorted, cycleTables } where cycleTables are tables Kahn's could not place.
const kahnSort = (changes, getFKs = defaultGetFKs) => {
  const tableNames = Object.keys(changes);
  const tableSet = new Set(tableNames);
  const adj = {};
  const inDeg = {};
  for (const t of tableNames) {
    adj[t] = [];
    inDeg[t] = 0;
  }
  for (const tblName of tableNames) {
    for (const fk of getFKs(tblName)) {
      const parent = fk.reftable_name;
      if (tableSet.has(parent) && parent !== tblName) {
        adj[parent].push(tblName);
        inDeg[tblName]++;
      }
    }
  }
  const queue = tableNames.filter((t) => inDeg[t] === 0);
  const sorted = [];
  while (queue.length > 0) {
    const t = queue.shift();
    sorted.push(t);
    for (const child of adj[t]) {
      if (--inDeg[child] === 0) queue.push(child);
    }
  }
  const cycleTables = tableNames.filter((t) => !sorted.includes(t));
  return { sorted, cycleTables };
};

// Orders cycle tables for insert: nullable-FK side first, required-FK side last.
// deferFields holds the nullable cyclic FK fields to insert as null and fix up afterwards.
const orderCycleTables = (
  cycleTables,
  getTable = (name) => Table.findOne({ name })
) => {
  const cycleSet = new Set(cycleTables);
  const cycleOrder = [];
  // fields of table that need a post-UPDATE after all cycle rows exist
  const deferFields = new Map();
  const ordered = new Set();
  const remaining = new Set(cycleTables);

  while (remaining.size > 0) {
    let bestTable = null;
    let bestRequiredCount = Infinity;
    for (const tblName of remaining) {
      const table = getTable(tblName);
      if (!table) {
        remaining.delete(tblName);
        continue;
      }
      const fields = table.getFields();
      let requiredCount = 0;
      for (const fk of table.getForeignKeys()) {
        if (
          cycleSet.has(fk.reftable_name) &&
          !ordered.has(fk.reftable_name) &&
          fk.reftable_name !== tblName &&
          fields.find((f) => f.name === fk.name)?.required
        )
          requiredCount++;
      }
      if (requiredCount < bestRequiredCount) {
        bestRequiredCount = requiredCount;
        bestTable = tblName;
      }
    }
    if (!bestTable) break;
    const table = getTable(bestTable);
    if (table) {
      const fields = table.getFields();
      const deferred = new Set();
      for (const fk of table.getForeignKeys()) {
        if (
          cycleSet.has(fk.reftable_name) &&
          !ordered.has(fk.reftable_name) &&
          fk.reftable_name !== bestTable
        ) {
          const field = fields.find((f) => f.name === fk.name);
          if (field && !field.required) deferred.add(fk.name);
        }
      }
      if (deferred.size > 0) deferFields.set(bestTable, deferred);
    }
    cycleOrder.push(bestTable);
    ordered.add(bestTable);
    remaining.delete(bestTable);
  }

  return { cycleOrder, deferFields };
};

const checkConstraints = async (table, row) => {
  const uniques = table.constraints.filter((c) => c.type === "Unique");
  for (const { configuration } of uniques) {
    const where = {};
    for (const field of configuration.fields) {
      where[field] = row[field];
    }
    const conflictRow = await table.getRow(where);
    if (conflictRow) return conflictRow;
  }
  return null;
};

/**
 * internal helper class
 */
class SyncHelper {
  constructor(changes, oldSyncTimestamp, newSyncTimestamp, user, directory) {
    this.changes = changes;
    this.oldSyncTimestamp = oldSyncTimestamp;
    this.newSyncTimestamp = newSyncTimestamp;
    this.user = user;
    this.directory = directory;
    this.allTranslations = {};
    this.allUniqueConflicts = {};
    this.allDataConflicts = {};
    this.inTransaction = false;
  }

  async doSync() {
    let returnCode = 0;
    try {
      // db operations
      await db.begin();
      this.inTransaction = true;
      await this.applyInserts();
      await this.applyUpdates();
      await this.applyDeletes();
      await db.commit();

      // write output files
      await this.writeTranslatedIds();
      await this.writeUniqueConflicts();
      await this.writeDataConflicts();
    } catch (error) {
      returnCode = 1;
      getState().log(2, `Unable to sync: ${error.message}`);
      await this.writeErrorFile(error.message);
      if (this.inTransaction) await db.rollback();
    }
    return returnCode;
  }

  async applyInserts() {
    const { sorted, cycleTables } = kahnSort(this.changes);

    const { cycleOrder, deferFields } = orderCycleTables(cycleTables);

    const deferredUpdates = [];

    for (const tblName of [...sorted, ...cycleOrder]) {
      const vals = this.changes[tblName];
      if (!vals) continue;
      const table = Table.findOne({ name: tblName });
      if (!table) throw new Error(`The table '${tblName}' does not exists`);
      try {
        if (vals.inserts?.length > 0) {
          const pkName = table.pk_name;
          const translations = {};
          const uniqueConflicts = [];
          const pkField = table
            .getFields()
            .find((f) => f.name === pkName && !f.is_fkey);
          const pkHasClientDefault =
            typeof pkField?.type?.primaryKey?.default_js === "function";
          const deferred = deferFields.get(tblName) || new Set();
          for (const insert of vals.inserts || []) {
            // Keep the client-generated PK only for types that explicitly provide
            // a client-side default (e.g. UUID). For integer PKs the local ID may
            // collide with existing server IDs and must go through translation.
            const row = pickFields(
              table,
              pkName,
              insert,
              pkHasClientDefault && insert[pkName] != null
            );
            for (const fk of table.getForeignKeys()) {
              const oldVal = row[fk.name];
              if (oldVal) {
                if (deferred.has(fk.name)) {
                  // Cyclic nullable FK: insert null, fix up after all inserts.
                  row[fk.name] = null;
                } else {
                  const newVal =
                    this.allTranslations[fk.reftable_name]?.[oldVal];
                  if (newVal) row[fk.name] = newVal;
                }
              }
            }
            const conflictRow = await checkConstraints(table, row);
            if (!conflictRow) {
              const newId = await table.insertRow(
                row,
                this.user,
                undefined,
                true,
                this.newSyncTimestamp
              );
              if (!newId) throw new Error(`Unable to insert into ${tblName}`);
              for (const fieldName of deferred) {
                const localFkVal = insert[fieldName];
                if (localFkVal != null) {
                  const fk = table
                    .getForeignKeys()
                    .find((f) => f.name === fieldName);
                  deferredUpdates.push({
                    tblName,
                    pkName,
                    serverPk: newId,
                    fieldName,
                    reftable: fk.reftable_name,
                    localFkVal,
                  });
                }
              }
              if (newId !== insert[pkName])
                translations[insert[pkName]] = newId;
            } else {
              translations[insert[pkName]] = conflictRow[pkName];
              uniqueConflicts.push(conflictRow);
            }
          }
          this.allTranslations[tblName] = translations;
          this.allUniqueConflicts[tblName] = uniqueConflicts;
        }
      } catch (error) {
        throw new Error(table.normalise_error_message(error.message));
      }
    }

    // now that all cyclic rows exist, set values for the null UPDATES
    if (deferredUpdates.length > 0) {
      const schema = db.getTenantSchemaPrefix();
      for (const {
        tblName,
        pkName,
        serverPk,
        fieldName,
        reftable,
        localFkVal,
      } of deferredUpdates) {
        const refTrans = this.allTranslations[reftable] || {};
        const serverFkVal = refTrans[localFkVal] ?? localFkVal;
        await db.query(
          `UPDATE ${schema}"${db.sqlsanitize(tblName)}" SET "${db.sqlsanitize(
            fieldName
          )}" = $1 WHERE "${db.sqlsanitize(pkName)}" = $2`,
          [serverFkVal, serverPk]
        );
      }
    }
  }

  async applyUpdates() {
    for (const [tblName, vals] of Object.entries(this.changes)) {
      if (vals.updates?.length > 0) {
        const table = Table.findOne({ name: tblName });
        if (!table) throw new Error(`The table '${tblName}' does not exists`);
        try {
          const dataConflicts = [];
          const pkName = table.pk_name;
          const insertTranslations = this.allTranslations[tblName];

          const collected = [];
          for (const update of vals.updates) {
            const row = pickFields(table, pkName, update, true);
            if (insertTranslations?.[row[pkName]])
              row[pkName] = insertTranslations[row[pkName]];
            for (const fk of table.getForeignKeys()) {
              const oldVal = row[fk.name];
              if (oldVal) {
                const newVal = this.allTranslations[fk.reftable_name]?.[oldVal];
                if (newVal) row[fk.name] = newVal;
              }
            }
            collected.push(row);
          }

          const syncInfos = await table.latestSyncInfos(
            collected.map((row) => row[pkName])
          );
          const infoLookup = {};
          for (const info of syncInfos) {
            infoLookup[info.ref] = info;
          }

          for (const row of collected) {
            // check conflict on row level
            const incomingTimestamp = new Date(this.oldSyncTimestamp);
            const syncInfo = infoLookup[row[pkName]];
            if (syncInfo?.last_modified > incomingTimestamp) {
              const conflictUpdates = {
                id: row[pkName],
              };
              const currentRow = await table.getRow({ [pkName]: row[pkName] });
              for (const [field, ts] of Object.entries(
                syncInfo?.updated_fields || {}
              )) {
                if (row[field] !== undefined) {
                  const fieldTimestamp = new Date(ts);
                  if (incomingTimestamp < fieldTimestamp) {
                    // app-syncTimestamp is older than server-field-timestamp
                    conflictUpdates[field] = currentRow[field];
                    delete row[field];
                  }
                }
              }
              if (Object.keys(conflictUpdates).length > 1)
                dataConflicts.push(conflictUpdates);
            }

            const result = await table.updateRow(
              row,
              row[pkName],
              this.user,
              true,
              undefined,
              undefined,
              this.newSyncTimestamp
            );
            if (result)
              throw new Error(`Unable to update ${tblName}: ${result}`);
          }
          if (dataConflicts.length > 0)
            this.allDataConflicts[tblName] = dataConflicts;
        } catch (error) {
          throw new Error(table.normalise_error_message(error.message));
        }
      }
    }
  }

  async applyDeletes() {
    for (const [tblName, vals] of Object.entries(this.changes)) {
      const table = Table.findOne({ name: tblName });
      if (!table) throw new Error(`The table '${tblName}' does not exists`);
      const pkName = table.pk_name;
      if (vals.deletes?.length > 0) {
        const delIds = [];
        const latestInfos = await table.latestSyncInfos(
          vals.deletes.map((del) => del[pkName])
        );
        const refToInfo = {};
        for (const info of latestInfos) {
          refToInfo[info.ref] = info;
        }
        for (const del of vals.deletes) {
          const appTimestamp = new Date(del.last_modified);
          const info = refToInfo[del[pkName]];
          if (!info || appTimestamp >= info.last_modified)
            delIds.push(del[pkName]);
        }
        if (delIds.length > 0) {
          await table.deleteRows({ [pkName]: { in: delIds } }, this.user, true);
          if ((await table.countRows({ [pkName]: { in: delIds } })) !== 0)
            throw new Error(
              `Unable to delete in '${tblName}': Some rows were not deleted`
            );
        }
      }
    }
  }

  async writeTranslatedIds() {
    const writeName = path.join(this.directory, "translated-ids.out");
    await fs.writeFile(writeName, JSON.stringify(this.allTranslations));
    await fs.rename(
      writeName,
      path.join(this.directory, "translated-ids.json")
    );
  }

  async writeUniqueConflicts() {
    const writeName = path.join(this.directory, "unique-conflicts.out");
    await fs.writeFile(writeName, JSON.stringify(this.allUniqueConflicts));
    await fs.rename(
      writeName,
      path.join(this.directory, "unique-conflicts.json")
    );
  }

  async writeDataConflicts() {
    const writeName = path.join(this.directory, "data-conflicts.out");
    await fs.writeFile(writeName, JSON.stringify(this.allDataConflicts));
    await fs.rename(
      writeName,
      path.join(this.directory, "data-conflicts.json")
    );
  }

  async writeErrorFile(message) {
    const writeName = path.join(this.directory, "error.out");
    await fs.writeFile(writeName, JSON.stringify({ message }));
    await fs.rename(writeName, path.join(this.directory, "error.json"));
  }
}

/**
 * CLI command class
 */
class SyncUploadData extends Command {
  async run() {
    const { flags } = await this.parse(SyncUploadData);
    if (db.is_it_multi_tenant() && flags.tenantAppName) {
      await init_multi_tenant(Plugin.loadAllPlugins, true, [
        flags.tenantAppName,
      ]);
    }
    const fn = async () => {
      await Plugin.loadAllPlugins();
      const helper = new SyncHelper(
        JSON.parse(
          await fs.readFile(path.join(flags.directory, "changes.json"))
        ),
        flags.oldSyncTimestamp,
        flags.newSyncTimestamp,
        flags.userEmail
          ? await User.findOne({ email: flags.userEmail })
          : undefined,
        flags.directory
      );
      process.exit(await helper.doSync());
    };
    if (
      flags.tenantAppName &&
      flags.tenantAppName !== db.connectObj.default_schema
    ) {
      await db.runWithTenant(flags.tenantAppName, fn);
    } else {
      await fn();
    }
  }
}

SyncUploadData.description = "Runs a sync for data supplied by the mobile app";

SyncUploadData.flags = {
  tenantAppName: Flags.string({
    name: "tenant",
    string: "tenant",
    description: "Optional name of a tenant application",
  }),
  userEmail: Flags.string({
    name: "user email",
    string: "userEmail",
    description: "email of the user running the sync",
  }),
  directory: Flags.string({
    name: "directory",
    string: "directory",
    description: "directory name for input output data",
  }),
  newSyncTimestamp: Flags.integer({
    name: "newSyncTimestamp",
    string: "newSyncTimestamp",
    description: "new timestamp for the sync_info rows",
  }),
  oldSyncTimestamp: Flags.integer({
    name: "oldSyncTimestamp",
    string: "oldSyncTimestamp",
    description: "TODO",
  }),
};

module.exports = SyncUploadData;
module.exports.kahnSort = kahnSort;
module.exports.orderCycleTables = orderCycleTables;
