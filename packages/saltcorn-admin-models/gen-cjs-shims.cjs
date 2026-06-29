/**
 * Generates CommonJS interop shims under ./cjs for every importable module.
 *
 * This package is ESM ("type": "module"). When an out-of-tree CommonJS package
 * does `require("@saltcorn/data/models/table")`, Node's require(ESM) returns the
 * module *namespace* ({ __esModule: true, default: Table }) rather than the
 * class itself, which breaks `const Table = require(...)`. The package "exports"
 * map routes the "require" condition to these shims, which unwrap the default
 * export so CommonJS consumers keep getting the value they got before the ESM
 * conversion. ESM consumers (the "import" condition) get ./dist directly.
 *
 * Run automatically before tsc (see package.json "pretsc"). The shims only
 * mirror the source module tree, so they can be generated without a build.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC_SKIP = new Set(["node_modules", "dist", "cjs", "mobile-mocks"]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SRC_SKIP.has(ent.name)) continue;
      walk(path.join(dir, ent.name), acc);
    } else if (
      ent.isFile() &&
      ent.name.endsWith(".ts") &&
      !ent.name.endsWith(".d.ts") &&
      !ent.name.endsWith(".test.ts")
    ) {
      acc.push(path.join(dir, ent.name));
    }
  }
  return acc;
}

const SHIM = (
  distRel
) => `// CommonJS interop shim — AUTO-GENERATED, DO NOT EDIT.
// See gen-cjs-shims.cjs.
"use strict";
const m = require(${JSON.stringify(distRel)});
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
`;

let count = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\.ts$/, "");
  const cjsPath = path.join(ROOT, "cjs", rel + ".cjs");
  const distRel =
    path.relative(path.dirname(cjsPath), path.join(ROOT, "dist", rel)) + ".js";
  const normalized = distRel.startsWith(".") ? distRel : "./" + distRel;
  fs.mkdirSync(path.dirname(cjsPath), { recursive: true });
  fs.writeFileSync(cjsPath, SHIM(normalized));
  count++;
}
console.log(`gen-cjs-shims: wrote ${count} shims under cjs/`);
