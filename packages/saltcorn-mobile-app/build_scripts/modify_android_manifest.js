const { parseStringPromise, Builder } = require("xml2js");
const { join } = require("path");
const { readFileSync, writeFileSync } = require("fs");

const readMobileConfig = () => {
  console.log("Reading mobile config");
  const content = readFileSync(
    "/saltcorn-mobile-app/saltcorn-mobile-cfg.json",
    "utf8"
  );
  console.log(content);
  return JSON.parse(content);
};

(async () => {
  try {
    const { permissions, features } = readMobileConfig();
    const androidManifest = join(
      "android",
      "app",
      "src",
      "main",
      "AndroidManifest.xml"
    );
    const content = readFileSync(androidManifest);
    const parsed = await parseStringPromise(content);

    parsed.manifest["uses-permission"] = permissions.map((p) => ({
      $: { "android:name": p },
    }));
    parsed.manifest["uses-feature"] = features.map((f) => ({
      $: { "android:name": f },
    }));

    parsed.manifest.application[0].$ = {
      ...parsed.manifest.application[0].$,
      "android:allowBackup": "false",
      "android:fullBackupContent": "false",
      "android:dataExtractionRules": "@xml/data_extraction_rules",
      "android:networkSecurityConfig": "@xml/network_security_config",
      "android:usesCleartextTraffic": "true",
    };
    const xmlBuilder = new Builder();
    const newCfg = xmlBuilder.buildObject(parsed);
    writeFileSync(androidManifest, newCfg);
  } catch (error) {
    console.log(
      `Unable to modify the AndroidManifest.xml: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
})();
