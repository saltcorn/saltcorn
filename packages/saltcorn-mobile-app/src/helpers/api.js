/*global saltcorn, splashConfig*/

import axios from "axios";

export async function apiCall({
  method,
  path,
  params,
  body,
  responseType,
  timeout,
  additionalHeaders,
}) {
  const config =
    typeof saltcorn !== "undefined"
      ? saltcorn.data.state.getState().mobileConfig
      : splashConfig;
  const serverPath = config.server_path;
  const url = `${serverPath}${path}`;
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    "X-Saltcorn-Client": "mobile-app",
    ...(additionalHeaders || {}),
  };
  if (config.tenantAppName) headers["X-Saltcorn-App"] = config.tenantAppName;
  const token = config.jwt;
  if (token) headers.Authorization = `jwt ${token}`;
  try {
    const result = await axios({
      url: url,
      method,
      params,
      headers,
      responseType: responseType ? responseType : "json",
      data: body,
      timeout: timeout ? timeout : 0,
    });
    return result;
  } catch (error) {
    error.message = `Unable to call ${method} ${url}:\n${error.message}`;
    throw error;
  }
}
