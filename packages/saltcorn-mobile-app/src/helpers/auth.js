/*global saltcorn*/

import { jwtDecode } from "jwt-decode";
import i18next from "i18next";
import { apiCall } from "./api";
import { router } from "../routing/index";
import { getLastOfflineSession, deleteOfflineData, sync } from "./offline_mode";
import { addRoute, replaceIframe } from "../helpers/navigation";
import { showAlerts } from "./common";

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

export async function login({ email, password, entryPoint, isSignup }) {
  const loginResult = await loginRequest({
    email,
    password,
    isSignup,
  });
  if (typeof loginResult === "string") {
    // use it as a token
    const decodedJwt = jwtDecode(loginResult);
    const config = saltcorn.data.state.getState().mobileConfig;
    config.user = decodedJwt.user;
    config.isPublicUser = false;
    config.isOfflineMode = false;
    await insertUser(config.user);
    await setJwt(loginResult);
    config.jwt = loginResult;
    i18next.changeLanguage(config.user.language);
    const alerts = [];
    if (config.allowOfflineMode) {
      const { offlineUser, hasOfflineData } =
        (await getLastOfflineSession()) || {};
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
    }
    alerts.push({
      type: "success",
      msg: i18next.t("Welcome, %s!", {
        postProcess: "sprintf",
        sprintf: [config.user.email],
      }),
    });
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
    const page = await router.resolve({
      pathname: "get/auth/logout",
      entryView: config.entry_point,
      versionTag: config.version_tag,
    });
    await replaceIframe(page.content);
  } catch (error) {
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
