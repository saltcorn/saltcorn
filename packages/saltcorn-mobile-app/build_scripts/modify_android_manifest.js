const { parseStringPromise, Builder } = require("xml2js");
const { join } = require("path");
const { readFileSync, writeFileSync } = require("fs");

(async () => {
  try {
    const androidManifest = join(
      "android",
      "app",
      "src",
      "main",
      "AndroidManifest.xml"
    );
    const content = readFileSync(androidManifest);
    const parsed = await parseStringPromise(content);

    parsed.manifest["uses-permission"] = [
      { $: { "android:name": "android.permission.READ_EXTERNAL_STORAGE" } },
      { $: { "android:name": "android.permission.WRITE_EXTERNAL_STORAGE" } },
      { $: { "android:name": "android.permission.INTERNET" } },
      { $: { "android:name": "android.permission.CAMERA" } },
    ];
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
