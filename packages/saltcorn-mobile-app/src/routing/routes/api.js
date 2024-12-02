/*global saltcorn */

import { apiCall } from "../../helpers/api";
import { setHasOfflineData } from "../../helpers/offline_mode";

// post/api/:tableName/:id
export const updateTableRow = async (context) => {
  const { tableName, id } = context.params;
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
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
    const ins_res = await table.tryUpdateRow(row, id, mobileConfig.user);
    if (ins_res.error)
      throw new Error(`Update '${table.name}' error: ${ins_res.error}`);
    if (mobileConfig.isOfflineMode) await setHasOfflineData(true);
    return ins_res;
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/api/${tableName}/${id}`,
      body: context.query,
    });
    return response.data;
  }
};

// post/api/:tableName
export const insertTableRow = async (context) => {
  const { tableName } = context.params;
  const table = saltcorn.data.models.Table.findOne({ name: tableName });
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  if (!table) throw new Error(`The table '${tableName}' does not exist.`);
  if (
    mobileConfig.isOfflineMode ||
    mobileConfig.localTableIds.indexOf(table.id) >= 0
  ) {
    const row = {};
    for (const [k, v] of new URLSearchParams(context.query).entries()) {
      row[k] = v;
    }
    const errors = await saltcorn.data.web_mobile_commons.prepare_insert_row(
      row,
      table.getFields()
    );
    if (errors.length > 0) throw new Error(errors.join(", "));
    const ins_res = await table.tryInsertRow(row, mobileConfig.user);
    if (ins_res.error) {
      throw new Error(`Insert '${table.name}' error: ${ins_res.error}`);
    }
    if (mobileConfig.isOfflineMode) await setHasOfflineData(true);
    return ins_res;
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/api/${tableName}`,
      body: context.query,
    });
    return response.data;
  }
};
