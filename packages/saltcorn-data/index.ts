/**
 * This is saltcorn data
 * @module
 */
import db from "./db/index";
export { db };

import state from "./db/state";
export { state };

export * as models from "./models/index";

const pluginHelper = require("./plugin-helper");
export namespace plugin_helper {
  export const { run_action_column } = pluginHelper;
}

import web_mobile_commons from "./web-mobile-commons";
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
