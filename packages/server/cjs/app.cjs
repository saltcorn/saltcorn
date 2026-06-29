// CJS interop shim: lets still-CommonJS consumers (CLI, random-tests) keep
// `const getApp = require("@saltcorn/server/app")` working against the ESM
// build. require(esm) returns the namespace; unwrap the default callable.
module.exports = require("../dist/app.js").default;
