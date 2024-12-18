const { join } = require("path");
const { readFileSync, writeFileSync } = require("fs");

console.log("Writing gradle config");
console.log("args", process.argv);
const args = process.argv.slice(2);
const appVersion = args[0].split("=")[1];

const gradleFile = join(__dirname, "..", "android", "app", "build.gradle");
const gradleContent = readFileSync(gradleFile, "utf8");

// generate versionCode from appVersion
const parts = appVersion.split(".");
const versionCode =
  parseInt(parts[0]) * 1000000 + parseInt(parts[1]) * 1000 + parseInt(parts[2]);
let newGradleContent = gradleContent
  .replace(/versionName "1.0"/, `versionName "${appVersion}"`)
  .replace(/versionCode 1/, `versionCode ${versionCode}`);

console.log("newGradleContent", newGradleContent);
writeFileSync(gradleFile, newGradleContent, "utf8");
