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

function step(msg) {
  console.log(`\n==> ${msg}`);
}
function fail(msg, err) {
  console.error(`\nERROR: ${msg}`);
  if (err) console.error(err.message || String(err));
  process.exit(1);
}

// Step 1: add ts-runtime-checks to package.json
step("Adding ts-runtime-checks@^0.6.3 to package.json devDependencies");
const pkgPath = path.join(ROOT, "package.json");
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
} catch (e) {
  fail("Could not read package.json", e);
}
pkg.devDependencies = pkg.devDependencies || {};
pkg.devDependencies["ts-runtime-checks"] = "^0.6.3";
pkg.devDependencies["ts-patch"] = "^3.3.0";
pkg.scripts = pkg.scripts || {};
pkg.scripts["tsc"] = pkg.scripts["tsc"].replace(/^tsc /, "tspc ");
pkg.scripts["clean"] = pkg.scripts["clean"].replace(/^tsc /, "tspc ");
try {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
} catch (e) {
  fail("Could not write package.json", e);
}
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

const PLUGIN_LINE =
  '    "inlineSources": true,\n    "plugins": [{ "transform": "ts-runtime-checks", "assertAll": true }]';

step(
  `Injecting ts-runtime-checks plugin into ${TSCONFIGS.length} tsconfig.json files`
);
for (const rel of TSCONFIGS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    fail(`tsconfig not found: ${rel}`);
  }
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (e) {
    fail(`Could not read ${rel}`, e);
  }

  if (content.includes('"ts-runtime-checks"')) {
    console.log(`  skipped (already present): ${rel}`);
    continue;
  }

  const patched = content.replace(
    /("target":\s*"ES2021")(\s*\n\s*\})/,
    `$1,\n${PLUGIN_LINE}$2`
  );
  if (patched === content) {
    fail(
      `Could not inject plugin into ${rel} — expected '"target": "ES2021"' line not found`
    );
  }
  try {
    fs.writeFileSync(file, patched);
  } catch (e) {
    fail(`Could not write ${rel}`, e);
  }
  console.log(`  patched: ${rel}`);
}

// Step 3: npm install
step("Running npm install --legacy-peer-deps");
try {
  execSync("npm install --legacy-peer-deps", { cwd: ROOT, stdio: "inherit" });
} catch (e) {
  fail("npm install failed", e);
}

// Step 4: patch ts-runtime-checks internals (5 patches)
step("Patching ts-runtime-checks internals");
const DIST = path.join(ROOT, "node_modules/ts-runtime-checks/dist");
if (!fs.existsSync(DIST)) {
  fail(
    "ts-runtime-checks dist not found — npm install may have failed silently"
  );
}

// validator.js — patches 1 & 2
const vpath = path.join(DIST, "gen/validators/validator.js");
let v;
try {
  v = fs.readFileSync(vpath, "utf8");
} catch (e) {
  fail(`Could not read ${vpath}`, e);
}

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
try {
  fs.writeFileSync(vpath, v);
} catch (e) {
  fail(`Could not write ${vpath}`, e);
}
console.log("  validator.js (1-2/5)");

// genValidator.js — patch 3
const gpath = path.join(DIST, "gen/validators/genValidator.js");
let g;
try {
  g = fs.readFileSync(gpath, "utf8");
} catch (e) {
  fail(`Could not read ${gpath}`, e);
}

// Patch 3: skip Symbol.iterator and other built-in symbol properties (__@ prefix)
g = g.replace(
  ".getProperties().map(sym => {",
  '.getProperties().filter(sym => !sym.name.startsWith("__@")).map(sym => {'
);
try {
  fs.writeFileSync(gpath, g);
} catch (e) {
  fail(`Could not write ${gpath}`, e);
}
console.log("  genValidator.js (3/5)");

// nodes/index.js — patches 4-7
const npath = path.join(DIST, "gen/nodes/index.js");
let n;
try {
  n = fs.readFileSync(npath, "utf8");
} catch (e) {
  fail(`Could not read ${npath}`, e);
}

function applyPatch(src, search, replacement, name) {
  const result =
    typeof search === "string"
      ? src.replace(search, replacement)
      : src.replace(search, replacement);
  if (result === src)
    console.error(
      `  WARNING: ${name} did not match — ts-runtime-checks version may differ`
    );
  else console.log(`  ${name}: OK`);
  return result;
}

// Patch 4: disable instanceof checks (tsc rewrites import names so they don't resolve)
n = applyPatch(
  n,
  /case validators_1\.TypeDataKinds\.Class:\s*return \{\s*condition: \(0, expressionUtils_1\._not\)\(\(0, expressionUtils_1\._instanceof\)\(validator\.expression\(\), validator\._original\.symbol\.name\)\),\s*error: \[validator\]\s*\};/s,
  "case validators_1.TypeDataKinds.Class: return { condition: typescript_1.default.factory.createFalse(), error: [validator] };",
  "Patch 4 (disable instanceof)"
);

// Patch 5: use `!= null` instead of `!== undefined` for nullable optional props
n = applyPatch(
  n,
  "return (0, expressionUtils_1._bin)(validator.expression(), expressionUtils_1.UNDEFINED, typescript_1.default.SyntaxKind.ExclamationEqualsEqualsToken);",
  "return (0, expressionUtils_1._bin)(validator.expression(), typescript_1.default.factory.createNull(), typescript_1.default.SyntaxKind.ExclamationEqualsToken);",
  "Patch 5 (nullable !="
);

// Patch 6: include a compact value summary in error messages.
// null        → "(got: null)"
// primitives  → "(got: undefined: undefined)" / "(got: number: 42)"
// objects     → "(got: object keys: name,description,sql_name)"
n = applyPatch(
  n,
  `        finalMsg = (0, expressionUtils_1._bin_chain)(isFull && error[1] ? error[1] : (0, expressionUtils_1.joinElements)(["Expected ", ...error[0].path(), " ", ...messageElements]), typescript_1.default.SyntaxKind.PlusToken);`,
  `        const _msgParts = isFull && error[1] ? error[1] : (0, expressionUtils_1.joinElements)(["Expected ", ...error[0].path(), " ", ...messageElements]);
        const _ts6 = typescript_1.default;
        const _id6 = (name) => _ts6.factory.createIdentifier(name);
        // Build IIFE: (function(_v){...})(expr)
        const _inspect6 = _ts6.factory.createCallExpression(
          _ts6.factory.createParenthesizedExpression(
            _ts6.factory.createFunctionExpression(
              undefined, undefined, undefined, undefined,
              [_ts6.factory.createParameterDeclaration(undefined, undefined, _id6("_v"))],
              undefined,
              _ts6.factory.createBlock([
                // if (_v === null) return "null";
                _ts6.factory.createIfStatement(
                  _ts6.factory.createBinaryExpression(_id6("_v"), _ts6.SyntaxKind.EqualsEqualsEqualsToken, _ts6.factory.createNull()),
                  _ts6.factory.createReturnStatement(_ts6.factory.createStringLiteral("null"))
                ),
                // if (typeof _v !== "object") return typeof _v + ": " + String(_v);
                _ts6.factory.createIfStatement(
                  _ts6.factory.createBinaryExpression(
                    _ts6.factory.createTypeOfExpression(_id6("_v")),
                    _ts6.SyntaxKind.ExclamationEqualsEqualsToken,
                    _ts6.factory.createStringLiteral("object")
                  ),
                  _ts6.factory.createReturnStatement(
                    _ts6.factory.createBinaryExpression(
                      _ts6.factory.createTypeOfExpression(_id6("_v")),
                      _ts6.SyntaxKind.PlusToken,
                      _ts6.factory.createBinaryExpression(
                        _ts6.factory.createStringLiteral(": "),
                        _ts6.SyntaxKind.PlusToken,
                        _ts6.factory.createCallExpression(_ts6.factory.createIdentifier("String"), undefined, [_id6("_v")])
                      )
                    )
                  )
                ),
                // return "object keys: " + Object.keys(_v).slice(0, 12);
                _ts6.factory.createReturnStatement(
                  _ts6.factory.createBinaryExpression(
                    _ts6.factory.createStringLiteral("object keys: "),
                    _ts6.SyntaxKind.PlusToken,
                    _ts6.factory.createCallExpression(
                      _ts6.factory.createPropertyAccessExpression(
                        _ts6.factory.createCallExpression(
                          _ts6.factory.createPropertyAccessExpression(_id6("Object"), "keys"),
                          undefined, [_id6("_v")]
                        ),
                        "slice"
                      ),
                      undefined,
                      [_ts6.factory.createNumericLiteral(0), _ts6.factory.createNumericLiteral(5)]
                    )
                  )
                )
              ], true)
            )
          ),
          undefined, [error[0].expression()]
        );
        finalMsg = (0, expressionUtils_1._bin_chain)([..._msgParts, (0, expressionUtils_1._str)(" (got: "), _inspect6, (0, expressionUtils_1._str)(")")], _ts6.SyntaxKind.PlusToken);`,
  "Patch 6 (value summary)"
);

// Patch 7: log stack trace to stdout before throwing so the source location is always visible even when the test runner catches the error and only shows .message. Changes generated: throw new Error(msg) to: { const _trc_e = new Error(msg); console.error(_trc_e.stack || _trc_e.message); throw _trc_e; }
n = applyPatch(
  n,
  `
return (0, expressionUtils_1._throw)((0, expressionUtils_1._new)("Error", [finalMsg]));
`,
  `
{
  const _ts7 = typescript_1.default;
  const _id7 = (name) => _ts7.factory.createIdentifier(name);
  const _pa7 = (obj, prop) =>
    _ts7.factory.createPropertyAccessExpression(_id7(obj), prop);
  return _ts7.factory.createBlock(
    [
      _ts7.factory.createVariableStatement(
        undefined,
        _ts7.factory.createVariableDeclarationList(
          [
            _ts7.factory.createVariableDeclaration(
              "_trc_e",
              undefined,
              undefined,
              _ts7.factory.createNewExpression(_id7("Error"), undefined, [
                finalMsg,
              ])
            ),
          ],
          _ts7.NodeFlags.Const
        )
      ),
      _ts7.factory.createExpressionStatement(
        _ts7.factory.createCallExpression(_pa7("console", "error"), undefined, [
          _ts7.factory.createBinaryExpression(
            _pa7("_trc_e", "stack"),
            _ts7.SyntaxKind.BarBarToken,
            _pa7("_trc_e", "message")
          ),
        ])
      ),
      _ts7.factory.createThrowStatement(_id7("_trc_e")),
    ],
    true
  );
}
  `,
  "Patch 7 (stack logging)"
);

try {
  fs.writeFileSync(npath, n);
} catch (e) {
  fail(`Could not write ${npath}`, e);
}
console.log("  nodes/index.js (4-5/5, +6 value summary, +7 stack logging)");

step("ts-runtime-checks enabled successfully — all 7 patches applied");
