// CommonJS interop shim for @saltcorn/postgres/postgres.
//
// Before the ESM conversion this module's export was a function:
//   const { select, insert } = require("@saltcorn/postgres/postgres")(getConnectObject);
// Out-of-tree CommonJS plugins still rely on that, so the "require" condition
// of the package "exports" map routes here. The export is a callable that runs
// init() and returns the module namespace; the namespace members are also
// exposed on it (as live getters) so property access works without calling it.
"use strict";
const m = require("../dist/postgres.js");

const postgres = (getConnectObject) => {
  m.init(getConnectObject);
  return m;
};

for (const k of Object.keys(m)) {
  if (k === "default" || k === "__esModule") continue;
  Object.defineProperty(postgres, k, {
    get: () => m[k],
    enumerable: true,
    configurable: true,
  });
}

module.exports = postgres;
