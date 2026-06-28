const fs = require("fs");
const path = require("path");
fs.copyFileSync(
  path.join(__dirname, "node", "vm.js"),
  path.join(__dirname, "..", "dist", "mobile-mocks", "node", "vm.js")
);
// The migration files are CommonJS (module.exports). The package itself is
// "type": "module", so mark the compiled migrations directory as commonjs so
// Node treats dist/migrations/*.js as CJS at runtime.
const distMigrations = path.join(__dirname, "..", "dist", "migrations");
if (fs.existsSync(distMigrations)) {
  fs.writeFileSync(
    path.join(distMigrations, "package.json"),
    JSON.stringify({ type: "commonjs" }, null, 2)
  );
}
