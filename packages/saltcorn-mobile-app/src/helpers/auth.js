/*global saltcorn*/

import { jwtDecode } from "jwt-decode";
import i18next from "i18next";
import { apiCall } from "./api";
import { router } from "../routing/index";
import { getLastOfflineSession, deleteOfflineData, sync } from "./offline_mode";
import { addRoute, replaceIframe, clearHistory } from "../helpers/navigation";
import {
  showAlerts,
  tryInitBackgroundSync,
  tryInitPush,
  tryStopBackgroundSync,
  tryUnregisterPush,
} from "./common";

/**
 * internal helper for the normal login/signup and public login
 * @param {any} param0
 * @returns
 */
async function loginRequest({ email, password, isSignup, isPublic }) {
  const opts = isPublic
    ? {
        method: "GET",
        path: "/auth/login-with/jwt",
      }
    : isSignup
      ? {
          method: "POST",
          path: "/auth/signup",
          body: {
            email,
            password,
          },
        }
      : {
          method: "GET",
          path: "/auth/login-with/jwt",
          params: {
            email,
            password,
          },
        };
  const response = await apiCall(opts);
  return response.data;
}

/**
 * internal helper to process a JWT token
 * @param {string} tokenStr
 */
const handleToken = async (tokenStr, config) => {
  const token = jwtDecode(tokenStr);
  const user = token.user;
  config.user = user;
  config.isPublicUser = false;
  config.isOfflineMode = false;
  await insertUser(user);
  await setJwt(tokenStr);
  config.jwt = tokenStr;
  i18next.changeLanguage(user.language);
};

/**
 * internal helper to run the first sync
 */
const initialSync = async (config) => {
  const alerts = [];
  const { offlineUser, hasOfflineData } = (await getLastOfflineSession()) || {};
  if (!offlineUser || offlineUser === config.user.email) {
    await sync();
  } else {
    if (hasOfflineData)
      alerts.push({
        type: "warning",
        msg: `'${offlineUser}' has not yet uploaded offline data.`,
      });
    else {
      await deleteOfflineData(true);
      await sync();
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
 * For normal login/signup email and password are used
 * When called from auth provider login (see google-auth plugin), token is used
 * @param {*} param0
 */
export async function login({ email, password, isSignup, token }) {
  const loginResult = !token
    ? await loginRequest({
        email,
        password,
        isSignup,
      })
    : token;
  if (typeof loginResult === "string") {
    const alerts = [];
    const config = saltcorn.data.state.getState().mobileConfig;
    await handleToken(loginResult, config);
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
  } else if (loginResult?.alerts) {
    showAlerts(loginResult?.alerts);
  } else {
    throw new Error("The login failed.");
  }
}

export async function publicLogin(entryPoint) {
  try {
    const loginResult = await loginRequest({ isPublic: true });
    if (typeof loginResult === "string") {
      const config = saltcorn.data.state.getState().mobileConfig;
      config.user = {
        role_id: 100,
        email: "public",
        language: "en",
      };
      config.isPublicUser = true;
      await setJwt(loginResult);
      config.jwt = loginResult;
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
    } else if (loginResult?.alerts) {
      showAlerts(loginResult?.alerts);
    } else {
      throw new Error("The login failed.");
    }
  } catch (error) {
    console.error(error);
    showAlerts([
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
      await removeJwt();
      clearHistory();
      config.jwt = undefined;
      const page = await router.resolve({
        pathname: "get/auth/login",
        entryView: config.entry_point,
        versionTag: config.version_tag,
      });
      await replaceIframe(page.content);
    } else throw new Error("Unable to logout.");
  } catch (error) {
    console.error("unable to logout:", error);
    showAlerts([
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

export async function removeJwt() {
  await saltcorn.data.db.deleteWhere("jwt_table");
}

export async function setJwt(jwt) {
  await removeJwt();
  await saltcorn.data.db.insert("jwt_table", { jwt: jwt });
}

export async function checkJWT(jwt) {
  if (jwt && jwt !== "undefined") {
    const response = await apiCall({
      method: "GET",
      path: "/auth/authenticated",
      timeout: 10000,
    });
    return response.data.authenticated;
  } else return false;
}
