// CommonJS interop shim — AUTO-GENERATED, DO NOT EDIT.
// See gen-cjs-shims.cjs.
"use strict";
const m = require("../../../dist/models/internal/s3_helpers.js");
const e = m && m.__esModule && "default" in m ? m.default : m;
module.exports = e;
if (e !== m && e && (typeof e === "object" || typeof e === "function")) {
  for (const k in m) {
    if (k === "default" || k === "__esModule" || k in e) continue;
    try {
      Object.defineProperty(e, k, {
        get: () => m[k],
        enumerable: true,
        configurable: true,
      });
    } catch {}
  }
}
