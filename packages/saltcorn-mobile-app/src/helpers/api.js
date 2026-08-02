/*global saltcorn, splashConfig*/

import { router } from "../routing/index";
import { replaceIframe, clearHistory } from "./navigation";

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
  let url = `${serverPath}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `${url.includes("?") ? "&" : "?"}${qs}`;
  }
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    "X-Saltcorn-Client": "mobile-app",
    ...(additionalHeaders || {}),
  };
  if (config.tenantAppName) headers["X-Saltcorn-App"] = config.tenantAppName;
  // The session cookie is attached automatically by the WebView (credentials: "include").
  // The CSRF token has to be sent explicitly, same as the web client does.
  if (config.csrfToken) headers["CSRF-Token"] = config.csrfToken;
  const fetchOptions = { method, headers, credentials: "include" };
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const controller = timeout ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeout)
    : null;
  if (controller) fetchOptions.signal = controller.signal;
  try {
    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      const error = new Error(`Request failed with status code ${res.status}`);
      error.response = { status: res.status };
      throw error;
    }
    let data;
    if (responseType === "blob") data = await res.blob();
    else if (responseType === "text") data = await res.text();
    else {
      // A redirected error page still counts as a 200 here, so parse by
      // hand to give a clear error instead of a cryptic JSON parse failure.
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        const error = new Error(
          `Expected JSON but got ${
            res.headers.get("content-type") || "unknown content-type"
          } (status ${res.status}, url ${res.url})`
        );
        error.response = { status: res.status };
        throw error;
      }
    }
    return { data, status: res.status };
  } catch (error) {
    if (
      error.response?.status === 401 &&
      typeof saltcorn !== "undefined" &&
      !path.startsWith("/auth/")
    ) {
      const mobileConfig = saltcorn.data.state.getState().mobileConfig;
      mobileConfig.csrfToken = undefined;
      mobileConfig.hasSession = false;
      await saltcorn.data.db.deleteWhere("session_table");
      clearHistory();
      const page = await router.resolve({
        pathname: "get/auth/login",
        alerts: [
          {
            type: "warning",
            msg: "Your session has expired, please log in again.",
          },
        ],
      });
      await replaceIframe(page.content);
      return;
    }
    error.message = `Unable to call ${method} ${url}:\n${error.message}`;
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
