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
  csrfRetried = false,
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
  // mobile forms render a dummy _csrf input, and the server checks the body
  // before the header, so drop it and let the header token count
  // FormData may come from the iframe (another realm), so instanceof won't work
  if (Object.prototype.toString.call(body) === "[object FormData]") {
    body.delete("_csrf");
    fetchOptions.body = body;
  } else if (body !== undefined) {
    if (body && typeof body === "object" && "_csrf" in body) {
      body = { ...body };
      delete body._csrf;
    }
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
    // an expired session gets redirected to the login page, treat it as 401
    const toLogin =
      res.redirected && new URL(res.url).pathname === "/auth/login";
    if (!res.ok || toLogin) {
      const status = toLogin ? 401 : res.status;
      const error = new Error(`Request failed with status code ${status}`);
      error.response = { status };
      if (status === 403) {
        const errBody = await res.json().catch(() => ({}));
        error.csrfInvalid = errBody?.error === "invalid csrf token";
      }
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
    // the server rejected the request before running it, so a retry is safe
    if (error.csrfInvalid && !csrfRetried && typeof saltcorn !== "undefined") {
      const tokenRes = await apiCall({ method: "GET", path: "/auth/csrf-token" });
      config.csrfToken = tokenRes?.data?.csrfToken;
      return await apiCall({
        method,
        path,
        params,
        body,
        responseType,
        timeout,
        additionalHeaders,
        csrfRetried: true,
      });
    }
    // a 401 can also mean "not allowed", only log out when the session is gone
    if (
      error.response?.status === 401 &&
      typeof saltcorn !== "undefined" &&
      !path.startsWith("/auth/") &&
      config.hasSession &&
      !config.isPublicUser &&
      !(await isAuthenticated())
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
      // callers expect data, so throw; the error toast is skipped for this
      error.sessionExpired = true;
      error.message = "Your session has expired, please log in again.";
      throw error;
    }
    error.message = `Unable to call ${method} ${url}:\n${error.message}`;
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// asks the server if the session is still valid, unreachable counts as yes
async function isAuthenticated() {
  try {
    const res = await apiCall({
      method: "GET",
      path: "/auth/authenticated",
      timeout: 10000,
    });
    return !!res?.data?.authenticated;
  } catch {
    return true;
  }
}
