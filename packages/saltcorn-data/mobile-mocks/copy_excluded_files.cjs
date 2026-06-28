const fs = require("fs");
const path = require("path");
fs.copyFileSync(
  path.join(__dirname, "node", "vm.js"),
  path.join(__dirname, "..", "dist", "mobile-mocks", "node", "vm.js")
);
// The mobile mocks are authored/emitted as CommonJS (mobile-mocks/package.json
// marks the source dir "type": "commonjs"). The package itself is "type": "module",
// so mark the compiled mocks dir as commonjs too, otherwise Node/webpack would treat
// dist/mobile-mocks/*.js as ESM. CJS lets webpack synthesize default + named interop
// when the ESM data bundle does `import fs from "fs"` (aliased to these mocks).
fs.writeFileSync(
  path.join(__dirname, "..", "dist", "mobile-mocks", "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2)
);
// The migration files are CommonJS (module.exports). They are excluded from the
// TypeScript build (see tsconfig.json) so that their `require("@saltcorn/data/...")`
// self-references are not pulled into the type-check program, where they would fail
// to resolve before dist is emitted and poison tsc --build's shared resolution cache.
// Instead we copy them verbatim here. The package itself is "type": "module", so we
// also write a package.json marking dist/migrations as commonjs for Node at runtime.
const srcMigrations = path.join(__dirname, "..", "migrations");
const distMigrations = path.join(__dirname, "..", "dist", "migrations");
fs.mkdirSync(distMigrations, { recursive: true });
for (const f of fs.readdirSync(srcMigrations)) {
  if (f.endsWith(".js"))
    fs.copyFileSync(path.join(srcMigrations, f), path.join(distMigrations, f));
}
fs.writeFileSync(
  path.join(distMigrations, "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2)
);
