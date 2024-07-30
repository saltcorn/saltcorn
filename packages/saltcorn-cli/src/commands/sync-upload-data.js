const { Command, flags } = require("@oclif/command");
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

const translateInsertFks = async (allChanges, allTranslations) => {
  const schema = db.getTenantSchemaPrefix();
  const rowIds = (fk, targetTrans, tblName, pkName, changes) => {
    if (Object.keys(targetTrans || {}).length > 0) {
      const srcTrans = allTranslations[tblName] || {};
      // ids with a fk where the target was translated
      const insertIds = (changes.inserts || [])
        .filter((row) => targetTrans[row[fk.name]] !== undefined)
        .map((row) => srcTrans[row[pkName]] || row[pkName]);
      return insertIds;
    }
    return null;
  };

  for (const [tblName, changes] of Object.entries(allChanges)) {
    const table = Table.findOne({ name: tblName });
    if (!table) throw new Error(`The table '${tblName}' does not exists`);
    const pkName = table.pk_name;
    for (const fk of table.getForeignKeys()) {
      const targetTrans = allTranslations[fk.reftable_name];
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

const applyInserts = async (changes, syncTimestamp, user) => {
  const schema = db.getTenantSchemaPrefix();
  const allTranslations = {};
  const allUniqueConflicts = {};
  for (const [tblName, vals] of Object.entries(changes)) {
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
              user,
              undefined,
              true,
              syncTimestamp
            );
            if (!newId) throw new Error(`Unable to insert into ${tblName}`);
            else if (newId !== insert[pkName])
              translations[insert[pkName]] = newId;
          } else {
            translations[insert[pkName]] = conflictRow[pkName];
            uniqueConflicts.push(conflictRow);
          }
        }
        allTranslations[tblName] = translations;
        allUniqueConflicts[tblName] = uniqueConflicts;
        await db.query(
          `alter table ${schema}"${db.sqlsanitize(tblName)}" enable trigger all`
        );
      }
    } catch (error) {
      throw new Error(table.normalise_error_message(error.message));
    }
  }
  return { allTranslations, allUniqueConflicts };
};

const applyUpdates = async (changes, allTranslations, syncTimestamp, user) => {
  for (const [tblName, vals] of Object.entries(changes)) {
    if (vals.updates?.length > 0) {
      const table = Table.findOne({ name: tblName });
      if (!table) throw new Error(`The table '${tblName}' does not exists`);
      try {
        const pkName = table.pk_name;
        const insertTranslations = allTranslations[tblName];
        for (const update of vals.updates) {
          const row = pickFields(table, pkName, update, true);
          if (insertTranslations?.[row[pkName]])
            row[pkName] = insertTranslations[row[pkName]];
          for (const fk of table.getForeignKeys()) {
            const oldVal = row[fk.name];
            if (oldVal) {
              const newVal = allTranslations[fk.reftable_name]?.[oldVal];
              if (newVal) row[fk.name] = newVal;
            }
          }
          const result = await table.updateRow(
            row,
            row[pkName],
            user,
            true,
            undefined,
            undefined,
            syncTimestamp
          );
          if (result) throw new Error(`Unable to update ${tblName}: ${result}`);
        }
      } catch (error) {
        throw new Error(table.normalise_error_message(error.message));
      }
    }
  }
};

const applyDeletes = async (changes, user) => {
  for (const [tblName, vals] of Object.entries(changes)) {
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
        await table.deleteRows({ [pkName]: { in: delIds } }, user, true);
        if ((await table.countRows({ [pkName]: { in: delIds } })) !== 0)
          throw new Error(
            `Unable to delete in '${tblName}': Some rows were not deleted`
          );
      }
    }
  }
};

const writeTranslatedIds = async (translatedIds, directory) => {
  const writeName = path.join(directory, "translated-ids.out");
  await fs.writeFile(writeName, JSON.stringify(translatedIds));
  await fs.rename(writeName, path.join(directory, "translated-ids.json"));
};

const writeUniqueConflicts = async (uniqueConflicts, directory) => {
  const writeName = path.join(directory, "unique-conflicts.out");
  await fs.writeFile(writeName, JSON.stringify(uniqueConflicts));
  await fs.rename(writeName, path.join(directory, "unique-conflicts.json"));
};

const writeErrorFile = async (message, directory) => {
  const writeName = path.join(directory, "error.out");
  await fs.writeFile(writeName, JSON.stringify({ message }));
  await fs.rename(writeName, path.join(directory, "error.json"));
};

/**
 *
 */
class SyncUploadData extends Command {
  async run() {
    let returnCode = 0,
      inTransaction = false;
    const { flags } = await this.parse(SyncUploadData);
    if (db.is_it_multi_tenant() && flags.tenantAppName) {
      await init_multi_tenant(loadAllPlugins, true, [flags.tenantAppName]);
    }
    const doSync = async () => {
      try {
        const changes = JSON.parse(
          await fs.readFile(path.join(flags.directory, "changes.json"))
        );
        const syncTimestamp = flags.syncTimestamp;
        const user = flags.userEmail
          ? await User.findOne({ email: flags.userEmail })
          : undefined;
        await loadAllPlugins();
        await db.begin();
        inTransaction = true;
        const { allTranslations, allUniqueConflicts } = await applyInserts(
          changes,
          syncTimestamp,
          user
        );
        await translateInsertFks(changes, allTranslations);
        await applyUpdates(changes, allTranslations, syncTimestamp, user);
        await applyDeletes(changes, user);
        await db.commit();
        await writeTranslatedIds(allTranslations, flags.directory);
        await writeUniqueConflicts(allUniqueConflicts, flags.directory);
      } catch (error) {
        returnCode = 1;
        getState().log(2, `Unable to sync: ${error.message}`);
        await writeErrorFile(error.message, flags.directory);
        if (inTransaction) await db.rollback();
      } finally {
        process.exit(returnCode);
      }
    };
    if (
      flags.tenantAppName &&
      flags.tenantAppName !== db.connectObj.default_schema
    ) {
      await db.runWithTenant(flags.tenantAppName, doSync);
    } else {
      await doSync();
    }
  }
}

SyncUploadData.description = "Runs a sync for data supplied by the mobile app";

SyncUploadData.flags = {
  tenantAppName: flags.string({
    name: "tenant",
    string: "tenant",
    description: "Optional name of a tenant application",
  }),
  userEmail: flags.string({
    name: "user email",
    string: "userEmail",
    description: "email of the user running the sync",
  }),
  directory: flags.string({
    name: "directory",
    string: "directory",
    description: "directory name for input output data",
  }),
  syncTimestamp: flags.integer({
    name: "syncTimestamp",
    string: "syncTimestamp",
    description: "new timestamp for the sync_info rows",
  }),
};

module.exports = SyncUploadData;
