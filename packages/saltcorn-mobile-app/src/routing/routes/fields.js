/*global saltcorn */

import { MobileRequest } from "../mocks/request";
import { MobileResponse } from "../mocks/response";
import { parseQuery } from "../utils";
import { apiCall } from "../../helpers/api";

export const postShowCalculated = async (context) => {
  const { tableName, fieldName, fieldview } = context.params;
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  const table = saltcorn.data.models.Table.findOne({ name: tableName });
  if (!table) throw new Error(`The table '${tableName}' does not exist.`);
  if (
    mobileConfig.isOfflineMode ||
    mobileConfig.localTableIds.indexOf(table.id) >= 0
  ) {
    const req = new MobileRequest({
      query: context.query ? parseQuery(context.query) : {},
      body: context.data || {},
    });
    const res = new MobileResponse();
    await saltcorn.data.web_mobile_commons.show_calculated_fieldview(req, res, {
      tableName,
      fieldName,
      fieldview,
    });
    return res.getSendData();
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/field/show-calculated/${tableName}/${fieldName}/${fieldview}`,
      body: context.data || {},
    });
    return response.data;
  }
};
