/* global saltcorn */

import { apiCall } from "../../helpers/api";
import { setHasOfflineData } from "../../helpers/offline_mode";
import { parseQuery } from "../utils";
import { MobileRequest } from "../mocks/request";

// get/api/:tableName
export const loadTableRows = async (context) => {
  const { tableName } = context.params;
  const queryString = context.query;
  const query = queryString ? parseQuery(queryString) : {};

  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  const table = saltcorn.data.models.Table.findOne({ name: tableName });
  if (!table) throw new Error(`The table '${tableName}' does not exist.`);
  if (
    mobileConfig.isOfflineMode ||
    mobileConfig.localTableIds.indexOf(table.id) >= 0
  ) {
    const rows = await table.getRows(query, {
      orderBy: table.pk_name,
      forUser: mobileConfig.user,
    });
    return { success: rows };
  } else {
    const response = await apiCall({
      method: "GET",
      path: `/api/${tableName}${queryString ? `?${queryString}` : ""}`,
    });
    return response.data;
  }
};

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
      body: context.body || context.query,
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
      body: context.body || context.query,
    });
    return response.data;
  }
};

// post/api/:action
export const runAction = async (context) => {
  const { action } = context.params;
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  if (mobileConfig.isOfflineMode) {
    const req = new MobileRequest();
    const trigger = saltcorn.data.models.Trigger.findOne({
      name: action,
    });
    if (!trigger) throw new Error(`Action '${action}' does not exist.`);
    const actionObj = saltcorn.data.state.getState().actions[trigger.action];
    const resp = await actionObj.run({
      configuration: trigger.configuration,
      body: context.body || {},
      row: context.body || {},
      req,
      user: req.user,
    });
    if (resp?.error) {
      const { error, ...rest } = resp;
      return { success: false, error, data: rest };
    } else return { success: true, data: resp };
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/api/action/${action}`,
      body: context.body,
    });
    if (response.success === false) {
      throw new Error(`Action '${action}' failed: ${response.error}`);
    }
    return response.data;
  }
};
