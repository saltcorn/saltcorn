import db from "@saltcorn/data/db/index";
import utils = require("@saltcorn/data/utils");
const { getSafeSaltcornCmd } = utils;
import { join } from "path";
import {
  existsSync,
  mkdirSync,
  copySync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "fs-extra";
import fs from "fs";
import { Row } from "@saltcorn/db-common/internal";
import { spawnSync, execSync } from "child_process";
import Page from "@saltcorn/data/models/page";
import File from "@saltcorn/data/models/file";
import type User from "@saltcorn/data/models/user";
import { getState } from "@saltcorn/data/db/state";
import type { PluginLayout } from "@saltcorn/types/base_types";
import { parseStringPromise, Builder } from "xml2js";
import { available_languages } from "@saltcorn/data/models/config";
import type { IosCfg } from "../mobile-builder";
const resizer = require("resize-with-sharp-or-jimp");

/**
 * copy saltcorn-mobile-app as a template to buildDir
 * and install the capacitor and cordova modules to node_modules (cap sync will be run later)
 * @param buildDir directory where the app will be build
 * @param templateDir directory of the template code that will be copied to 'buildDir'
 */
export function prepareBuildDir(buildDir: string, templateDir: string) {
  if (existsSync(buildDir)) rmSync(buildDir, { force: true, recursive: true });
  copySync(templateDir, buildDir);
  rmSync(`${buildDir}/node_modules`, { recursive: true, force: true });
  let result = spawnSync("npm", ["install"], {
    cwd: buildDir,
  });
  console.log(result.output.toString());

  console.log("installing capacitor deps and plugins");
  const capDepsAndPlugins = [
    "@capacitor/cli@6.1.2",
    "@capacitor/core@6.1.2",
    "@capacitor/assets@3.0.5",
    "@capacitor/filesystem@6.0.2",
    "@capacitor/camera@6.1.1",
    "@capacitor/geolocation@6.0.2",
    "@capacitor/network@6.0.3",
    "@capacitor-community/sqlite@6.0.2",
    "@capacitor/screen-orientation@6.0.3",
    "send-intent",
  ];
  result = spawnSync("npm", ["install", ...capDepsAndPlugins], {
    cwd: buildDir,
    maxBuffer: 1024 * 1024 * 10,
  });
  console.log(result.output.toString());

  console.log("installing cordova plugins");
  const cordovaPlugins = [
    "cordova-plugin-file@8.1.3",
    "cordova-plugin-inappbrowser@6.0.0",
  ];
  result = spawnSync("npm", ["install", ...cordovaPlugins], {
    cwd: buildDir,
    maxBuffer: 1024 * 1024 * 10,
  });
}

export interface ScCapacitorConfig {
  appName: string;
  appId?: string;
  appVersion: string;
  unsecureNetwork: boolean;
  keystorePath?: string;
  keystoreAlias?: string;
  keystorePassword?: string;
  keystoreAliasPassword?: string;
  buildType: string;
}

export function writeCapacitorConfig(
  buildDir: string,
  config: ScCapacitorConfig
) {
  const cfgFile = join(buildDir, "capacitor.config.ts");
  const content = `
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig  = {
  appId: '${config.appId ? config.appId : "com.saltcorn.mobile.app"}',
  appName: '${config.appName ? config.appName : "SaltcornMobileApp"}',
  webDir: "www",
  ios: {
    scheme: "SaltcornMobileApp",
  },
  android: {
    buildOptions: {
      ${
        config.keystorePath && config.buildType === "release"
          ? `keystorePath: '${config.keystorePath}',
      keystorePassword: '${config.keystorePassword}',
      keystoreAlias: '${config.keystoreAlias}',
      keystoreAliasPassword: '${config.keystoreAliasPassword}',
      `
          : ""
      }
      releaseType: '${config.buildType === "release" ? "AAB" : "APK"}',
    },
    ${config.unsecureNetwork ? "allowMixedContent: true," : ""}
  },
  ${
    config.unsecureNetwork
      ? `server: {
    cleartext: true,
    androidScheme: 'http',
  },`
      : ""
  }
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: true,
      iosKeychainPrefix: 'angular-sqlite-app-starter',
      iosBiometric: {
        biometricAuth: false,
        biometricTitle : "Biometric login for capacitor sqlite"
      },
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth : false,
        biometricTitle : "Biometric login for capacitor sqlite",
        biometricSubTitle : "Log in using your biometric"
      },
      electronIsEncryption: true,
      electronWindowsLocation: "C:\\ProgramData\\CapacitorDatabases",
      electronMacLocation: "/Volumes/Development_Lacie/Development/Databases",
      electronLinuxLocation: "Databases"
    }
  }

};

export default config;`;
  writeFileSync(cfgFile, content);
}

export function prepAppIcon(buildDir: string, appIcon: string) {
  for (const icon of [
    "icon-only",
    "icon-foreground",
    "icon-background",
    "splash",
    "splash-dark",
  ]) {
    copySync(appIcon, join(buildDir, "assets", `${icon}.png`), {
      overwrite: true,
    });
  }
}

export async function modifyAndroidManifest(buildDir: string) {
  console.log("modifyAndroidManifest");
  try {
    const androidManifest = join(
      buildDir,
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
    ];
    parsed.manifest.application[0].$ = {
      ...parsed.manifest.application[0].$,
      "android:allowBackup": "false",
      "android:fullBackupContent": "false",
      "android:dataExtractionRules": "@xml/data_extraction_rules",
      "android:networkSecurityConfig": "@xml/network_security_config",
      "android:usesCleartextTraffic": "true",
    };
    // add intent-filter for sharing
    parsed.manifest.application[0].activity[0]["intent-filter"] = [
      ...parsed.manifest.application[0].activity[0]["intent-filter"],
      {
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
        category: [
          { $: { "android:name": "android.intent.category.DEFAULT" } },
        ],
        data: [{ $: { "android:mimeType": "*/*" } }],
      },
    ];

    const xmlBuilder = new Builder();
    const newCfg = xmlBuilder.buildObject(parsed);
    writeFileSync(androidManifest, newCfg);
  } catch (error: any) {
    console.log(
      `Unable to modify the AndroidManifest.xml: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

export function writeDataExtractionRules(buildDir: string) {
  console.log("writeDataExtractionRules");
  const dataExtractionRules = join(
    buildDir,
    "android",
    "app",
    "src",
    "main",
    "res",
    "xml",
    "data_extraction_rules.xml"
  );
  writeFileSync(
    dataExtractionRules,
    `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
      <exclude domain="root" />
      <exclude domain="database" />
      <exclude domain="sharedpref" />
      <exclude domain="external" />
    </cloud-backup>
    <device-transfer>
      <exclude domain="root" />
      <exclude domain="database" />
      <exclude domain="sharedpref" />
      <exclude domain="external" />
    </device-transfer>
</data-extraction-rules>
`
  );
}

export function copyPrepopulatedDb(buildDir: string, platforms: string[]) {
  console.log("copyPrepopulatedDb", buildDir, platforms);
  if (platforms.includes("android")) {
    copySync(
      join(buildDir, "www", "scdb.sqlite"),
      join(
        buildDir,
        "android",
        "app",
        "src",
        "main",
        "assets",
        "public",
        "assets",
        "databases",
        "prepopulated.db"
      )
    );
  }
  if (platforms.includes("ios")) {
    copySync(
      join(buildDir, "www", "scdb.sqlite"),
      join(
        buildDir,
        "ios",
        "App",
        "App",
        "public",
        "assets",
        "databases",
        "prepopulated.db"
      )
    );
  }
}

export function writeNetworkSecurityConfig(
  buildDir: string,
  serverPath: string
) {
  console.log("writeNetworkSecurityConfig");
  let domain = serverPath;
  if (domain.startsWith("http://")) domain = domain.substring(7);
  if (domain.startsWith("https://")) domain = domain.substring(8);
  if (domain.endsWith("/")) domain = domain.substring(0, domain.length - 1);
  if (domain.includes(":")) domain = domain.substring(0, domain.indexOf(":"));
  const networkSecurityConfig = join(
    buildDir,
    "android",
    "app",
    "src",
    "main",
    "res",
    "xml",
    "network_security_config.xml"
  );
  writeFileSync(
    networkSecurityConfig,
    `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">${domain}</domain>
  </domain-config>
</network-security-config>
  `
  );
}

export async function modifyConfigXml(buildDir: string, config: any) {
  try {
    const configXml = join(buildDir, "config.xml");
    const content = readFileSync(configXml);
    const parsed = await parseStringPromise(content);
    if (config.appName) parsed.widget.name[0] = config.appName;
    if (config.appId) parsed.widget.$.id = config.appId;
    if (config.appVersion) parsed.widget.$.version = config.appVersion;
    const xmlBuilder = new Builder();
    const newCfg = xmlBuilder.buildObject(parsed);
    writeFileSync(configXml, newCfg);
  } catch (error: any) {
    console.log(
      `Unable to modify the config.xml: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * copy a png file into the build dir and use it as launcher icon
 * @param buildDir
 * @param appIcon path to appIcon file
 */
export async function prepareAppIcon(
  buildDir: string,
  appIcon: string,
  platforms: string[]
) {
  try {
    if (platforms.includes("android"))
      copySync(appIcon, join(buildDir, "res", "icon", "android", "icon.png"), {
        overwrite: true,
      });
    if (platforms.includes("ios")) await prepareAppIconSet(buildDir, appIcon);
  } catch (error: any) {
    console.log(
      `Unable to set the app icon '${appIcon}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * copy a png file into the build dir and use it as splash icon
 * This shows up before the splash page, while the infrastructure loads
 * TODO for now it's only one png for all sizes
 * @param buildDir
 * @param splashIcon
 * @param platforms
 */
export async function prepareSplashIcon(
  buildDir: string,
  splashIcon: string,
  platforms: string[]
) {
  try {
    if (platforms.includes("android")) {
      copySync(
        splashIcon,
        join(buildDir, "res", "screen", "android", "splash-icon.png"),
        {
          overwrite: true,
        }
      );
    }
    if (platforms.includes("ios")) {
      copySync(
        splashIcon,
        join(
          buildDir,
          "res",
          "screen",
          "ios",
          "Default@2x~universal~anyany.png"
        ),
        {
          overwrite: true,
        }
      );
    }
  } catch (error: any) {
    console.log(
      `Unable to set the splash icon '${splashIcon}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

async function prepareAppIconSet(buildDir: string, appIcon: string) {
  console.log("prepareAppIconSet", buildDir, appIcon);
  const dir = join(buildDir, "AppIcon.appiconset");
  mkdirSync(dir);
  const contentsJSON = { images: new Array<any>() };
  try {
    for (const { size, scale, idiom } of [
      { size: 29, scale: 1, idiom: "iphone" },
      { size: 20, scale: 2, idiom: "iphone" },
      { size: 40, scale: 2, idiom: "iphone" },
      { size: 57, scale: 1, idiom: "iphone" },
      { size: 60, scale: 2, idiom: "iphone" },
      { size: 76, scale: 2, idiom: "ipad" },
      { size: 83.5, scale: 2, idiom: "ipad" },
      { size: 1024, scale: 1, idiom: "ios-marketing" },
    ]) {
      const scaledSize = size * scale;
      const fileName = `${size}x${scale}.png`;
      await resizer({
        fromFileName: appIcon,
        width: scaledSize,
        height: scaledSize,
        toFileName: join(dir, fileName),
      });
      contentsJSON.images.push({
        size: `${size}x${size}`,
        idiom: idiom,
        filename: fileName,
        "expected-size": scaledSize,
        scale: `${scale}x`,
      });
    }
    writeFileSync(join(dir, "Contents.json"), JSON.stringify(contentsJSON));
  } catch (error: any) {
    console.log(
      `Unable to generate appicon set for '${appIcon}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

export function prepareExportOptionsPlist({ buildDir, appId, iosParams }: any) {
  console.log("prepareExportOptionsPlist", buildDir, appId, iosParams);
  const buildShareExtBloock = () => {
    if (!iosParams.shareExtensionProvisioningProfile) return "";
    const teamId = iosParams.appleTeamId;
    const shareExtIdentifier =
      iosParams.shareExtensionProvisioningProfile.identifier;
    return `<key>${shareExtIdentifier.replace(`${teamId}.`, "")}</key>
            <string>${
              iosParams.shareExtensionProvisioningProfile.guuid
            }</string>`;
  };
  try {
    writeFileSync(
      join(buildDir, "ExportOptions.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "~//Apple/DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
        <dict>
          <key>method</key>
          <string>app-store-connect</string>
          <key>provisioningProfiles</key>
          <dict>          
            <key>${appId}</key>
            <string>${iosParams.mainProvisioningProfile.guuid}</string>
            ${buildShareExtBloock()}
          </dict>
        </dict>

      </plist>`
    );
  } catch (error: any) {
    console.log(
      `Unable to write the ExportOptionsPlist file: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

export function modifyInfoPlist(buildDir: string, allowShareTo: boolean) {
  const infoPlist = join(buildDir, "ios", "App", "App", "Info.plist");
  const content = readFileSync(infoPlist, "utf8");

  const newCfgs = `
  <key>NSCameraUsageDescription</key>
  <string>This app requires access to the camera to take photos</string>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>This app requires access to the photo library to select photos</string>
  <key>NSPhotoLibraryAddUsageDescription</key>
  <string>This app requires access to the photo library to save photos</string>

  <key>NSLocationWhenInUseUsageDescription</key>
  <string>This app requires access to your location to save it in the database</string>

  <key>UIFileSharingEnabled</key>
  <true/>
  <key>LSSupportsOpeningDocumentsInPlace</key>
  <true/>
  ${
    allowShareTo
      ? `<key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeRole</key>
      <string>Viewer</string>
      <key>CFBundleURLName</key>
      <string>com.saltcorn.store</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>scappscheme</string>
      </array>
    </dict>
  </array>`
      : ""
  }
  `;
  // add newCfgs after the first <dict> tag
  const newContent = content.replace(/<dict>/, `<dict>${newCfgs}`);
  writeFileSync(infoPlist, newContent, "utf8");
}

export function copyShareExtFiles(buildDir: string) {
  const iosAppDir = join(buildDir, "ios", "App");
  const sefDir = join(buildDir, "share_extension_files");
  copySync(
    join(sefDir, "ShareViewController.swift"),
    join(iosAppDir, "share-ext", "ShareViewController.swift"),
    { overwrite: true }
  );
  copySync(
    join(sefDir, "Info.plist"),
    join(iosAppDir, "share-ext", "Info.plist"),
    { overwrite: true }
  );
  copySync(
    join(sefDir, "AppDelegate.swift"),
    join(iosAppDir, "App", "AppDelegate.swift"),
    { overwrite: true }
  );
}

export async function decodeProvisioningProfile(
  buildDir: string,
  provisioningProfile: string
) {
  console.log("decodeProvisioningProfile", buildDir, provisioningProfile);
  const outFile = join(buildDir, "provisioningProfile.xml");
  try {
    execSync(`security cms -D -i "${provisioningProfile}" > ${outFile}`);
    const content = readFileSync(outFile);
    const parsed = await parseStringPromise(content);
    const dict = parsed.plist.dict[0];
    const guuid = dict.string[dict.string.length - 1];
    const teamId = dict.array[0].string[0];
    const specifier = dict.string[1];
    const identifier = dict.dict[0].string[0];
    const result = { guuid, teamId, specifier, identifier };
    console.log(result);
    return result;
  } catch (error: any) {
    console.log(
      `Unable to decode the provisioning profile '${provisioningProfile}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
    throw error;
  }
}

export function writePrivacyInfo(buildDir: string) {
  const infoFile = join(buildDir, "ios", "App", "PrivacyInfo.xcprivacy");
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
      <!-- Add this dict entry to the array if the PrivacyInfo file already exists -->
      <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array>
          <string>C617.1</string>
        </array>
      </dict>
    </array>
  </dict>
</plist>`;
  writeFileSync(infoFile, content);
}

/**
 * copy files from 'server/public' into the www folder (with a version_tag prefix)
 * @param buildDir directory where the app will be build
 */
export function copyServerFiles(buildDir: string) {
  const wwwDir = join(buildDir, "www");
  // assets
  const assetsDst = join(wwwDir, "static_assets", db.connectObj.version_tag);
  if (!existsSync(assetsDst)) {
    mkdirSync(assetsDst, { recursive: true });
  }
  const serverRoot = join(require.resolve("@saltcorn/server"), "..");
  const srcPrefix = join(serverRoot, "public");
  const srcAssests = [
    "jquery-3.6.0.min.js",
    "saltcorn-common.js",
    "saltcorn.js",
    "saltcorn.css",
    "codemirror.js",
    "codemirror.css",
    "socket.io.min.js",
    "flatpickr.min.css",
    "gridedit.js",
    "flatpickr.min.js",
    "dayjs.min.js",
  ];
  for (const srcFile of srcAssests) {
    copySync(join(srcPrefix, srcFile), join(assetsDst, srcFile));
  }
  // publics
  const srcs = ["flatpickr.min.css", "flatpickr.min.js", "gridedit.js"];
  for (const srcFile of srcs) {
    copySync(join(srcPrefix, srcFile), join(wwwDir, srcFile));
  }
}

/**
 * copy files from 'startbootstrap-sb-admin-2-bs5' into the www directory
 * @param buildDir directory where the app will be build
 */
export function copySbadmin2Deps(buildDir: string) {
  const sbadmin2Dst = join(
    buildDir,
    "www",
    "sc_plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.5"
  );
  if (!existsSync(sbadmin2Dst)) {
    mkdirSync(sbadmin2Dst, { recursive: true });
  }
  const devPath = join(
    __dirname,
    "../../../..",
    "node_modules/startbootstrap-sb-admin-2-bs5"
  );
  const prodPath = join(
    require.resolve("@saltcorn/cli"),
    "../..",
    "node_modules/startbootstrap-sb-admin-2-bs5"
  );
  const srcPrefix = existsSync(devPath) ? devPath : prodPath;
  const srcFiles = [
    "vendor/fontawesome-free",
    "vendor/bootstrap/js/bootstrap.bundle.min.js",
    "vendor/jquery-easing/jquery.easing.min.js",
    "css/sb-admin-2.css",
    "js/sb-admin-2.min.js",
  ];
  for (const srcFile of srcFiles) {
    copySync(join(srcPrefix, srcFile), join(sbadmin2Dst, srcFile));
  }
}

/**
 * Copy the 'site_logo_id' file into the www folder
 * @param buildDir
 * @returns
 */
export async function copySiteLogo(buildDir: string) {
  try {
    const state = getState();
    if (!state) {
      console.log("Unable to get the state object");
    } else {
      await state.refresh_config(true);
      const siteLogo = state?.getConfig("site_logo_id");
      if (siteLogo) {
        const file = await File.findOne(siteLogo);
        if (file) {
          const base64 = readFileSync(file.location, "base64");
          writeFileSync(
            join(buildDir, "www", "data", "encoded_site_logo.js"),
            `var _sc_site_logo = "data:${file.mimetype};base64, ${base64}"`
          );
        } else {
          console.log(`The file '${siteLogo}' does not exist`);
        }
      }
    }
  } catch (error: any) {
    console.log(
      `Unable to copy the site logo: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * create a cfg file, the app use this configs
 * @param param0
 */
export function writeCfgFile({
  buildDir,
  entryPoint,
  entryPointType,
  serverPath,
  localUserTables,
  synchedTables,
  tenantAppName,
  autoPublicLogin,
  allowOfflineMode,
  allowShareTo,
}: any) {
  const wwwDir = join(buildDir, "www");
  let cfg: any = {
    version_tag: db.connectObj.version_tag,
    entry_point: `get/${
      entryPointType === "pagegroup" ? "page" : entryPointType
    }/${entryPoint}`,
    server_path: !serverPath.endsWith("/")
      ? serverPath
      : serverPath.substring(0, serverPath.length - 1),
    localUserTables,
    synchedTables,
    autoPublicLogin,
    allowOfflineMode,
    allowShareTo,
  };
  if (tenantAppName) cfg.tenantAppName = tenantAppName;
  writeFileSync(
    join(buildDir, "www", "data", "config.js"),
    `var _sc_mobile_config = ${JSON.stringify(cfg)}`
  );
}

/**
 * create a file with all data from the db
 * the app updates its local db from this
 * @param buildDir directory where the app will be build
 * @param includedPlugins names of plugins that are bundled into the app
 */
export async function buildTablesFile(
  buildDir: string,
  includedPlugins?: string[]
) {
  const wwwDir = join(buildDir, "www", "data");
  const scTables = (await db.listScTables()).filter(
    (table: Row) =>
      [
        "_sc_migrations",
        "_sc_errors",
        "_sc_session",
        "_sc_event_log",
        "_sc_snapshots",
      ].indexOf(table.name) === -1
  );
  const tablesWithData = await Promise.all(
    scTables.map(async (row: Row) => {
      const dbData = await db.select(row.name);
      return {
        table: row.name,
        rows:
          row.name !== "_sc_plugins"
            ? dbData
            : dbData.filter(
                (plugin: any) =>
                  !includedPlugins || includedPlugins.includes(plugin.name)
              ),
      };
    })
  );
  const createdAt = new Date();
  writeFileSync(
    join(wwwDir, "tables.js"),
    `var _sc_tables = ${JSON.stringify({
      created_at: createdAt.valueOf(),
      sc_tables: tablesWithData,
    })}`
  );
  writeFileSync(
    join(wwwDir, "tables_created_at.js"),
    `var _sc_tables_created_at = ${JSON.stringify({
      created_at: createdAt.valueOf(),
    })}`
  );
}

/**
 * copy files form 'server/locales' into the app
 * @param buildDir directory where the app will be build
 */
export function copyTranslationFiles(buildDir: string) {
  const localesDir = join(require.resolve("@saltcorn/server"), "..", "locales");
  const translations = new Array<string>();
  for (const key of Object.keys(available_languages)) {
    const buffer = fs.readFileSync(join(localesDir, `${key}.json`));
    translations.push(
      `${key}: { translations: ${JSON.stringify(
        JSON.parse(buffer.toString())
      )} }`
    );
  }
  fs.writeFileSync(
    join(buildDir, "www", "data", "translations.js"),
    `var _sc_translations = { ${translations.join(",")} }`
  );
}

/**
 * init an empty db
 * after the first startup, this db will be updated from the tables.json
 * @param buildDir directory where the app will be build
 */
export async function createSqliteDb(buildDir: string) {
  const result = spawnSync(getSafeSaltcornCmd(), ["add-schema", "-f"], {
    env: {
      ...process.env,
      FORCE_SQLITE: "true",
      SQLITE_FILEPATH: join(buildDir, "www", "scdb.sqlite"),
    },
  });
  if (result.error) {
    console.log(result.error);
    return -1;
  } else {
    console.log(
      result.output
        ? result.output.toString()
        : "'reset-schema' finished without output"
    );
    return result.status;
  }
}

/**
 * Prepare a splash page
 * runs a page and writes the html into 'splash_page.html' of the www directory
 * @param buildDir
 * @param pageName splash page
 * @param serverUrl needed, if 'pageName' uses images from the server
 * @param tenantAppName
 * @param user
 */
export async function prepareSplashPage(
  buildDir: string,
  pageName: string,
  serverUrl: string,
  tenantAppName?: string,
  user?: User
) {
  try {
    const role = user ? user.role_id : 100;
    const page = Page.findOne({ name: pageName });
    if (!page) throw new Error(`The page '${pageName}' does not exist`);
    const state = getState();
    if (!state) throw new Error("Unable to get the state object");
    // @ts-ignore
    global.window = {};
    const contents = await page.run(
      {},
      {
        req: {
          user,
          getLocale: () => {
            return "en";
          },
          isSplashPage: true,
        },
      }
    );
    const sbadmin2 = state.plugins["sbadmin2"];
    const html = (<PluginLayout>sbadmin2.layout).wrap({
      title: page.title,
      body: contents.above ? contents : { above: [contents] },
      alerts: [],
      role: role,
      menu: [],
      headers: [
        { css: `static_assets/${db.connectObj.version_tag}/saltcorn.css` },
        {
          script: `static_assets/${db.connectObj.version_tag}/saltcorn-common.js`,
        },
        { script: `static_assets/${db.connectObj.version_tag}/dayjs.min.js` },
        { script: "js/iframe_view_utils.js" },
        {
          headerTag: `<script>parent.splashConfig = { server_path: '${serverUrl}', tenantAppName: ${tenantAppName}, };</script>`,
        },
      ],
      brand: { name: "" },
      bodyClass: "",
      currentUrl: "",
    });
    // @ts-ignore
    global.window = undefined;
    writeFileSync(join(buildDir, "www", "splash_page.html"), html);
  } catch (error) {
    console.log("Unable to build a splash page");
    console.log(error);
  }
}

export function writePodfile(buildDir: string) {
  const podfileContent = `
  require_relative '../../node_modules/@capacitor/ios/scripts/pods_helpers'
  
  platform :ios, '13.0'
  use_frameworks!
  
  # workaround to avoid Xcode caching of Pods that requires
  # Product -> Clean Build Folder after new Cordova plugins installed
  # Requires CocoaPods 1.6 or newer
  install! 'cocoapods', :disable_input_output_paths => true
  
  def capacitor_pods
    pod 'Capacitor', :path => '../../node_modules/@capacitor/ios'
    pod 'CapacitorCordova', :path => '../../node_modules/@capacitor/ios'
    pod 'CapacitorCommunitySqlite', :path => '../../node_modules/@capacitor-community/sqlite'
    pod 'CapacitorCamera', :path => '../../node_modules/@capacitor/camera'
    pod 'CapacitorFilesystem', :path => '../../node_modules/@capacitor/filesystem'
    pod 'CapacitorGeolocation', :path => '../../node_modules/@capacitor/geolocation'
    pod 'CapacitorNetwork', :path => '../../node_modules/@capacitor/network'
    pod 'CapacitorScreenOrientation', :path => '../../node_modules/@capacitor/screen-orientation'
    pod 'SendIntent', :path => '../../node_modules/send-intent'
    pod 'CordovaPlugins', :path => '../capacitor-cordova-ios-plugins'
    pod 'CordovaPluginsResources', :path => '../capacitor-cordova-ios-plugins'
  end
  
  target 'App' do
    capacitor_pods
    # Add your Pods here
  end
  
  post_install do |installer|
    assertDeploymentTarget(installer)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
        config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      end
    end
  end`;
  const podfilePath = join(buildDir, "ios", "App", "Podfile");
  writeFileSync(podfilePath, podfileContent, "utf8");
  // run pod install
  const result = spawnSync("pod", ["install"], {
    cwd: join(buildDir, "ios", "App"),
    env: {
      ...process.env,
      NODE_ENV: "development",
    },
  });
}

/**
 * @param buildDir
 * @param appVersion new app version
 */
export function modifyXcodeProjectFile(
  buildDir: string,
  appVersion: string,
  iosCfg: IosCfg
) {
  const projectFile = join(
    buildDir,
    "ios",
    "App",
    "App.xcodeproj",
    "project.pbxproj"
  );
  let fileContent = readFileSync(projectFile, "utf8");
  if (iosCfg.shareExtensionProvisioningProfile) {
    const shareExtId =
      iosCfg.shareExtensionProvisioningProfile.identifier.replace(
        `${iosCfg.appleTeamId}.`,
        ""
      );
    // modify debug/release blocks of the share extension target
    for (const targetCfgBlock of fileContent.match(
      new RegExp(`buildSettings = {[^}]*${shareExtId}[^}]*};`, "g")
    ) || []) {
      let newCfgBlock = targetCfgBlock
        .replaceAll(/"CODE_SIGN_IDENTITY.*\n/g, "")
        .replaceAll(/CODE_SIGN_STYLE.*\n/g, "")
        .replaceAll(/DEVELOPMENT_TEAM.*\n/g, "")
        .replaceAll(/"DEVELOPMENT_TEAM.*\n/g, "")
        .replaceAll(/PROVISIONING_PROFILE_SPECIFIER.*\n/g, "")
        .replaceAll(/"PROVISIONING_PROFILE_SPECIFIER.*\n/g, "")
        // set new values
        .replaceAll(
          /MARKETING_VERSION = 1.0;/g,
          `        MARKETING_VERSION = ${appVersion};
        "CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Distribution";
        CODE_SIGN_STYLE = Manual;
        DEVELOPMENT_TEAM="";
        "DEVELOPMENT_TEAM[sdk=iphoneos*]" = ${iosCfg.appleTeamId};
        PROVISIONING_PROFILE_SPECIFIER = "";
        "PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]" = "${iosCfg.shareExtensionProvisioningProfile.specifier}";`
        );
      fileContent = fileContent.replace(targetCfgBlock, newCfgBlock);
    }
  }
  fileContent = fileContent.replace(
    /MARKETING_VERSION = 1.0;/,
    `MARKETING_VERSION = ${appVersion};`
  );
  writeFileSync(projectFile, fileContent, "utf8");
}

export function generateAndroidVersionCode(appVersion: string) {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(appVersion) || appVersion === "0.0.0")
    throw new Error(`Invalid app version '${appVersion}'`);
  const parts = appVersion.split(".");
  return (
    parseInt(parts[0]) * 1000000 +
    parseInt(parts[1]) * 1000 +
    parseInt(parts[2])
  );
}

export function modifyGradleConfig(buildDir: string, appVersion: string) {
  console.log("modifyGradleConfig");
  const gradleFile = join(buildDir, "android", "app", "build.gradle");
  const gradleContent = readFileSync(gradleFile, "utf8");
  const versionCode = generateAndroidVersionCode(appVersion);
  let newGradleContent = gradleContent
    .replace(/versionName "1.0"/, `versionName "${appVersion}"`)
    .replace(/versionCode 1/, `versionCode ${versionCode}`);
  writeFileSync(gradleFile, newGradleContent, "utf8");
}
