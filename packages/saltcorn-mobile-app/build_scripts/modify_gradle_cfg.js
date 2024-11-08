const { join } = require("path");
const { readFileSync, writeFileSync } = require("fs");

console.log("Writing gradle config");
console.log("args", process.argv);

const args = process.argv.slice(2);
const keyStoreFile = args[0].split("=")[1];
const keyStoreAlias = args[1].split("=")[1];
const keyStorePassword = args[2].split("=")[1];

const gradleFile = join(__dirname, "android", "app", "build.gradle");
const gradleContent = readFileSync(gradleFile, "utf8");
const newGradleContent = gradleContent
  .replace(
    /release\s*{/,
    `release { 
            signingConfig signingConfigs.release`
  )
  .replace(
    /buildTypes\s*{/,
    `
      signingConfigs {
          release {
              keyAlias '${keyStoreAlias}'
              keyPassword '${keyStorePassword}'
              storeFile file('${keyStoreFile}')
              storePassword '${keyStorePassword}'
          }
        }
    buildTypes {`
  );
console.log("newGradleContent", newGradleContent);
writeFileSync(gradleFile, newGradleContent, "utf8");
