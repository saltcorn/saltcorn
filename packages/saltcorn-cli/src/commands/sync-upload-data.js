const { Command, Flags } = require("@oclif/core");
const path = require("path");
const { init_multi_tenant } = require("@saltcorn/data/db/state");
const User = require("@saltcorn/data/models/user");
const Table = require("@saltcorn/data/models/table");
const fs = require("fs").promises;
const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const { loadAllPlugins } = require("@saltcorn/server/load_plugins");

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
      await this.translateInsertFks();
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

  async translateInsertFks() {
    const schema = db.getTenantSchemaPrefix();
    const rowIds = (fk, targetTrans, tblName, pkName, changes) => {
      if (Object.keys(targetTrans || {}).length > 0) {
        const srcTrans = this.allTranslations[tblName] || {};
        // ids with a fk where the target was translated
        const insertIds = (changes.inserts || [])
          .filter((row) => targetTrans[row[fk.name]] !== undefined)
          .map((row) => srcTrans[row[pkName]] || row[pkName]);
        return insertIds;
      }
      return null;
    };

    for (const [tblName, changes] of Object.entries(this.changes)) {
      const table = Table.findOne({ name: tblName });
      if (!table) throw new Error(`The table '${tblName}' does not exists`);
      const pkName = table.pk_name;
      for (const fk of table.getForeignKeys()) {
        const targetTrans = this.allTranslations[fk.reftable_name];
        const ids = rowIds(fk, targetTrans, table.name, pkName, changes);
        if (ids?.length > 0) {
          for (const [from, to] of Object.entries(targetTrans)) {
            await db.query(
              `update ${schema}"${db.sqlsanitize(tblName)}" set "${db.sqlsanitize(
                fk.name
              )}" = ${to}
                where "${db.sqlsanitize(
                  fk.name
                )}" = ${from} and "${db.sqlsanitize(pkName)}" in (${ids.join(
                  ","
                )})`
            );
          }
        }
      }
    }
  }

  async applyInserts() {
    const schema = db.getTenantSchemaPrefix();
    for (const [tblName, vals] of Object.entries(this.changes)) {
      const table = Table.findOne({ name: tblName });
      if (!table) throw new Error(`The table '${tblName}' does not exists`);
      try {
        if (vals.inserts?.length > 0) {
          const pkName = table.pk_name;
          await db.query(
            `alter table ${schema}"${db.sqlsanitize(
              tblName
            )}" disable trigger all`
          );
          const translations = {};
          const uniqueConflicts = [];
          for (const insert of vals.inserts || []) {
            const row = pickFields(table, pkName, insert);
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
              else if (newId !== insert[pkName])
                translations[insert[pkName]] = newId;
            } else {
              translations[insert[pkName]] = conflictRow[pkName];
              uniqueConflicts.push(conflictRow);
            }
          }
          this.allTranslations[tblName] = translations;
          this.allUniqueConflicts[tblName] = uniqueConflicts;
          await db.query(
            `alter table ${schema}"${db.sqlsanitize(tblName)}" enable trigger all`
          );
        }
      } catch (error) {
        throw new Error(table.normalise_error_message(error.message));
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
      await init_multi_tenant(loadAllPlugins, true, [flags.tenantAppName]);
    }
    const fn = async () => {
      await loadAllPlugins();
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
