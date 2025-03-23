import { init } from "./init";
import * as api from "./helpers/api";
import * as auth from "./helpers/auth";
import * as common from "./helpers/common";
import * as fileSystem from "./helpers/file_system";
import * as navigation from "./helpers/navigation";
import * as offlineMode from "./helpers/offline_mode";
import * as dbSchema from "./helpers/db_schema";
import { router } from "./routing/index";

const plugins = {};
const context = require.context("./plugins-code", true, /index\.js$/);
context.keys().forEach((key) => {
  const pluginName = key.split("/")[1];
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
  plugins,
};
