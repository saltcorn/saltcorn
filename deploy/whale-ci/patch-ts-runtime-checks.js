#!/usr/bin/env node
// Applies 5 patches to the installed ts-runtime-checks@0.6.3 package so it
// compiles Saltcorn's type system without crashing or generating broken checks.
"use strict";
const fs = require("fs");
const DIST = "node_modules/ts-runtime-checks/dist";

// ── validator.js ────────────────────────────────────────────────────────────
const vpath = `${DIST}/gen/validators/validator.js`;
let v = fs.readFileSync(vpath, "utf8");

// Patch 1: getParentWithType – also match by object identity for anonymous
// types whose symbol objects differ even when logically the same type.
v = v.replace(
  "if (parent._original.symbol && parent._original.symbol === t.symbol)",
  "if (parent._original === t || (parent._original.symbol && parent._original.symbol === t.symbol))"
);

// Patch 2: translate() Recursive case – null-guard symbol.name so anonymous
// recursive types don't crash with "Cannot read properties of undefined".
v = v.replace(
  /case TypeDataKinds\.Recursive:\n(\s+)includeArticle = false;\n\s+value = this\._original\.symbol\.name;/,
  (_, indent) =>
    `case TypeDataKinds.Recursive:\n${indent}includeArticle = false;\n${indent}value = this._original.symbol ? this._original.symbol.name : "recursive";`
);

fs.writeFileSync(vpath, v);

// ── genValidator.js ──────────────────────────────────────────────────────────
const gpath = `${DIST}/gen/validators/genValidator.js`;
let g = fs.readFileSync(gpath, "utf8");

// Patch 3: skip Symbol.iterator and other built-in symbol properties
// (names starting with "__@") – they can't be runtime-checked as plain props.
g = g.replace(
  ".getProperties().map(sym => {",
  '.getProperties().filter(sym => !sym.name.startsWith("__@")).map(sym => {'
);

fs.writeFileSync(gpath, g);

// ── nodes/index.js ───────────────────────────────────────────────────────────
const npath = `${DIST}/gen/nodes/index.js`;
let n = fs.readFileSync(npath, "utf8");

// Patch 4: disable instanceof checks entirely.  ts-runtime-checks generates
// `instanceof Field` using the TS symbol name, but tsc rewrites imports to
// `field_1.default`, so the identifier is undefined at runtime.
n = n.replace(
  /case validators_1\.TypeDataKinds\.Class:\s*return \{\s*condition: \(0, expressionUtils_1\._not\)\(\(0, expressionUtils_1\._instanceof\)\(validator\.expression\(\), validator\._original\.symbol\.name\)\),\s*error: \[validator\]\s*\};/s,
  "case validators_1.TypeDataKinds.Class: return { condition: typescript_1.default.factory.createFalse(), error: [validator] };"
);

// Patch 5: isNullableNode – use loose `!= null` instead of strict
// `!== undefined` so DB nulls (nullable columns returning null) are treated
// as absent for optional properties.
n = n.replace(
  "return (0, expressionUtils_1._bin)(validator.expression(), expressionUtils_1.UNDEFINED, typescript_1.default.SyntaxKind.ExclamationEqualsEqualsToken);",
  "return (0, expressionUtils_1._bin)(validator.expression(), typescript_1.default.factory.createNull(), typescript_1.default.SyntaxKind.ExclamationEqualsToken);"
);

fs.writeFileSync(npath, n);

console.log("ts-runtime-checks patches applied (5/5)");
