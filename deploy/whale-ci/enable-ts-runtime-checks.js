#!/usr/bin/env node
// Activates ts-runtime-checks for Saltcorn's CI build in four steps:
//   1. Adds ts-runtime-checks@^0.6.3 to root package.json devDependencies
//   2. Injects the ts-runtime-checks plugin into each package's tsconfig.json
//   3. Runs `npm install --legacy-peer-deps`
//   4. Applies 5 patches to fix Saltcorn-specific ts-runtime-checks crashes
//
// Uncomment in Dockerfile.dev to enable:
//   RUN node deploy/whale-ci/enable-ts-runtime-checks.js
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");

function step(msg) { console.log(`\n==> ${msg}`); }
function fail(msg, err) {
  console.error(`\nERROR: ${msg}`);
  if (err) console.error(err.message || String(err));
  process.exit(1);
}

// Step 1: add ts-runtime-checks to package.json
step("Adding ts-runtime-checks@^0.6.3 to package.json devDependencies");
const pkgPath = path.join(ROOT, "package.json");
let pkg;
try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); }
catch (e) { fail("Could not read package.json", e); }
pkg.devDependencies = pkg.devDependencies || {};
pkg.devDependencies["ts-runtime-checks"] = "^0.6.3";
try { fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n"); }
catch (e) { fail("Could not write package.json", e); }
console.log("  done");

// Step 2: inject plugin into each tsconfig.json
const TSCONFIGS = [
  "packages/saltcorn-data/tsconfig.json",
  "packages/saltcorn-markup/tsconfig.json",
  "packages/saltcorn-types/tsconfig.json",
  "packages/db-common/tsconfig.json",
  "packages/saltcorn-admin-models/tsconfig.json",
  "packages/common-code/tsconfig.json",
  "packages/sqlite/tsconfig.json",
  "packages/sqlite-mobile/tsconfig.json",
  "packages/saltcorn-mobile-builder/tsconfig.json",
];

const PLUGIN_LINE = '    "plugins": [{ "transform": "ts-runtime-checks", "assertAll": true }]';

step(`Injecting ts-runtime-checks plugin into ${TSCONFIGS.length} tsconfig.json files`);
for (const rel of TSCONFIGS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { fail(`tsconfig not found: ${rel}`); }
  let content;
  try { content = fs.readFileSync(file, "utf8"); }
  catch (e) { fail(`Could not read ${rel}`, e); }

  if (content.includes('"ts-runtime-checks"')) {
    console.log(`  skipped (already present): ${rel}`);
    continue;
  }

  const patched = content.replace(
    /("target":\s*"ES2021")(\s*\n\s*\})/,
    `$1,\n${PLUGIN_LINE}$2`
  );
  if (patched === content) {
    fail(`Could not inject plugin into ${rel} — expected '"target": "ES2021"' line not found`);
  }
  try { fs.writeFileSync(file, patched); }
  catch (e) { fail(`Could not write ${rel}`, e); }
  console.log(`  patched: ${rel}`);
}

// Step 3: npm install 
step("Running npm install --legacy-peer-deps");
try {
  execSync("npm install --legacy-peer-deps", { cwd: ROOT, stdio: "inherit" });
} catch (e) { fail("npm install failed", e); }

// Step 4: patch ts-runtime-checks internals (5 patches)
step("Patching ts-runtime-checks internals");
const DIST = path.join(ROOT, "node_modules/ts-runtime-checks/dist");
if (!fs.existsSync(DIST)) {
  fail("ts-runtime-checks dist not found — npm install may have failed silently");
}

// validator.js — patches 1 & 2
const vpath = path.join(DIST, "gen/validators/validator.js");
let v;
try { v = fs.readFileSync(vpath, "utf8"); }
catch (e) { fail(`Could not read ${vpath}`, e); }

// Patch 1: object identity match for anonymous types whose symbols differ
v = v.replace(
  "if (parent._original.symbol && parent._original.symbol === t.symbol)",
  "if (parent._original === t || (parent._original.symbol && parent._original.symbol === t.symbol))"
);

// Patch 2: null-guard symbol.name for anonymous recursive types
v = v.replace(
  /case TypeDataKinds\.Recursive:\n(\s+)includeArticle = false;\n\s+value = this\._original\.symbol\.name;/,
  (_, indent) =>
    `case TypeDataKinds.Recursive:\n${indent}includeArticle = false;\n${indent}value = this._original.symbol ? this._original.symbol.name : "recursive";`
);
try { fs.writeFileSync(vpath, v); }
catch (e) { fail(`Could not write ${vpath}`, e); }
console.log("  validator.js (1-2/5)");

// genValidator.js — patch 3
const gpath = path.join(DIST, "gen/validators/genValidator.js");
let g;
try { g = fs.readFileSync(gpath, "utf8"); }
catch (e) { fail(`Could not read ${gpath}`, e); }

// Patch 3: skip Symbol.iterator and other built-in symbol properties (__@ prefix)
g = g.replace(
  ".getProperties().map(sym => {",
  '.getProperties().filter(sym => !sym.name.startsWith("__@")).map(sym => {'
);
try { fs.writeFileSync(gpath, g); }
catch (e) { fail(`Could not write ${gpath}`, e); }
console.log("  genValidator.js (3/5)");

// nodes/index.js — patches 4 & 5
const npath = path.join(DIST, "gen/nodes/index.js");
let n;
try { n = fs.readFileSync(npath, "utf8"); }
catch (e) { fail(`Could not read ${npath}`, e); }

// Patch 4: disable instanceof checks (tsc rewrites import names so they don't resolve)
n = n.replace(
  /case validators_1\.TypeDataKinds\.Class:\s*return \{\s*condition: \(0, expressionUtils_1\._not\)\(\(0, expressionUtils_1\._instanceof\)\(validator\.expression\(\), validator\._original\.symbol\.name\)\),\s*error: \[validator\]\s*\};/s,
  "case validators_1.TypeDataKinds.Class: return { condition: typescript_1.default.factory.createFalse(), error: [validator] };"
);

// Patch 5: use `!= null` instead of `!== undefined` for nullable optional props
n = n.replace(
  "return (0, expressionUtils_1._bin)(validator.expression(), expressionUtils_1.UNDEFINED, typescript_1.default.SyntaxKind.ExclamationEqualsEqualsToken);",
  "return (0, expressionUtils_1._bin)(validator.expression(), typescript_1.default.factory.createNull(), typescript_1.default.SyntaxKind.ExclamationEqualsToken);"
);
try { fs.writeFileSync(npath, n); }
catch (e) { fail(`Could not write ${npath}`, e); }
console.log("  nodes/index.js (4-5/5)");

step("ts-runtime-checks enabled successfully — all 5 patches applied");
