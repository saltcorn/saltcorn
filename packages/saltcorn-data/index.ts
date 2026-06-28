/**
 * This is saltcorn data
 * @module
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import * as _utils from "./utils.js";
import db from "./db/index.js";
export { db };

import * as state from "./db/state.js";
export { state };

export * as models from "./models/index.js";

import * as pluginHelper from "./plugin-helper.js";
export namespace plugin_helper {
  export const { run_action_column } = pluginHelper;
}

export namespace utils {
  export const { NotAuthorized, sleep, isPushEnabled } = _utils;
}

import * as web_mobile_commons from "./web-mobile-commons.js";
export { web_mobile_commons };

export let migrations: any = {};
function requireAll(context: any) {
  for (let key of context.keys()) {
    const fileName = key.substring(2, key.length - 3);
    // bring webpack to bundle all .js files in migrations
    const step = require("./migrations/" + fileName + ".js");
    migrations[fileName] = step;
  }
}
if (!db.is_node) {
  // webpack context for all possible .js files in migrations
  // @ts-ignore
  requireAll(require.context("./migrations/", false, /\.js$/));
}
