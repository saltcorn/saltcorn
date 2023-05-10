/*global $, apiCall, saltcorn, apiCall, navigator, clearAlerts*/

var offlineHelper = (() => {
  const loadServerData = async () => {
    const response = await apiCall({
      method: "GET",
      path: "/sync/table_data",
    });
    return response.data;
  };
  const updateLocalData = async (data) => {
    try {
      await saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
      await saltcorn.data.db.query("BEGIN TRANSACTION");
      for (const [k, v] of Object.entries(data)) {
        const table = saltcorn.data.models.Table.findOne({ name: k });
        const ids = (await table.getRows()).map((row) => row.id);
        await saltcorn.data.db.query(
          `delete from "${saltcorn.data.db.sqlsanitize(
            k
          )}" where id in (${ids.join(",")})`
        );
        for (const row of v.rows) {
          await saltcorn.data.db.insert(k, row);
        }
      }
      await saltcorn.data.db.query("COMMIT TRANSACTION");
    } catch (error) {
      await saltcorn.data.db.query("ROLLBACK TRANSACTION");
      throw error;
    } finally {
      await saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
    }
  };

  const loadLocalData = async () => {
    const result = {};
    const { user_id } = saltcorn.data.state.getState().mobileConfig;
    const user = await saltcorn.data.models.User.findOne({ id: user_id });
    if (!user) throw new Error(`The user with id '${user_id}' does not exist.`);
    for (const table of await saltcorn.data.models.Table.find()) {
      // ignore min_role_read, one can insert a row which is not readable
      // but that invisible row should be synched
      const rows =
        user.role_id > table.min_role_write
          ? (await table.getRows()).filter((row) => table.is_owner(user, row))
          : await table.getRows();
      result[table.name] = rows;
    }
    return result;
  };
  const sendToServer = async (localData) => {
    const response = await apiCall({
      method: "POST",
      path: "/sync/table_data",
      body: {
        data: localData,
      },
    });
    return response.data;
  };
  const applyTranslatedIds = async (translateIds) => {
    try {
      await saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
      await saltcorn.data.db.query("BEGIN TRANSACTION");
      for (const [k, v] of Object.entries(translateIds)) {
        const table = saltcorn.data.models.Table.findOne({ name: k });
        for (const { from, to } of v) {
          await table.updateRow({ id: to }, from);
        }
      }
      await saltcorn.data.db.query("COMMIT TRANSACTION");
    } catch (error) {
      await saltcorn.data.db.query("ROLLBACK TRANSACTION");
      throw error;
    } finally {
      await saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
    }
  };

  return {
    startOfflineMode: async () => {
      const state = saltcorn.data.state.getState();
      const mobileConfig = state.mobileConfig;
      const oldOfflineUser = await offlineHelper.lastOfflineUser();
      if (oldOfflineUser && oldOfflineUser !== mobileConfig.user_name) {
        throw new Error(
          `The offline mode is not available, '${oldOfflineUser}' has not yet uploaded offline data.`
        );
      } else {
        mobileConfig.isOfflineMode = true;
      }
    },
    endOfflineMode: async () => {
      const state = saltcorn.data.state.getState();
      const mobileConfig = state.mobileConfig;
      mobileConfig.isOfflineMode = false;
      await state.setConfig("user_with_offline_data", "");
    },
    lastOfflineUser: async () => {
      const state = saltcorn.data.state.getState();
      return await state.getConfig("user_with_offline_data");
    },
    uploadLocalData: async () => {
      const lastOfflineUser = await offlineHelper.lastOfflineUser();
      if (!lastOfflineUser) throw new Error("You don't have any offline data.");
      const { user_name } = saltcorn.data.state.getState().mobileConfig;
      if (lastOfflineUser !== user_name)
        throw new Error(
          `The upload is not available, '${lastOfflineUser}' has not yet uploaded offline data.`
        );
      const fromSqlite = await loadLocalData();
      const { translateIds } = await sendToServer(fromSqlite);
      if (translateIds && Object.keys(translateIds).length > 0)
        await applyTranslatedIds(translateIds);
    },
    downloadServerData: async () => {
      const fromServer = await loadServerData();
      await updateLocalData(fromServer);
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
          if (await offlineHelper.lastOfflineUser()) {
            iframeWindow.notifyAlert(
              `An internet connection is available, to handle your offline data Click ${saltcorn.markup.a(
                {
                  href: "javascript:execLink('/sync/sync_settings')",
                },
                "here"
              )}`
            );
          } else {
            clearAlerts();
            iframeWindow.notifyAlert("You are online again.");
            mobileConfig.isOfflineMode = false;
          }
        }
      }
      mobileConfig.networkState = navigator.connection.type;
    },
  };
})();
