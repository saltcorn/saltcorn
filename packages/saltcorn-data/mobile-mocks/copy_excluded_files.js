const fs = require("fs");
const path = require("path");
fs.copyFileSync(
  path.join(__dirname, "node", "vm.js"),
  path.join(__dirname, "..", "dist", "mobile-mocks", "node", "vm.js")
);
