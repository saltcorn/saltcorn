#!/usr/bin/env node
// Adds the ts-runtime-checks plugin to the tsconfig.json passed as argv[2].
// Inserts after the last property in compilerOptions (before the closing brace).
"use strict";
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file) { console.error("Usage: add-trc-plugin.js <tsconfig.json>"); process.exit(1); }

let content = fs.readFileSync(file, "utf8");

const plugin = '    "plugins": [{ "transform": "ts-runtime-checks", "assertAll": true }]';

// Insert before the closing brace of compilerOptions.
// tsconfig files end compilerOptions with a line that is just "  }" (2-space indent).
// We add a comma to the last property and append the plugins line.
content = content.replace(
  /("target":\s*"ES2021")(\s*\n\s*\})/,
  `$1,\n${plugin}$2`
);

fs.writeFileSync(file, content);
console.log("added ts-runtime-checks plugin to", path.basename(file));
