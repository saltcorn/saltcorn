/*global saltcorn*/

import i18next from "i18next";
import { apiCall } from "./api";
import { router } from "../routing/index";
import { getLastOfflineSession, deleteOfflineData, sync } from "./offline_mode";
import { addRoute, replaceIframe, clearHistory } from "../helpers/navigation";
import {
  showToasts,
  tryInitBackgroundSync,
  tryInitPush,
  tryStopBackgroundSync,
  tryUnregisterPush,
} from "./common";

/**
 * fetches a CSRF token and caches it in mobileConfig.csrfToken.
 * Call again after every login/logout, since both reset it.
 */
export async function refreshCsrfToken() {
  const response = await apiCall({ method: "GET", path: "/auth/csrf-token" });
  const config = saltcorn.data.state.getState().mobileConfig;
  config.csrfToken = response?.data?.csrfToken;
  return config.csrfToken;
}

/**
 * internal helper for the normal login/signup
 * @param {any} param0
 * @returns
 */
async function loginRequest({ email, password, isSignup, code }) {
  await refreshCsrfToken();
  const opts = code
    ? {
        method: "POST",
        path: "/auth/session-from-code",
        body: { code },
      }
    : isSignup
    ? {
        method: "POST",
        path: "/auth/signup",
        body: { email, password },
      }
    : {
        method: "POST",
        path: "/auth/login-with/session",
        body: { email, password },
      };
  const response = await apiCall(opts);
  return response.data;
}

/**
 * internal helper to process a successful session login response
 * ({ success: true, user }) and persist it locally
 */
const handleSessionLogin = async (user, config) => {
  config.user = user;
  config.isPublicUser = false;
  config.isOfflineMode = false;
  config.hasSession = true;
  await insertUser(user);
  // login regenerated the session, so the previously fetched token is stale
  await refreshCsrfToken();
  await persistSession(config);
  i18next.changeLanguage(user.language);
};

/**
 * internal helper to run the first sync
 */
const initialSync = async (config) => {
  const alerts = [];
  const { offlineUser, hasOfflineData } = (await getLastOfflineSession()) || {};
  if (!offlineUser || offlineUser === config.user.email) {
    await sync(true, true, alerts);
  } else {
    if (hasOfflineData)
      alerts.push({
        type: "warning",
        msg: `'${offlineUser}' has not yet uploaded offline data.`,
      });
    else {
      await deleteOfflineData(true);
      await sync(true, true, alerts);
    }
  }
  return alerts;
};

/**
 * internal helper to get the path to the first page
 */
const getEntryPoint = (config) => {
  let entryPoint = null;
  if (config.entryPointType === "byrole") {
    const state = saltcorn.data.state.getState();
    const homepageByRole = state.getConfig("home_page_by_role", {})[
      config.user.role_id
    ];
    if (homepageByRole) entryPoint = `get/page/${homepageByRole}`;
    else throw new Error("No homepage defined for this role.");
  } else entryPoint = config.entry_point;
  return entryPoint;
};

/**
 * Normal login/signup use email and password. An OAuth-provider login
 * (e.g. google-auth's finishLogin) instead passes the short-lived code
 * its deep-link callback was handed, which stands in for a session here.
 * @param {*} param0
 */
export async function login({ email, password, isSignup, token }) {
  const loginResult = await loginRequest({
    email,
    password,
    isSignup,
    code: token,
  });
  if (loginResult?.success && loginResult?.user) {
    const alerts = [];
    const config = saltcorn.data.state.getState().mobileConfig;
    await handleSessionLogin(loginResult.user, config);
    if (config.allowOfflineMode) alerts.push(await initialSync(config));
    await tryInitPush(config);
    await tryInitBackgroundSync(config);
    alerts.push({
      type: "success",
      msg: i18next.t("Welcome, %s!", {
        postProcess: "sprintf",
        sprintf: [config.user.email],
      }),
    });

    // open first page
    const entryPoint = getEntryPoint(config);
    addRoute({ route: entryPoint, query: undefined });
    const page = await router.resolve({
      pathname: entryPoint,
      fullWrap: true,
      alerts,
    });
    if (page.content) await replaceIframe(page.content, page.isFile);
  } else if (loginResult?.error) {
    showToasts([{ type: "error", msg: loginResult.error }]);
  } else if (loginResult?.alerts) {
    showToasts(loginResult?.alerts);
  } else {
    throw new Error("The login failed.");
  }
}

export async function publicLogin(entryPoint) {
  try {
    const config = saltcorn.data.state.getState().mobileConfig;
    // no login needed for public, but a CSRF token is still cached upfront.
    await refreshCsrfToken();
    config.user = {
      role_id: 100,
      email: "public",
      language: "en",
    };
    config.isPublicUser = true;
    config.hasSession = true;
    await persistSession(config);
    i18next.changeLanguage(config.user.language);
    addRoute({
      route: entryPoint,
      query: undefined,
    });
    const page = await router.resolve({
      pathname: entryPoint,
      fullWrap: true,
      alerts: [
        {
          type: "success",
          msg: i18next.t("Welcome to %s!", {
            postProcess: "sprintf",
            sprintf: [
              saltcorn.data.state.getState().getConfig("site_name") ||
                "Saltcorn",
            ],
          }),
        },
      ],
    });
    if (page.content) await replaceIframe(page.content, page.isFile);
  } catch (error) {
    console.error(error);
    showToasts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
    throw error;
  }
}

export async function logout() {
  try {
    const config = saltcorn.data.state.getState().mobileConfig;
    await tryUnregisterPush();
    await tryStopBackgroundSync();
    const response = await apiCall({ method: "GET", path: "/auth/logout" });
    if (response.data.success) {
      await clearSession();
      clearHistory();
      config.csrfToken = undefined;
      config.hasSession = false;
      config.isPublicUser = false;
      const page = await router.resolve({
        pathname: "get/auth/login",
        entryView: config.entry_point,
        versionTag: config.version_tag,
      });
      await replaceIframe(page.content);
    } else throw new Error("Unable to logout.");
  } catch (error) {
    console.error("unable to logout:", error);
    showToasts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  }
}

export async function insertUser({ id, email, role_id, language }) {
  await saltcorn.data.db.insert(
    "users",
    { id, email, role_id, language },
    { ignoreExisting: true }
  );
}

export async function clearSession() {
  await saltcorn.data.db.deleteWhere("session_table");
}

/**
 * persists the current mobileConfig session state (csrf token, user,
 * public/authenticated flag) so the app can restore it at next boot
 * without a network call (used e.g. when starting offline).
 */
export async function persistSession(config) {
  await clearSession();
  await saltcorn.data.db.insert("session_table", {
    csrfToken: config.csrfToken,
    userJson: config.isPublicUser ? null : JSON.stringify(config.user),
    isPublicUser: !!config.isPublicUser,
  });
}

/**
 * checks with the server whether the current session cookie is still valid,
 * and refreshes the cached CSRF token (its secret lives in the session, so
 * it's fine to keep reusing the same token as long as the session is alive).
 */
export async function checkSession() {
  const response = await apiCall({
    method: "GET",
    path: "/auth/authenticated",
    timeout: 10000,
  });
  return !!response?.data?.authenticated;
}
