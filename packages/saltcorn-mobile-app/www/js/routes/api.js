/*global saltcorn, apiCall*/

// post/api/:tableName/:id
const updateTableRow = async (context) => {
  const { tableName, id } = context.params;
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  const user = {
    id: mobileConfig.user_id,
    role_id: mobileConfig.role_id || 100,
  };
  const table = saltcorn.data.models.Table.findOne({ name: tableName });
  if (!table) throw new Error(`The table '${tableName}' does not exist.`);
  if (
    mobileConfig.isOfflineMode ||
    mobileConfig.localTableIds.indexOf(table.id) >= 0
  ) {
    const row = {};
    for (const [k, v] of new URLSearchParams(context.query).entries()) {
      row[k] = v;
    }
    const errors = await saltcorn.data.web_mobile_commons.prepare_update_row(
      table,
      row,
      id
    );
    if (errors.length > 0) throw new Error(errors.join(", "));
    const ins_res = await table.tryUpdateRow(row, id, user);
    if (ins_res.error)
      throw new Error(`Update ${table.name} error: ${ins_res.error}`);
    return { ins_res };
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/api/${tableName}/${id}`,
      body: context.query,
    });
    return response.data;
  }
};
