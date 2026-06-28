/**
 * This is saltcorn data
 * @module
 */
// NB: do NOT shadow `require` with createRequire here. The migrations loader
// below relies on webpack's `require.context` / dynamic `require`, which only
// exist on webpack's own `require`. That code path runs only in the mobile
// bundle (`!db.is_node`); on the Node server the block is skipped, so the
// ambient `require` is never evaluated.
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
    // load via the webpack context itself (the bundled module map); a bare
    // `require` is not available in an ESM module under webpack.
    migrations[fileName] = context(key);
  }
}
if (!db.is_node) {
  // Mobile (webpack) only: bundle every migrations/*.js so they can run against
  // the offline DB. `import.meta.webpackContext` is the ESM equivalent of the
  // old `require.context`; it is webpack-specific and undefined on Node, but
  // this branch never runs there (db.is_node is true on the server).
  // @ts-ignore
  requireAll(
    // @ts-ignore
    import.meta.webpackContext("./migrations/", {
      recursive: false,
      regExp: /\.js$/,
    })
  );
}
