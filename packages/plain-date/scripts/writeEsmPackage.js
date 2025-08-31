const fs = require("fs");
const path = require("path");

const pkgRoot = path.resolve(__dirname, "..");
const srcDts = path.join(pkgRoot, "index.d.ts");
const distCjs = path.join(pkgRoot, "dist", "cjs");
const distEsm = path.join(pkgRoot, "dist", "esm");

if (!fs.existsSync(srcDts)) {
  console.error("index.d.ts not found at", srcDts);
  process.exit(1);
}

const src = fs.readFileSync(srcDts, "utf8");

for (const dir of [distCjs, distEsm]) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.copyFileSync(srcDts, path.join(distCjs, "index.d.ts"));

let esmDts;
const hasExportEquals = /export\s*=\s*\w+/m.test(src);
const hasExportDefault = /export\s+default/m.test(src);
const hasAnyExport = /\bexport\b/m.test(src);

if (hasExportDefault || (hasAnyExport && !hasExportEquals)) {
  esmDts = src;
} else if (hasExportEquals) {
  esmDts = [
    "// Auto-generated ESM-compatible declaration",
    'export * from "../../index";',
    'import __default = require("../../index");',
    "export default __default;",
    "",
  ].join("\n");
} else {
  esmDts = [
    "// Auto-generated ESM-compatible declaration (fallback)",
    'export * from "../../index";',
    'import __default = require("../../index");',
    "export default __default;",
    "",
  ].join("\n");
}

fs.writeFileSync(path.join(distEsm, "index.d.ts"), esmDts, "utf8");

const esmPkg = {
  type: "module",
  main: "index.js",
  types: "index.d.ts",
};

fs.writeFileSync(
  path.join(distEsm, "package.json"),
  JSON.stringify(esmPkg, null, 2) + "\n",
  "utf8"
);
