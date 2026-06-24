/**
 * Preload for node's built-in test runner (`node --test`).
 *
 * The builder's test renders React components, which jest supported through
 * two facilities node:test does not provide out of the box. This preload
 * recreates both:
 *
 *  1. Transpilation of JSX + ESM. We install a require hook backed by
 *     @babel/core (already present via babel-loader) that applies the same
 *     presets as babel.config.js, but only to this package's own source -
 *     dependencies under node_modules ship runnable CommonJS and are loaded
 *     untouched.
 *
 *  2. A browser-like global environment. react-test-renderer itself needs no
 *     DOM, but the rendered components pull in libraries (e.g.
 *     @monaco-editor/react) that touch window/document at import time, so we
 *     install a jsdom global environment - the equivalent of jest's "jsdom"
 *     testEnvironment.
 *
 * The test runner forwards --require preloads to the per-file child processes,
 * so this runs before each test file is loaded.
 */
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");

// --- 1. babel require hook -------------------------------------------------
const pkgRoot = __dirname;
const nodeModules = `${path.sep}node_modules${path.sep}`;
const defaultJsLoader = Module._extensions[".js"];

Module._extensions[".js"] = function (module, filename) {
  // only this package's own sources need transpiling; deps are runnable CJS
  if (!filename.startsWith(pkgRoot) || filename.includes(nodeModules)) {
    return defaultJsLoader(module, filename);
  }
  const { code } = babel.transformFileSync(filename, {
    configFile: false,
    babelrc: false,
    sourceMaps: "inline",
    presets: [
      ["@babel/preset-env", { targets: { node: "current" } }],
      ["@babel/preset-react", { runtime: "automatic" }],
    ],
  });
  module._compile(code, filename);
};

// --- 2. jsdom global environment -------------------------------------------
const { JSDOM } = require("jsdom");
const { window } = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

global.window = window;
global.self = window;
global.document = window.document;
global.navigator = window.navigator;

// expose the remaining browser globals libraries expect (HTMLElement, Node,
// getComputedStyle, requestAnimationFrame, ...) without clobbering node's own
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in global) continue;
  try {
    global[key] = window[key];
  } catch {
    // some window properties throw on access; skip them
  }
}
