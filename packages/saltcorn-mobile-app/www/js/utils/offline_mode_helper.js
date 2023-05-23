/*global $, apiCall, saltcorn, navigator, clearAlerts*/

var offlineHelper = (() => {
  const loadOfflineData = async (localTableIds) => {
    const result = {};
    for (const table of await saltcorn.data.models.Table.find()) {
      if (table.name !== "users" && !localTableIds.indexOf(table.id) >= 0) {
        const rows = await table.getRows();
        if (rows.length > 0) result[table.name] = rows;
      }
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
  const setUploadStartedTime = async (date) => {
    const state = saltcorn.data.state.getState();
    const oldSession = await state.getConfig("last_offline_session");
    const newSession = { ...oldSession };
    newSession.upload_started_at = date;
    newSession.upload_ended_at = null;
    await state.setConfig("last_offline_session", newSession);
  };
  const setUploadFinishedTime = async (date) => {
    const state = saltcorn.data.state.getState();
    const oldSession = await state.getConfig("last_offline_session");
    const newSession = { ...oldSession };
    newSession.upload_ended_at = date;
    await state.setConfig("last_offline_session", newSession);
  };

  return {
    startOfflineMode: async () => {
      const state = saltcorn.data.state.getState();
      const mobileConfig = state.mobileConfig;
      const oldOfflineUser = (await offlineHelper.getLastOfflineSession())
        ?.offlineUser;
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
      if (!(await offlineHelper.hasOfflineRows()))
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
    uploadLocalData: async () => {
      const lastOfflineUser = (await offlineHelper.getLastOfflineSession())
        ?.offlineUser;
      if (!lastOfflineUser) throw new Error("You don't have any offline data.");
      const { user_name, localTableIds } =
        saltcorn.data.state.getState().mobileConfig;
      if (lastOfflineUser !== user_name)
        throw new Error(
          `The upload is not available, '${lastOfflineUser}' has not yet uploaded offline data.`
        );
      const fromSqlite = await loadOfflineData(localTableIds);
      try {
        await setUploadStartedTime(new Date());
        await sendToServer(fromSqlite);
        await setUploadFinishedTime(new Date());
      } catch (error) {
        await setUploadFinishedTime(null);
        throw error;
      }
    },
    clearLocalData: async () => {
      const { localTableIds } = saltcorn.data.state.getState().mobileConfig;
      const tables = await saltcorn.data.models.Table.find();
      for (const table of tables) {
        if (table.name !== "users" && !localTableIds.indexOf(table.id) >= 0) {
          await table.deleteRows();
        }
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
      const { localTableIds } = saltcorn.data.state.getState().mobileConfig;
      for (const table of await saltcorn.data.models.Table.find()) {
        if (table.name !== "users" && !localTableIds.indexOf(table.id) >= 0) {
          if ((await table.countRows()) > 0) return true;
        }
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
