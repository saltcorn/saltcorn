/*global saltcorn, Capacitor, cordova, _test_schema_ */

import {
  startOfflineMode,
  networkChangeCallback,
  sync,
  getLastOfflineSession,
} from "./helpers/offline_mode.js";
import {
  updateScPlugins,
  createSyncInfoTables,
  dbUpdateNeeded,
  updateDb,
  getTableIds,
  createJwtTable,
} from "./helpers/db_schema.js";
import { publicLogin, checkJWT } from "./helpers/auth.js";
import { router } from "./routing/index.js";
import {
  replaceIframe,
  clearHistory,
  gotoEntryView,
  addRoute,
} from "./helpers/navigation.js";
import {
  checkSendIntentReceived,
  tryInitBackgroundSync,
  tryInitPush,
} from "./helpers/common.js";
import { readJSONCordova, readTextCordova } from "./helpers/file_system.js";

import i18next from "i18next";
import i18nextSprintfPostProcessor from "i18next-sprintf-postprocessor";
import { jwtDecode } from "jwt-decode";

import { Network } from "@capacitor/network";
import { App } from "@capacitor/app";

import { defineCustomElements } from "jeep-sqlite/loader";

async function addScript(scriptObj) {
  let waited = 0;
  const maxWait = 3000;

  const moduleAvailable = () =>
    window.saltcorn && window.saltcorn[scriptObj.name];

  return new Promise((resolve, reject) => {
    let script = document.createElement("script");
    document.head.appendChild(script);

    const waitForModule = () => {
      waited += 100;
      if (waited >= maxWait)
        return reject(`unable to load '${scriptObj.name}'`);
      console.log("waiting for " + scriptObj.name);
      setTimeout(function () {
        if (moduleAvailable()) return resolve();
        else waitForModule();
      }, 100);
    };

    script.onload = () => {
      if (!scriptObj.name || moduleAvailable()) return resolve();
      waitForModule();
    };
    script.src = scriptObj.src || scriptObj.script;
  });
}

async function loadPlugin(plugin) {
  await addScript({
    src: `js/bundle/${plugin.name}.bundle.js`,
    name: plugin.name,
  });
}

async function loadPlugins(state) {
  const plugins = (await saltcorn.data.models.Plugin.find()).filter(
    (plugin) => !["base", "sbadmin2"].includes(plugin.name)
  );
  for (const plugin of plugins) {
    await loadPlugin(plugin);
    state.registerPlugin(
      plugin.name,
      saltcorn[plugin.name],
      plugin.configuration
    );
  }
  return plugins;
}

/**
 * add <script> tags dynamically
 */
async function addScripts(version_tag) {
  const scripts = [
    { src: `static_assets/${version_tag}/jquery-3.6.0.min.js` },
    { src: "js/bundle/common_chunks.bundle.js" },
    { src: "js/bundle/markup.bundle.js", name: "markup" },
    { src: "js/bundle/data.bundle.js", name: "data" },
    { src: "js/bundle/base_plugin.bundle.js", name: "base_plugin" },
    { src: "js/bundle/sbadmin2.bundle.js", name: "sbadmin2" },
  ];
  for (const script of scripts) {
    await addScript(script);
  }
}

const prepareHeader = (header) => {
  let result = Object.assign({}, header);
  const replacer = (key) => {
    const value = header[key];
    if (value?.startsWith("/plugins") || value?.startsWith("plugins"))
      result[key] = value.replace(/^\/?plugins/, "sc_plugins");
  };
  replacer("script");
  replacer("css");
  return result;
};

/*
  A plugin exports headers either as array, as key values object, or
  as a function with a configuration parameter that returns an Array.

  If mobile_top_scope is set, the script is added to the index.html <head>
  otherwise it will be added to the iframe headers
*/
const handlePluginHeaders = async (plugins) => {
  const config = saltcorn.data.state.getState().mobileConfig;
  config.pluginHeaders = [];

  const handler = async (header) => {
    if (header.mobile_top_scope) await addScript(prepareHeader(header));
    else config.pluginHeaders.push(prepareHeader(header));
  };

  for (const plugin of plugins) {
    const pluginHeaders = saltcorn[plugin.name].headers;
    if (pluginHeaders) {
      if (Array.isArray(pluginHeaders)) {
        for (const header of pluginHeaders) await handler(header);
      } else if (typeof pluginHeaders === "function") {
        const headerResult = pluginHeaders(plugin.configuration || {});
        if (Array.isArray(headerResult)) {
          for (const header of headerResult) await handler(header);
        }
      } else {
        for (const header of Object.values(pluginHeaders))
          await handler(header);
      }
    }
  }
};

const getJwt = async () => {
  const rows = await saltcorn.data.db.select("jwt_table");
  return rows?.length > 0 ? rows[0].jwt : null;
};

const initJwt = async () => {
  if (!(await saltcorn.data.db.tableExists("jwt_table"))) {
    await createJwtTable();
  } else {
    const jwt = await getJwt();
    if (jwt) {
      const state = saltcorn.data.state.getState();
      state.mobileConfig.jwt = jwt;
    }
  }
};

const initI18Next = async () => {
  const resources = {};
  for (const key of Object.keys(
    saltcorn.data.models.config.available_languages
  )) {
    if (Capacitor.getPlatform() !== "web") {
      const localeFile = await readJSONCordova(
        `${key}.json`,
        `${cordova.file.applicationDirectory}public/data/locales`
      );
      resources[key] = {
        translation: localeFile,
      };
    }
  }
  await i18next.use(i18nextSprintfPostProcessor).init({
    lng: "en",
    resources,
  });
};

const showErrorPage = async (error) => {
  const state = saltcorn.data.state.getState();
  state.mobileConfig.inErrorState = true;
  const page = await router.resolve({
    pathname: "get/error_page",
    fullWrap: true,
    alerts: [
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ],
  });
  await replaceIframe(page.content);
};

// the app comes back from background
const onResume = async () => {
  if (typeof saltcorn === "undefined") return;
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  if (mobileConfig?.allowOfflineMode && mobileConfig.jwt) {
    const netStatus = await Network.getStatus();
    mobileConfig.networkState = netStatus.connectionType;
    if (mobileConfig.networkState === "none" && !mobileConfig.isOfflineMode) {
      try {
        await startOfflineMode();
        clearHistory();
        if (mobileConfig.user?.id) await gotoEntryView();
      } catch (error) {
        await showErrorPage(error);
      }
    } else if (
      mobileConfig.networkState !== "none" &&
      mobileConfig.syncOnAppResume
    ) {
      try {
        await sync(false, false, []);
      } catch (error) {
        await showErrorPage(error);
      }
    }
  }
};

const isPublicJwt = (jwt) => {
  try {
    if (!jwt) return false;
    const decoded = jwtDecode(jwt);
    return decoded.sub === "public";
  } catch (error) {
    console.log(
      `Unable to inspect '${jwt}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

const isPublicEntryPoint = async (entryPoint) => {
  if (!entryPoint) return false;
  try {
    const tokens = entryPoint.split("/");
    if (tokens.length < 3) throw new Error("The format is incorrect");
    const name = tokens[tokens.length - 1];
    const entryObj =
      tokens[tokens.length - 2] === "view"
        ? saltcorn.data.models.View.findOne({ name: name })
        : saltcorn.data.models.Page.findOne({ name: name });
    if (!entryObj) throw new Error(`The object '${name}' does not exist`);
    else return entryObj.min_role === 100;
  } catch (error) {
    console.log(
      `Unable to inspect '${entryPoint}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

const showLogin = async (alerts) => {
  const page = await router.resolve({
    pathname: "get/auth/login",
    alerts,
  });
  await replaceIframe(page.content);
};

const takeLastLocation = () => {
  let result = null;
  const lastLocation = localStorage.getItem("lastLocation");
  localStorage.removeItem("lastLocation");
  if (lastLocation) {
    try {
      result = JSON.parse(lastLocation);
    } catch (error) {
      console.log(
        `Unable to parse the last location: ${
          error.message ? error.message : "Unknown error"
        }`
      );
    }
  }
  return result;
};

const notEmpty = (shareData) => {
  for (const value of Object.values(shareData)) {
    if (typeof value === "string" && value.trim() !== "") return true;
  }
};

const postShare = async (shareData) => {
  const page = await router.resolve({
    pathname: "post/notifications/share",
    shareData,
    fullWrap: true,
    isSendIntentActivity: true,
  });
  return await replaceIframe(page.content);
};

const readSchemaIfNeeded = async () => {
  if (Capacitor.getPlatform() !== "web") {
    let tablesJSON = null;
    const { created_at } = await readJSONCordova(
      "tables_created_at.json",
      `${cordova.file.applicationDirectory}${"public"}/data`
    );
    const updateNeeded = await dbUpdateNeeded(created_at);
    if (updateNeeded) {
      tablesJSON = await readJSONCordova(
        "tables.json",
        `${cordova.file.applicationDirectory}${"public"}/data`
      );
    }
    return { updateNeeded, tablesJSON };
  } else {
    // test environment
    return { updateNeeded: true, tablesJSON: _test_schema_ };
  }
};

const readSiteLogo = async () => {
  if (Capacitor.getPlatform() === "web") return "";
  try {
    const base64 = await readTextCordova(
      "encoded_site_logo.txt",
      `${cordova.file.applicationDirectory}public/data`
    );
    return base64;
  } catch (error) {
    console.log(
      `Unable to read the site logo file: ${
        error.message ? error.message : "Unknown error"
      }`
    );
    return "";
  }
};

// fixed entry point or by role
const getEntryPoint = (roleId, state, mobileConfig) => {
  let entryPoint = null;
  if (mobileConfig.entryPointType === "byrole") {
    const homepageByRole = state.getConfig("home_page_by_role", {})[roleId];
    if (homepageByRole) entryPoint = `get/page/${homepageByRole}`;
  } else entryPoint = mobileConfig.entry_point;

  return entryPoint;
};

// device is ready
export async function init(mobileConfig) {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === "web") {
      defineCustomElements(window);
      await customElements.whenDefined("jeep-sqlite");
      const jeepSqlite = document.createElement("jeep-sqlite");
      document.body.appendChild(jeepSqlite);
      await jeepSqlite.componentOnReady();
    } else if (platform === "android") {
      App.addListener("backButton", async ({ canGoBack }) => {
        await saltcorn.mobileApp.navigation.goBack(1, true);
      });
    }
    // see navigation.js for ios

    App.addListener("appUrlOpen", async (event) => {
      try {
        const url = event.url;
        if (url.startsWith("mobileapp://auth/callback")) {
          const token = new URL(url).searchParams.get("token");
          const method = new URL(url).searchParams.get("method");
          const methods = saltcorn.data.state.getState().auth_methods;
          if (!methods[method])
            throw new Error(`Authentication method '${method}' not found.`);
          const modName = methods[method].module_name;
          if (!modName)
            throw new Error(`Module name for '${method}' is not defined.`);
          const authModule = saltcorn.mobileApp.plugins[modName];
          if (!authModule)
            throw new Error(`Authentication module '${modName}' not found.`);
          await authModule.finishLogin(token);
        }
      } catch (error) {
        await showErrorPage(error);
      }
    });

    const lastLocation = takeLastLocation();
    document.addEventListener("resume", onResume, false);
    await addScripts(mobileConfig.version_tag);
    saltcorn.data.db.connectObj.version_tag = mobileConfig.version_tag;

    await saltcorn.data.db.init();
    const { updateNeeded, tablesJSON } = await readSchemaIfNeeded();
    if (updateNeeded) {
      // update '_sc_plugins' first because of loadPlugins()
      await updateScPlugins(tablesJSON);
    }
    const state = saltcorn.data.state.getState();
    state.mobileConfig = mobileConfig;
    state.mobileConfig.user = {};
    state.registerPlugin("base", saltcorn.base_plugin);
    state.registerPlugin("sbadmin2", saltcorn.sbadmin2);
    await handlePluginHeaders(await loadPlugins(state));
    if (updateNeeded) {
      await updateDb(tablesJSON);
    }
    await createSyncInfoTables(mobileConfig.synchedTables);
    await initJwt();
    await state.refresh_tables();
    await state.refresh_views();
    await state.refresh_pages();
    await state.refresh_page_groups();
    await state.refresh_triggers();
    state.mobileConfig.localTableIds = await getTableIds(
      mobileConfig.localUserTables
    );
    await state.setConfig("base_url", mobileConfig.server_path);
    await initI18Next();
    state.mobileConfig.encodedSiteLogo = await readSiteLogo();
    state.mobileConfig.networkState = (
      await Network.getStatus()
    ).connectionType;
    if (Capacitor.getPlatform() === "android") {
      const shareData = await checkSendIntentReceived();
      if (shareData) return await postShare(shareData);
    } else if (Capacitor.getPlatform() === "ios") {
      window.addEventListener("sendIntentReceived", async () => {
        const shareData = await checkSendIntentReceived();
        if (shareData && notEmpty(shareData)) return await postShare(shareData);
      });
    }
    Network.addListener("networkStatusChange", networkChangeCallback);

    const networkDisabled = state.mobileConfig.networkState === "none";
    const jwt = state.mobileConfig.jwt;
    const alerts = [];
    if ((networkDisabled && jwt) || (await checkJWT(jwt))) {
      // already logged in, continue
      const mobileConfig = state.mobileConfig;
      const decodedJwt = jwtDecode(mobileConfig.jwt);
      mobileConfig.user = decodedJwt.user;
      mobileConfig.isPublicUser = false;
      await i18next.changeLanguage(mobileConfig.user.language);
      if (mobileConfig.allowOfflineMode) {
        const { offlineUser } = (await getLastOfflineSession()) || {};
        if (networkDisabled) {
          if (offlineUser && offlineUser !== mobileConfig.user.email)
            throw new Error(
              `The offline mode is not available, '${offlineUser}' has not yet uploaded offline data.`
            );
          else
            try {
              await startOfflineMode();
            } catch (error) {
              throw new Error(
                `Neither an internet connection nor the offline mode are available: ${
                  error.message ? error.message : "Unknown error"
                }`
              );
            }
        } else if (offlineUser) {
          if (offlineUser === mobileConfig.user.email) {
            await sync(true, true, alerts);
            alerts.push({
              type: "info",
              msg: "Synchronized your offline data.",
            });
          } else
            alerts.push({
              type: "warning",
              msg: `'${offlineUser}' has not yet uploaded offline data.`,
            });
        } else {
          await sync(true, true, alerts);
          alerts.push({
            type: "info",
            msg: "Synchronized your offline data.",
          });
        }
      }

      await tryInitPush(mobileConfig);
      await tryInitBackgroundSync(mobileConfig);

      if (Capacitor.getPlatform() === "ios") {
        const shareData = await checkSendIntentReceived();
        if (shareData && notEmpty(shareData)) return await postShare(shareData);
      }
      let page = null;
      const entryPoint = getEntryPoint(
        mobileConfig.user.role_id,
        state,
        mobileConfig
      );
      if (!entryPoint) throw new Error("No entry point defined for this role.");
      if (!lastLocation) {
        addRoute({ route: entryPoint, query: undefined });
        page = await router.resolve({
          pathname: entryPoint,
          fullWrap: true,
          alerts,
        });
      } else {
        addRoute({
          route: lastLocation.route,
          query: lastLocation.query,
        });
        page = await router.resolve({
          pathname: lastLocation.route,
          query: lastLocation.query,
          fullWrap: true,
          alerts,
        });
      }
      if (page.content) await replaceIframe(page.content, page.isFile);
    } else if (isPublicJwt(jwt)) {
      // already logged in as public
      const config = state.mobileConfig;
      config.user = { role_id: 100, email: "public", language: "en" };
      config.isPublicUser = true;
      i18next.changeLanguage(config.user.language);
      const entryPoint = getEntryPoint(100, state, state.mobileConfig);
      if (!entryPoint) await showLogin(alerts);
      else {
        addRoute({ route: entryPoint, query: undefined });
        const page = await router.resolve({
          pathname: entryPoint,
          fullWrap: true,
          alerts,
        });
        if (page.content) await replaceIframe(page.content, page.isFile);
      }
    } else if (
      (await isPublicEntryPoint(
        getEntryPoint(100, state, state.mobileConfig)
      )) &&
      state.mobileConfig.autoPublicLogin
    ) {
      // try autoPublicLogin
      if (networkDisabled)
        throw new Error(
          "No internet connection or previous login is available. " +
            "Please go online and reload, the public login is not yet supported."
        );
      await publicLogin(getEntryPoint(100, state, state.mobileConfig));
    } else {
      // open login page
      await showLogin(alerts);
    }
  } catch (error) {
    if (typeof saltcorn === "undefined" || typeof router === "undefined") {
      const msg = `An error occured: ${
        error.message ? error.message : "Unknown error"
      }`;
      console.log(msg);
      alert(msg);
    } else {
      if (error.httpCode === 401) await showLogin([]);
      else await showErrorPage(error);
    }
  }
}
