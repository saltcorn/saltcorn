/*global saltcorn, apiCall, MobileRequest, offlineHelper*/

const postShowCalculated = async (context) => {
  const { tableName, fieldName, fieldview } = context.params;
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  const table = saltcorn.data.models.Table.findOne({ name: tableName });
  if (!table) throw new Error(`The table '${tableName}' does not exist.`);
  if (
    mobileConfig.isOfflineMode ||
    mobileConfig.localTableIds.indexOf(table.id) >= 0
  ) {
    // offline mode TODO
    return "";
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/field/show-calculated/${tableName}/${fieldName}/${fieldview}`,
      body: context.data || {},
    });
    return response.data;
  }
};
