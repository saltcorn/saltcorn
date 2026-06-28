const fs = require("fs");
const path = require("path");
fs.copyFileSync(
  path.join(__dirname, "node", "vm.js"),
  path.join(__dirname, "..", "dist", "mobile-mocks", "node", "vm.js")
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
