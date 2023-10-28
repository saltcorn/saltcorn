/*global window, $, apiCall, saltcorn, navigator, clearAlerts*/

var offlineHelper = (() => {
  const setUploadStarted = async (started, time) => {
    const state = saltcorn.data.state.getState();
    const oldSession = await state.getConfig("last_offline_session");
    const newSession = { ...oldSession };
    newSession.uploadStarted = started;
    if (started) newSession.uploadStartTime = time;
    else newSession.uploadStartTime = null;
    await state.setConfig("last_offline_session", newSession);
  };

  const maxLastModified = async (tblName) => {
    const result = await saltcorn.data.db.query(
      `select max(last_modified) "max" from "${saltcorn.data.db.sqlsanitize(
        tblName
      )}_sync_info"`
    );
    return result.rows?.length > 0 ? new Date(result.rows[0].max) : null;
  };

  const prepare = async () => {
    const state = saltcorn.data.state.getState();
    const { synchedTables } = state.mobileConfig;
    const syncInfos = {};
    for (const tblName of synchedTables) {
      const syncInfo = { maxLoadedId: 0 };
      const maxLm = await maxLastModified(tblName);
      if (maxLm) syncInfo.syncFrom = maxLm.valueOf();
      syncInfos[tblName] = syncInfo;
    }
    return { synchedTables, syncInfos };
  };

  const insertRemoteData = async (table, rows, syncTimestamp) => {
    const tblName = table.name;
    const pkName = table.pk_name;
    for (const row of rows) {
      const {
        _sync_info_tbl_ref_,
        _sync_info_tbl_last_modified_,
        _sync_info_tbl_deleted_,
        ...rest
      } = row;
      const ref = _sync_info_tbl_ref_,
        last_modified = _sync_info_tbl_last_modified_;
      await saltcorn.data.db.insert(tblName, rest, { replace: true });
      const infos = await saltcorn.data.db.select(
        `${saltcorn.data.db.sqlsanitize(tblName)}_sync_info`,
        {
          ref: rest[pkName],
        }
      );
      if (infos.length > 0) {
        await saltcorn.data.db.query(
          `update "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
               set last_modified=${last_modified}, deleted=false, modified_local = false
               where ref=${rest[pkName]}`
        );
      } else {
        await saltcorn.data.db.insert(
          `${saltcorn.data.db.sqlsanitize(tblName)}_sync_info`,
          {
            ref,
            last_modified: syncTimestamp,
            deleted: false,
            modified_local: false,
          }
        );
      }
    }
  };

  const syncRemoteData = async (syncInfos, syncTimestamp) => {
    let iterations = 200;
    let hasMoreData = true;
    const idToTable = {};
    const getTable = (tblName) => {
      if (!idToTable[tblName])
        idToTable[tblName] = saltcorn.data.models.Table.findOne({
          name: tblName,
        });
      return idToTable[tblName];
    };
    while (hasMoreData && --iterations > 0) {
      hasMoreData = false;
      const loadResp = await apiCall({
        method: "POST",
        path: "/sync/load_changes",
        body: {
          syncInfos,
          loadUntil: syncTimestamp,
        },
      });
      for (const [tblName, { rows, maxLoadedId }] of Object.entries(
        loadResp.data
      )) {
        if (rows?.length > 0) {
          const table = getTable(tblName);
          hasMoreData = true;
          await insertRemoteData(table, rows, syncTimestamp);
          syncInfos[tblName].maxLoadedId = maxLoadedId;
        }
      }
    }
  };

  const prepDeletes = async (table, deletes) => {
    let result = [...deletes];
    const tblName = table.name;
    const pkName = table.pk_name;
    // don't delete if it's local modifed or unsynched
    const tblConflicts = await saltcorn.data.db.query(
      `select ref from "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
       where ref in (${deletes.map(({ ref }) => ref).join(",")}) and 
         (last_modified is null or modified_local = true)`
    );
    if (tblConflicts.rows.length > 0) {
      // make it an insert, so that it re-appears on the server
      const conflicts = tblConflicts.rows.map(({ ref }) => ref);
      await saltcorn.data.db.query(
        `update "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
         set last_modified = null, modified_local = true
         where ref in (${conflicts.join(",")})`
      );
      const conflictsSet = new Set(conflicts);
      result = result.filter((del) => !conflictsSet.has(del.ref));
    }

    // don't delete if it's referenced by offline data
    for (const field of await saltcorn.data.models.Field.find({
      reftable_name: tblName,
    })) {
      const srcTbl = saltcorn.data.models.Table.findOne(field.table_id);
      const { synchedTables } = saltcorn.data.state.getState().mobileConfig;
      if (synchedTables.indexOf(srcTbl.name) >= 0) {
        const fkConflicts = await saltcorn.data.db.query(
          `select data_tbl."${saltcorn.data.db.sqlsanitize(
            field.name
          )}" from "${saltcorn.data.db.sqlsanitize(
            srcTbl.name
          )}" as data_tbl join "${saltcorn.data.db.sqlsanitize(
            srcTbl.name
          )}_sync_info" as info_tbl
         on data_tbl."${saltcorn.data.db.sqlsanitize(pkName)}" = info_tbl.ref
         where data_tbl."${saltcorn.data.db.sqlsanitize(
           field.name
         )}" in (${result.map(({ ref }) => ref).join(",")}) 
           and (info_tbl.last_modified is null or info_tbl.modified_local = true)`
        );
        if (fkConflicts.rows.length > 0) {
          // make it an insert
          const conflicts = fkConflicts.rows.map(
            (conflict) => conflict[field.name]
          );
          const conflictsSet = new Set(conflicts);
          result = result.filter((del) => !conflictsSet.has(del.ref));
          await saltcorn.data.db.query(
            `update "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
           set last_modified = null, modified_local = true
           where ref in (${conflicts.join(",")})`
          );
        }
      }
    }
    return result;
  };

  const applyDeletes = async (allDeletes, syncTimestamp) => {
    for (const [tblName, deletes] of Object.entries(allDeletes)) {
      if (deletes.length > 0) {
        const table = saltcorn.data.models.Table.findOne({ name: tblName });
        const pkName = table.pk_name;
        const safeDeletes = await prepDeletes(table, deletes);
        if (safeDeletes.length > 0) {
          const delIds = safeDeletes.map(({ ref }) => ref).join(",");
          await saltcorn.data.db.query(
            `delete from "${saltcorn.data.db.sqlsanitize(
              tblName
            )}" where "${saltcorn.data.db.sqlsanitize(pkName)}" in (${delIds})`
          );
          await saltcorn.data.db.query(
            `update "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
             set deleted = true, last_modified = ${syncTimestamp}, modified_local = false
             where ref in (${delIds}) and deleted = false`
          );
        }
      }
    }
  };

  const syncRemoteDeletes = async (syncInfos, syncTimestamp) => {
    const delResp = await apiCall({
      method: "POST",
      path: "/sync/deletes",
      body: {
        syncTimestamp,
        syncInfos,
      },
    });
    const { deletes } = delResp.data;
    await applyDeletes(deletes, syncTimestamp);
  };

  const loadOfflineChanges = async (synchedTbls) => {
    const result = {};
    for (const synchedTbl of synchedTbls) {
      const table = saltcorn.data.models.Table.findOne({ name: synchedTbl });
      const pkName = table.pk_name;
      const localModified = await saltcorn.data.db.query(
        `select 
           info_tbl.ref as _sync_info_ref_, info_tbl.last_modified as _sync_info_last_modified_, 
           info_tbl.deleted as _sync_info_deleted_, info_tbl.modified_local as _sync_info_modified_local_,
           data_tbl.*
         from "${saltcorn.data.db.sqlsanitize(
           synchedTbl
         )}_sync_info" as info_tbl left join "${saltcorn.data.db.sqlsanitize(
          synchedTbl
        )}" as data_tbl
         on info_tbl.ref = data_tbl."${saltcorn.data.db.sqlsanitize(pkName)}"
         where info_tbl.modified_local = true`
      );
      const inserts = [];
      const updates = [];
      const deletes = [];
      for (const row of localModified.rows) {
        const {
          _sync_info_ref_,
          _sync_info_last_modified_,
          _sync_info_deleted_,
          _sync_info_modified_local_,
          ...rest
        } = row;
        const ref = _sync_info_ref_,
          last_modified = _sync_info_last_modified_,
          deleted = _sync_info_deleted_;
        if (deleted)
          deletes.push({
            [pkName]: ref,
            last_modified,
          });
        else if (rest[pkName]) {
          if (!last_modified) inserts.push(rest);
          else updates.push(rest);
        }
      }
      const changes = {};
      if (inserts.length > 0) changes.inserts = inserts;
      if (updates.length > 0) changes.updates = updates;
      if (deletes.length > 0) changes.deletes = deletes;
      if (Object.keys(changes).length > 0) result[synchedTbl] = changes;
    }
    return result;
  };

  const handleTranslatedIds = async (allTranslations) => {
    const idToTable = {};
    for (const [tblName, translations] of Object.entries(allTranslations)) {
      const fks = await saltcorn.data.models.Field.find({
        reftable_name: tblName,
      });
      const table = saltcorn.data.models.Table.findOne({ name: tblName });
      const transArr = Array.from(Object.entries(translations));
      transArr.sort((a, b) => parseInt(b[1]) - parseInt(a[1]));
      for (const [from, to] of transArr) {
        await saltcorn.data.db.update(tblName, { [table.pk_name]: to }, from);
        await saltcorn.data.db.query(
          `update "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
           set ref = ${to}
           where ref = ${from} and deleted = false`
        );
        for (const fk of fks) {
          if (!idToTable[fk.table_id])
            idToTable[fk.table_id] = saltcorn.data.models.Table.findOne(
              fk.table_id
            );
          const refTable = idToTable[fk.table_id];
          await saltcorn.data.db.query(
            `update "${saltcorn.data.db.sqlsanitize(
              refTable.name
            )}" set "${saltcorn.data.db.sqlsanitize(fk.name)}" = ${to} 
             where "${fk.name}" = ${from}`
          );
        }
      }
    }
  };

  const handleUniqueConflicts = async (uniqueConflicts) => {
    for (const [tblName, conflicts] of Object.entries(uniqueConflicts)) {
      const table = saltcorn.data.models.Table.findOne({ name: tblName });
      const pkName = table.pk_name || "id";
      for (const conflict of conflicts) {
        await saltcorn.data.db.insert(tblName, conflict, { replace: true });
      }
    }
  };

  const updateSyncInfos = async (
    offlineChanges,
    allTranslations,
    syncTimestamp
  ) => {
    const update = async (tblName, changes, deleted = false) => {
      const table = saltcorn.data.models.Table.findOne({ name: tblName });
      const pkName = table.pk_name;
      const translated = allTranslations[tblName];
      const refIds = changes.map((change) =>
        deleted
          ? change[pkName]
          : translated?.[change[pkName]] || change[pkName]
      );
      const values = refIds.map(
        (ref) => `(${ref}, ${syncTimestamp}, ${deleted}, false)`
      );
      await saltcorn.data.db.query(
        `delete from "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
         where ref in (${refIds.join(",")})`
      );
      await saltcorn.data.db.query(
        `insert into "${saltcorn.data.db.sqlsanitize(tblName)}_sync_info"
         (ref, last_modified, deleted, modified_local)
         values ${values.join(",")}
        `
      );
    };
    for (const [tblName, tblChanges] of Object.entries(offlineChanges)) {
      if (tblChanges.inserts) await update(tblName, tblChanges.inserts);
      if (tblChanges.updates) await update(tblName, tblChanges.updates);
      if (tblChanges.deletes) await update(tblName, tblChanges.deletes, true);
    }
  };

  const syncOfflineData = async (synchedTables, syncTimestamp) => {
    const offlineChanges = await loadOfflineChanges(synchedTables);
    if (Object.keys(offlineChanges).length === 0) return null;
    const uploadResp = await apiCall({
      method: "POST",
      path: "/sync/offline_changes",
      body: {
        changes: offlineChanges,
        syncTimestamp,
      },
    });
    const { syncDir } = uploadResp.data;
    let pollCount = 0;
    while (pollCount < 60) {
      await saltcorn.data.utils.sleep(1000);
      const pollResp = await apiCall({
        method: "GET",
        path: `/sync/upload_finished?dir_name=${encodeURIComponent(syncDir)}`,
      });
      pollCount++;
      const { finished, translatedIds, uniqueConflicts, error } = pollResp.data;
      if (finished) {
        if (error) throw new Error(error.message);
        else {
          await handleTranslatedIds(translatedIds);
          await handleUniqueConflicts(uniqueConflicts);
          await updateSyncInfos(offlineChanges, translatedIds, syncTimestamp);
          return syncDir;
        }
      } else
        console.log(`poll for syncResult '${syncTimestamp}': ${pollCount}`);
    }
    throw new Error("Unable to get the translatedIds");
  };

  const cleanSyncDir = async (syncDir) => {
    try {
      await apiCall({
        method: "POST",
        path: "/sync/clean_sync_dir",
        body: {
          dir_name: syncDir,
        },
      });
    } catch (error) {
      console.log(`Unable to clean ${syncDir}`);
      console.log(error);
    }
  };

  /*
   * check if the server did an upload which didnt't came back to the app
   * the phone shut down or the app was stopped in between
   * Then the data is already uploaded and to avoid conflicts, we do a clean full sync
   */
  const checkCleanSync = async (uploadStarted, uploadStartTime, userName) => {
    if (uploadStarted) {
      const oldSyncDir = `${uploadStartTime}_${userName}`;
      const resp = await apiCall({
        method: "GET",
        path: `/sync/upload_finished?dir_name=${encodeURIComponent(
          oldSyncDir
        )}`,
      });
      const { finished, error } = resp.data;
      if (finished && !error) return true;
      else await cleanSyncDir(oldSyncDir);
    }
    return false;
  };

  const getSyncTimestamp = async () => {
    const resp = await apiCall({
      method: "GET",
      path: `/sync/sync_timestamp`,
    });
    return resp.data.syncTimestamp;
  };

  const setSpinnerText = () => {
    const iframeWindow = $("#content-iframe")[0].contentWindow;
    if (iframeWindow) {
      const spinnerText =
        iframeWindow.document.getElementById("scspinner-text-id");
      if (spinnerText) {
        spinnerText.innerHTML = "Syncing, please don't turn off";
        spinnerText.classList.remove("d-none");
      }
    }
  };

  return {
    sync: async () => {
      setSpinnerText();
      const state = saltcorn.data.state.getState();
      const mobileConfig = state.mobileConfig;
      const { offlineUser, hasOfflineData, uploadStarted, uploadStartTime } =
        (await offlineHelper.getLastOfflineSession()) || {};
      if (
        offlineUser &&
        hasOfflineData &&
        offlineUser !== mobileConfig.user_name
      ) {
        throw new Error(
          `The sync is not available, '${offlineUser}' has not yet uploaded offline data.`
        );
      } else {
        let syncDir = null;
        let cleanSync = await checkCleanSync(
          uploadStarted,
          uploadStartTime,
          mobileConfig.user_name
        );
        const syncTimestamp = await getSyncTimestamp();
        await setUploadStarted(true, syncTimestamp);
        let lock = null;
        try {
          if (window.navigator?.wakeLock?.request)
            lock = await window.navigator.wakeLock.request();
        } catch (error) {
          console.log("wakeLock not available");
          console.log(error);
        }
        let transactionOpen = false;
        try {
          await saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
          await saltcorn.data.db.query("BEGIN");
          transactionOpen = true;
          if (cleanSync) await offlineHelper.clearLocalData(true);
          const { synchedTables, syncInfos } = await prepare();
          await syncRemoteDeletes(syncInfos, syncTimestamp);
          syncDir = await syncOfflineData(synchedTables, syncTimestamp);
          await syncRemoteData(syncInfos, syncTimestamp);
          await offlineHelper.endOfflineMode(true);
          await setUploadStarted(false);
          await saltcorn.data.db.query("COMMIT");
          transactionOpen = false;
          await saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
        } catch (error) {
          if (transactionOpen) await saltcorn.data.db.query("ROLLBACK");
          await saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
          console.log(error);
          throw error;
        } finally {
          if (syncDir) await cleanSyncDir(syncDir);
          if (lock) await lock.release();
        }
      }
    },

    startOfflineMode: async () => {
      const state = saltcorn.data.state.getState();
      const mobileConfig = state.mobileConfig;
      const oldSession = await offlineHelper.getLastOfflineSession();
      if (!oldSession) {
        await offlineHelper.setOfflineSession({
          offlineUser: mobileConfig.user_name,
        });
      } else if (
        oldSession.offlineUser &&
        oldSession.offlineUser !== mobileConfig.user_name
      ) {
        if (oldSession.hasOfflineData)
          throw new Error(
            `The offline mode is not available, '${oldSession.offlineUser}' has not yet uploaded offline data.`
          );
      } else if (oldSession.uploadStarted) {
        throw new Error(
          `A previous Synchronization did not finish. Please ${
            mobileConfig.networkState === "none" ? "go online and " : ""
          } try it again.`
        );
      } else {
        await offlineHelper.setOfflineSession({
          offlineUser: mobileConfig.user_name,
        });
      }
      mobileConfig.isOfflineMode = true;
    },
    endOfflineMode: async (endSession = false) => {
      const state = saltcorn.data.state.getState();
      const mobileConfig = state.mobileConfig;
      mobileConfig.isOfflineMode = false;
      const oldSession = await offlineHelper.getLastOfflineSession();
      if (
        (!oldSession?.uploadStarted &&
          !(await offlineHelper.hasOfflineRows())) ||
        endSession
      )
        await state.setConfig("last_offline_session", null);
    },
    getLastOfflineSession: async () => {
      const state = saltcorn.data.state.getState();
      return await state.getConfig("last_offline_session");
    },
    setOfflineSession: async (sessObj) => {
      const state = saltcorn.data.state.getState();
      await state.setConfig("last_offline_session", sessObj);
    },
    setHasOfflineData: async (hasOfflineData) => {
      const offlineSession = await offlineHelper.getLastOfflineSession();
      if (offlineSession?.hasOfflineData !== hasOfflineData) {
        offlineSession.hasOfflineData = hasOfflineData;
        await offlineHelper.setOfflineSession(offlineSession);
      }
    },
    clearLocalData: async (inTransaction) => {
      try {
        await saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
        if (!inTransaction) await saltcorn.data.db.query("BEGIN");
        const { synchedTables } = saltcorn.data.state.getState().mobileConfig;
        for (const tblName of synchedTables) {
          const table = saltcorn.data.models.Table.findOne({ name: tblName });
          await table.deleteRows();
          await saltcorn.data.db.deleteWhere(`${table.name}_sync_info`, {});
        }
        if (!inTransaction) await saltcorn.data.db.query("COMMIT");
        await saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
      } catch (error) {
        if (!inTransaction) {
          await saltcorn.data.db.query("ROLLBACK");
          await saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
        }
        throw error;
      }
    },
    offlineCallback: async () => {
      const mobileConfig = saltcorn.data.state.getState().mobileConfig;
      mobileConfig.networkState = navigator.connection.type;
    },
    onlineCallback: async () => {
      const mobileConfig = saltcorn.data.state.getState().mobileConfig;
      if (mobileConfig.isOfflineMode) {
        const iframeWindow = $("#content-iframe")[0].contentWindow;
        if (iframeWindow) {
          clearAlerts();
          iframeWindow.notifyAlert(
            `An internet connection is available, to end the offline mode click ${saltcorn.markup.a(
              {
                href: "javascript:execLink('/sync/sync_settings')",
              },
              "here"
            )}`
          );
        }
      }
      mobileConfig.networkState = navigator.connection.type;
    },
    hasOfflineRows: async () => {
      const { synchedTables } = saltcorn.data.state.getState().mobileConfig;
      for (const tblName of synchedTables) {
        const table = saltcorn.data.models.Table.findOne({ name: tblName });
        const pkName = table.pk_name;
        const { rows } = await saltcorn.data.db.query(
          `select count(info_tbl.ref) 
           from "${saltcorn.data.db.sqlsanitize(
             tblName
           )}_sync_info" as info_tbl 
           join "${saltcorn.data.db.sqlsanitize(tblName)}" as data_tbl
           on info_tbl.ref = data_tbl."${saltcorn.data.db.sqlsanitize(pkName)}"
           where info_tbl.modified_local = true`
        );
        if (rows?.length > 0 && parseInt(rows[0].count) > 0) return true;
      }
      return false;
    },
    getOfflineMsg: () => {
      const { networkState } = saltcorn.data.state.getState().mobileConfig;
      return networkState === "none"
        ? "You are offline."
        : "You are offline, an internet connection is available.";
    },
  };
})();
