import { init } from "./init";
import * as api from "./helpers/api";
import * as auth from "./helpers/auth";
import * as common from "./helpers/common";
import * as fileSystem from "./helpers/file_system";
import * as navigation from "./helpers/navigation";
import * as offlineMode from "./helpers/offline_mode";
import * as dbSchema from "./helpers/db_schema";
import { router } from "./routing/index";

// included when push notifications or push sync is enabled
let notifications = undefined;
try {
  notifications = require("./helpers/notifications");
  console.log("Notifications module available");  
} catch (err) {
  console.log("Notifications module not available");
}

// included when periodic background sync is enabled
let backgroundSync = undefined;
try {
  backgroundSync = require("./helpers/background_sync");
  console.log("Background sync module available");  
}
catch (err) {
  console.log("Background sync module not available");
}

// include code placed in a mobile-app directory inside plugins
const plugins = {};
const context = require.context("./plugins-code", true, /index\.js$/);
context.keys().forEach((key) => {
  const tokens = key.split("/");
  const pluginName = tokens[tokens.length - 2];
  plugins[pluginName] = context(key);
});

export const mobileApp = {
  init,
  api,
  auth,
  common,
  fileSystem,
  navigation: { ...navigation, router },
  offlineMode,
  dbSchema,
  ...(notifications ? { notifications } : {}),
  ...(backgroundSync ? { backgroundSync } : {}),
  plugins,
};
