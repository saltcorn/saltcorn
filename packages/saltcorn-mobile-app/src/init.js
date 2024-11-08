/*global saltcorn, cordova*/

import {
  startOfflineMode,
  offlineCallback,
  onlineCallback,
  sync,
  getLastOfflineSession,
} from "./helpers/offline_mode.js";

import { readJSON, readText } from "./helpers/file_system.js";
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

import i18next from "i18next";
import i18nextSprintfPostProcessor from "i18next-sprintf-postprocessor";
import { jwtDecode } from "jwt-decode";

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
    script.src = scriptObj.src;
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
  if (result.script?.startsWith("/")) {
    result.script = result.script.substring(1);
  }
  return result;
};

/*
  A plugin exports headers either as array, as key values object, or
  as a function with a configuration parameter that returns an Array.
*/
const collectPluginHeaders = (pluginRows) => {
  const config = saltcorn.data.state.getState().mobileConfig;
  config.pluginHeaders = [];
  for (const row of pluginRows) {
    const pluginHeaders = saltcorn[row.name].headers;
    if (pluginHeaders) {
      if (Array.isArray(pluginHeaders))
        for (const header of pluginHeaders) {
          config.pluginHeaders.push(prepareHeader(header));
        }
      else if (typeof pluginHeaders === "function") {
        const headerResult = pluginHeaders(row.configuration || {});
        if (Array.isArray(headerResult)) {
          for (const header of headerResult)
            config.pluginHeaders.push(prepareHeader(header));
        }
      } else
        for (const value of Object.values(pluginHeaders)) {
          config.pluginHeaders.push(prepareHeader(value));
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
    const localeFile = await readJSON(
      `${key}.json`,
      `${cordova.file.applicationDirectory}public/locales`
    );
    resources[key] = {
      translation: localeFile,
    };
  }
  await i18next.use(i18nextSprintfPostProcessor).init({
    lng: "en",
    resources,
  });
  saltcorn.mobileApp.i18next = i18next;
};

const readSiteLogo = async (state) => {
  try {
    const base64 = await readText(
      "encoded_site_logo.txt",
      `${cordova.file.applicationDirectory}public`
    );
    state.mobileConfig.encodedSiteLogo = base64;
  } catch (error) {
    console.log(
      `Unable to read the site logo file: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
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
  const state = saltcorn.data.state.getState();
  const mobileConfig = state.mobileConfig;
  if (mobileConfig?.allowOfflineMode) {
    mobileConfig.networkState = navigator.connection.type;
    if (
      mobileConfig.networkState === "none" &&
      !mobileConfig.isOfflineMode &&
      mobileConfig.jwt
    ) {
      try {
        await startOfflineMode();
        clearHistory();
        if (mobileConfig.user_id) await gotoEntryView();
        else {
          const decodedJwt = jwtDecode(mobileConfig.jwt);
          mobileConfig.user = decodedJwt.user;
          // TODO remove these, use 'user' everywhere
          mobileConfig.role_id = decodedJwt.user.role_id
            ? decodedJwt.user.role_id
            : 100;
          mobileConfig.user_id = decodedJwt.user.id;
          mobileConfig.user_name = decodedJwt.user.email;
          mobileConfig.language = decodedJwt.user.language;

          mobileConfig.isPublicUser = false;
        }
        addRoute({ route: mobileConfig.entry_point, query: undefined });
        const page = await router.resolve({
          pathname: mobileConfig.entry_point,
          fullWrap: true,
          alerts: [],
        });
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

// device is ready
export async function init() {
  try {
    const lastLocation = takeLastLocation();
    document.addEventListener("resume", onResume, false);
    const config = await readJSON(
      "config",
      `${cordova.file.applicationDirectory}public`
    );
    const { created_at } = await readJSON(
      "tables_created_at.json",
      `${cordova.file.applicationDirectory}${"public"}`
    );
    let tablesJSON = null;
    await addScripts(config.version_tag);
    saltcorn.data.db.connectObj.version_tag = config.version_tag;

    // const prePopDb = await copyPrepopulatedDb();

    await saltcorn.data.db.init();
    const updateNeeded = await dbUpdateNeeded(created_at);
    if (updateNeeded) {
      tablesJSON = await readJSON(
        "tables.json",
        `${cordova.file.applicationDirectory}${"public"}`
      );
      // update '_sc_plugins' first because of loadPlugins()
      await updateScPlugins(tablesJSON);
    }
    saltcorn.data.state.features.version_plugin_serve_path = false;
    const state = saltcorn.data.state.getState();
    state.mobileConfig = config;
    state.registerPlugin("base", saltcorn.base_plugin);
    state.registerPlugin("sbadmin2", saltcorn.sbadmin2);
    collectPluginHeaders(await loadPlugins(state));
    if (updateNeeded) {
      if (!tablesJSON)
        tablesJSON = await readJSON(
          "tables.json",
          `${cordova.file.applicationDirectory}${"public"}`
        );
      await updateDb(tablesJSON);
    }
    await createSyncInfoTables(config.synchedTables);
    await initJwt();
    await state.refresh_tables();
    await state.refresh_views();
    await state.refresh_pages();
    await state.refresh_page_groups();
    await state.refresh_triggers();
    state.mobileConfig.localTableIds = await getTableIds(
      config.localUserTables
    );
    await state.setConfig("base_url", config.server_path);
    // saltcorn.mobileApp.navigation.router = await initRoutes();;
    const entryPoint = config.entry_point;
    await initI18Next();
    await readSiteLogo(state);
    state.mobileConfig.networkState = navigator.connection.type;
    document.addEventListener("offline", offlineCallback, false);
    document.addEventListener("online", onlineCallback, false);
    const networkDisabled = state.mobileConfig.networkState === "none";
    const jwt = state.mobileConfig.jwt;
    const alerts = [];
    if ((networkDisabled && jwt) || (await checkJWT(jwt))) {
      const mobileConfig = state.mobileConfig;
      const decodedJwt = jwtDecode(mobileConfig.jwt);
      mobileConfig.user = decodedJwt.user;
      // TODO remove these, use 'user' everywhere
      mobileConfig.role_id = decodedJwt.user.role_id
        ? decodedJwt.user.role_id
        : 100;
      mobileConfig.user_id = decodedJwt.user.id;
      mobileConfig.user_name = decodedJwt.user.email;
      mobileConfig.language = decodedJwt.user.language;

      mobileConfig.isPublicUser = false;
      await i18next.changeLanguage(mobileConfig.language);
      if (mobileConfig.allowOfflineMode) {
        const { offlineUser } = (await getLastOfflineSession()) || {};
        if (networkDisabled) {
          if (offlineUser && offlineUser !== mobileConfig.user_name)
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
          if (offlineUser === mobileConfig.user_name) {
            await sync();
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
          await sync();
          alerts.push({
            type: "info",
            msg: "Synchronized your offline data.",
          });
        }
      }
      let page = null;
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
      const config = state.mobileConfig;
      config.user = { role_id: 100, user_name: "public", language: "en" };
      // TODO remove these, use 'user' everywhere
      config.role_id = 100;
      config.user_name = "public";
      config.language = "en";

      config.isPublicUser = true;
      i18next.changeLanguage(config.language);
      addRoute({ route: entryPoint, query: undefined });
      const page = await router.resolve({
        pathname: entryPoint,
        fullWrap: true,
        alerts,
      });
      if (page.content) await replaceIframe(page.content, page.isFile);
    } else if (
      (await isPublicEntryPoint(entryPoint)) &&
      state.mobileConfig.autoPublicLogin
    ) {
      if (networkDisabled)
        throw new Error(
          "No internet connection or previous login is available. " +
            "Please go online and reload, the public login is not yet supported."
        );
      await publicLogin(entryPoint);
    } else await showLogin(alerts);
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
