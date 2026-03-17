import db from "@saltcorn/data/db/index";
import utils = require("@saltcorn/data/utils");
const { getSafeSaltcornCmd } = utils;
import { join, parse } from "path";
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
import type { PluginLayout, RunExtra } from "@saltcorn/types/base_types";
import { parseStringPromise, Builder } from "xml2js";
import { available_languages } from "@saltcorn/data/models/config";
import type { IosCfg } from "../mobile-builder";
import { ReqRes } from "@saltcorn/types/common_types";
import { CapacitorPlugin } from "@saltcorn/types/base_types";
const resizer = require("resize-with-sharp-or-jimp");

/**
 * copy saltcorn-mobile-app as a template to buildDir
 * and install the capacitor and cordova modules to node_modules (cap sync will be run later)
 * @param buildDir directory where the app will be build
 * @param templateDir directory of the template code that will be copied to 'buildDir'
 * @param pushEnabled are push notifications enabled?
 * @param backgroundFetchEnabled is background fetch enabled?
 * @param pushSyncEnabled is push sync enabled?
 */
export function prepareBuildDir(
  buildDir: string,
  templateDir: string,
  pushEnabled: boolean,
  backgroundFetchEnabled: boolean,
  pushSyncEnabled: boolean
) {
  const state = getState();
  if (!state) throw new Error("Unable to get the state object");

  if (existsSync(buildDir)) rmSync(buildDir, { force: true, recursive: true });
  copySync(templateDir, buildDir);
  rmSync(`${buildDir}/node_modules`, { recursive: true, force: true });
  let result = spawnSync("npm", ["install"], {
    cwd: buildDir,
  });
  console.log(result.output.toString());

  // cap-plugins needed for saltcorn-plugins
  const additionalPlugins = state.capacitorPlugins.map(
    (plugin: CapacitorPlugin) => `${plugin.name}@${plugin.version}`
  );

  console.log("installing capacitor deps and plugins");
  const capDepsAndPlugins = [
    "@capacitor/cli@7.4.5",
    "@capacitor/core@7.4.5",
    "@capacitor/assets@3.0.5",
    "@capacitor/filesystem@7.1.6",
    "@capacitor/camera@7.0.3",
    "@capacitor/network@7.0.3",
    "@capacitor-community/sqlite@7.0.3",
    "@capacitor/screen-orientation@7.0.3",
    "@capacitor/app@7.1.0",
    "send-intent@7.0.0",
    ...additionalPlugins,
    ...(pushEnabled || pushSyncEnabled
      ? ["@capacitor/device@7.0.2", "@capacitor/push-notifications@7.0.3"]
      : []),
    ...(backgroundFetchEnabled
      ? ["@transistorsoft/capacitor-background-fetch@7.1.0"]
      : []),
    ...(pushSyncEnabled ? ["capacitor-plugin-silent-notifications@7.0.1"] : []),
  ];
  console.log("capDepsAndPlugins", capDepsAndPlugins);

  result = spawnSync(
    "npm",
    ["install", "--legacy-peer-deps", ...capDepsAndPlugins],
    {
      cwd: buildDir,
      maxBuffer: 1024 * 1024 * 10,
    }
  );
  console.log(result.output.toString());

  console.log("installing cordova plugins");
  const cordovaPlugins = [
    "cordova-plugin-file@8.1.3",
    "cordova-plugin-inappbrowser@6.0.0",
  ];
  result = spawnSync(
    "npm",
    ["install", "--legacy-peer-deps", ...cordovaPlugins],
    {
      cwd: buildDir,
      maxBuffer: 1024 * 1024 * 10,
    }
  );
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

export function androidPermissions(allowFCM: boolean) {
  const state = getState();
  if (!state) throw new Error("Unable to get the state object");
  const permissions = new Set<String>([
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.INTERNET",
    "android.permission.CAMERA",
  ]);
  if (allowFCM) {
    permissions.add("android.permission.POST_NOTIFICATIONS");
    permissions.add("com.google.android.c2dm.permission.RECEIVE");
  }
  for (const capPlugin of state.capacitorPlugins) {
    for (const perm of capPlugin.androidPermissions || []) {
      permissions.add(perm);
    }
  }
  return Array.from(permissions);
}

export function androidFeatures() {
  const state = getState();
  if (!state) throw new Error("Unable to get the state object");
  const features = new Set<String>(["android.hardware.camera"]);
  for (const capPlugin of state.capacitorPlugins) {
    for (const feature of capPlugin.androidFeatures || []) {
      features.add(feature);
    }
  }
  return Array.from(features);
}

export async function modifyAndroidManifest(
  buildDir: string,
  allowShareTo: boolean,
  allowFCM: boolean,
  allowAuthIntent: boolean,
  allowClearTextTraffic: boolean
) {
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

    parsed.manifest["uses-permission"] = androidPermissions(allowFCM).map(
      (perm) => ({
        $: { "android:name": perm },
      })
    );
    parsed.manifest["uses-feature"] = androidFeatures().map((feat) => ({
      $: { "android:name": feat },
    }));

    parsed.manifest.application[0].$ = {
      ...parsed.manifest.application[0].$,
      "android:allowBackup": "false",
      "android:fullBackupContent": "false",
      "android:dataExtractionRules": "@xml/data_extraction_rules",
      "android:networkSecurityConfig": "@xml/network_security_config",
      ...(allowClearTextTraffic
        ? { "android:usesCleartextTraffic": "true" }
        : {}),
    };

    if (allowFCM) {
      parsed.manifest.application[0]["meta-data"] = [
        ...(parsed.manifest.application[0]["meta-data"] || []),
        {
          $: {
            "android:name":
              "com.google.firebase.messaging.default_notification_channel_id",
            "android:value": "default_channel_id",
          },
        },
      ];
    }

    if (allowShareTo) {
      // add the send-intent activity
      parsed.manifest.application[0].activity = [
        ...parsed.manifest.application[0].activity,
        {
          $: {
            "android:name": "de.mindlib.sendIntent.SendIntentActivity",
            "android:label": "@string/app_name",
            "android:exported": "true",
            "android:theme": "@style/AppTheme.NoActionBar",
          },
          "intent-filter": [
            {
              action: [{ $: { "android:name": "android.intent.action.SEND" } }],
              category: [
                { $: { "android:name": "android.intent.category.DEFAULT" } },
              ],
              data: [
                { $: { "android:mimeType": "text/plain" } },
                { $: { "android:mimeType": "image/*" } },
                { $: { "android:mimeType": "application/*" } },
                { $: { "android:mimeType": "video/*" } },
              ],
            },
          ],
        },
      ];
    }

    if (allowAuthIntent) {
      parsed.manifest.application[0].activity[0]["intent-filter"] = [
        ...(parsed.manifest.application[0].activity[0]["intent-filter"] || []),
        {
          $: { "android:autoVerify": "true" },
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          category: [
            { $: { "android:name": "android.intent.category.DEFAULT" } },
            { $: { "android:name": "android.intent.category.BROWSABLE" } },
          ],
          data: [
            {
              $: {
                "android:scheme": "mobileapp",
                "android:host": "auth",
                "android:path": "/callback",
              },
            },
          ],
        },
      ];
    }
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

export function hasAuthMethod(plugins: string[]) {
  const state = getState();
  for (const pluginName of plugins) {
    const plugin = state!.plugins[pluginName];
    if (plugin && plugin.authentication) return true;
  }
  return false;
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

export function extractDomain(url: string) {
  let domain = url;
  if (domain.startsWith("http://")) domain = domain.substring(7);
  if (domain.startsWith("https://")) domain = domain.substring(8);
  if (domain.endsWith("/")) domain = domain.substring(0, domain.length - 1);
  if (domain.includes(":")) domain = domain.substring(0, domain.indexOf(":"));
  return domain;
}

export function writeNetworkSecurityConfig(
  buildDir: string,
  serverPath: string
) {
  console.log("writeNetworkSecurityConfig");
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
    <domain includeSubdomains="true">${extractDomain(serverPath)}</domain>
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

export function modifyInfoPlist(
  buildDir: string,
  allowShareTo: boolean,
  backgroundSyncEnabled: boolean,
  pushSyncEnabled: boolean,
  allowClearTextTraffic: boolean
) {
  const infoPlist = join(buildDir, "ios", "App", "App", "Info.plist");
  const content = readFileSync(infoPlist, "utf8");

  const newCfgs = `
  ${
    backgroundSyncEnabled
      ? `<key>BGTaskSchedulerPermittedIdentifiers</key>
  <array>
    <string>com.transistorsoft.fetch</string>
  </array>
  <key>UIBackgroundModes</key>
  <array>
    <string>fetch</string>
  </array>
  `
      : ""
  }

  ${
    pushSyncEnabled
      ? `<key>UIBackgroundModes</key>
  <array>
    <string>remote-notification</string>
  </array>
  `
      : ""
  }
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
  ${
    allowClearTextTraffic
      ? `<key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>`
      : ""
  }
`;
  // add newCfgs after the first <dict> tag
  const newContent = content.replace(/<dict>/, `<dict>${newCfgs}`);
  writeFileSync(infoPlist, newContent, "utf8");
}

export function writeEntitlementsPlist(buildDir: string) {
  const file = join(buildDir, "ios", "App", "App", "App.entitlements");
  try {
    writeFileSync(
      file,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>production</string>
    <key>com.apple.security.application-groups</key>
    <array />
</dict>
</plist>`
    );
  } catch (error: any) {
    console.log(
      `Unable to write the Entitlements plist file: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

export function runAddEntitlementsScript(buildDir: string) {
  try {
    const result = spawnSync("ruby", ["add_entitlements.rb"], {
      cwd: buildDir,
    });
    console.log(result.output.toString());
  } catch (error: any) {
    console.log(
      `Unable to run the add_entitlements.rb script: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
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
}

export function modifyShareViewController(buildDir: string, groupId: string) {
  const shareVCFile = join(
    buildDir,
    "ios",
    "App",
    "share-ext",
    "ShareViewController.swift"
  );
  let content = readFileSync(shareVCFile, "utf8");
  // replace all YOUR_APP_GROUP_ID placeholders with groupId
  content = content.replace(/YOUR_APP_GROUP_ID/g, groupId);
  writeFileSync(shareVCFile, content, "utf8");
}

export function modifyAppDelegate(
  buildDir: string,
  backgroundSyncEnabled: boolean,
  pushSyncEnabled: boolean,
  allowShareTo: boolean
) {
  const appDelegateFile = join(
    buildDir,
    "ios",
    "App",
    "App",
    "AppDelegate.swift"
  );
  let content = readFileSync(appDelegateFile, "utf8");

  // modify cusomization point after application launch
  content = content.replace(
    /func application\(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: \[UIApplication.LaunchOptionsKey: Any\]\?\) -> Bool {/,
    `func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.

       
       ${
         backgroundSyncEnabled
           ? `// [capacitor-background-fetch]
       let fetchManager = TSBackgroundFetch.sharedInstance();
       fetchManager?.didFinishLaunching();`
           : ""
       }

       self.window?.rootViewController?.navigationController?.interactivePopGestureRecognizer?.isEnabled = false;
`
  );

  if (backgroundSyncEnabled) {
    // add "import TSBackgroundFetch" before "@UIApplicationMain"
    content = content.replace(
      /@UIApplicationMain/,
      `import TSBackgroundFetch

@UIApplicationMain`
    );

    // add fetch handler at the end of the file, before the last }
    content = content.replace(
      /}\s*$/,
      `
    // [capacitor-background-fetch]
   func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
       print("BackgroundFetchPlugin AppDelegate received fetch event");
       let fetchManager = TSBackgroundFetch.sharedInstance();
       fetchManager?.perform(completionHandler: completionHandler, applicationState: application.applicationState);
   }
}
`
    );
  }
  if (pushSyncEnabled) {
    content = content.replace(
      /}\s*$/,
      `

  // [capacitor-push-notifications]
  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
  }

  // [capacitor-push-notifications]
  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
  }

  // ------------------------------

  // [silent push notification handler]
  func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // debug
    print("Received by: didReceiveRemoteNotification w/ fetchCompletionHandler")

    // Perform background operation, need to create a plugin
    NotificationCenter.default.post(name: Notification.Name(rawValue: "silentNotificationReceived"), object: nil, userInfo: userInfo)

    // Give the listener a few seconds to complete, system allows for 30 - we give 25. The system will kill this after 30 seconds.
    DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
        // Execute after 25 seconds
        completionHandler(.newData)
    }
  }
    
  // [silent push notification handler]
  // we just add this to deal with an iOS simulator bug, this method is deprecated as of iOS 13
  // func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
  //     // debug
  //     print("Received by: performFetchWithCompletionHandler")
      
  //     // Perform background operation, need to create a plugin
  //     NotificationCenter.default.post(name: Notification.Name(rawValue: "silentNotificationReceived"), object: nil, userInfo: nil)

  //     // Give the listener a few seconds to complete, system allows for 30 - we give 25. The system will kill this after 30 seconds.
  //     DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
  //         // Execute after 25 seconds
  //         completionHandler(.newData)
  //     }
  // }
}
`
    );
  }

  if (allowShareTo) {
    // add "import TSBackgroundFetch" before "@UIApplicationMain"
    content = content.replace(
      /@UIApplicationMain/,
      `import SendIntent

@UIApplicationMain`
    );

    const replacement = `
    let store = ShareStore.store
    
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        
        var success = true
        if CAPBridge.handleOpenUrl(url, options) {
            success = ApplicationDelegateProxy.shared.application(app, open: url, options: options)
        }
        
        guard let components = NSURLComponents(url: url, resolvingAgainstBaseURL: true),
              let params = components.queryItems else {
                  return false
              }
        let titles = params.filter { $0.name == "title" }
        let descriptions = params.filter { $0.name == "description" }
        let types = params.filter { $0.name == "type" }
        let urls = params.filter { $0.name == "url" }
        
        store.shareItems.removeAll()
    
        if (titles.count > 0) {
            for index in 0...titles.count-1 {
                var shareItem: JSObject = JSObject()
                shareItem["title"] = titles[index].value!
                shareItem["description"] = descriptions[index].value!
                shareItem["type"] = types[index].value!
                shareItem["url"] = urls[index].value!
                store.shareItems.append(shareItem)
            }
        }
        
        store.processed = false
        let nc = NotificationCenter.default
        nc.post(name: Notification.Name("triggerSendIntent"), object: nil )
        
        return success
    }
  }`;
    const regex =
      /func application\(_ app: UIApplication,\s*open url: URL,\s*options:\s*\[UIApplication\.OpenURLOptionsKey\s*:\s*Any\]\s*=\s*\[:\]\)\s*->\s*Bool\s*\{[\s\S]*?\n\}/;
    content = content.replace(regex, replacement);
  }

  writeFileSync(appDelegateFile, content, "utf8");
}

export function writePrivacyInfo(
  buildDir: string,
  backgroundSyncEnabled: boolean
) {
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

      ${
        backgroundSyncEnabled
          ? `
      <!-- [1] background_fetch: UserDefaults -->
      <dict>
          <key>NSPrivacyAccessedAPIType</key>
          <string>NSPrivacyAccessedAPICategoryUserDefaults</string>

          <key>NSPrivacyAccessedAPITypeReasons</key>
          <array>
              <string>CA92.1</string>
          </array>
        </dict>`
          : ""
      }
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
    "saltcorn-mobile.css",
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
            join(buildDir, "www", "data", "encoded_site_logo.txt"),
            `data:${file.mimetype};base64, ${base64}`
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
  showContinueAsPublicUser,
  allowOfflineMode,
  syncOnReconnect,
  syncOnAppResume,
  pushSync,
  syncInterval,
  allowShareTo,
}: any) {
  const wwwDir = join(buildDir, "www");
  let cfg: any = {
    version_tag: db.connectObj.version_tag,
    entryPointType: entryPointType,
    server_path: !serverPath.endsWith("/")
      ? serverPath
      : serverPath.substring(0, serverPath.length - 1),
    localUserTables,
    synchedTables,
    autoPublicLogin,
    showContinueAsPublicUser,
    allowOfflineMode,
    syncOnReconnect,
    syncOnAppResume,
    pushSync,
    syncInterval,
    allowShareTo,
  };
  if (entryPointType !== "byrole") {
    cfg.entry_point = `get/${
      entryPointType === "pagegroup" ? "page" : entryPointType
    }/${entryPoint}`;
  }
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
  const state = getState();
  if (!state) throw new Error("Unable to get the state object");
  await state.refresh_config(true);

  // remove cfgs with excludeFromMobile or input_type=password
  const filterPluginFunc = async (plugin: any) => {
    let module = state.plugins[plugin.name];
    if (!module) module = state.plugins[state.plugin_module_names[plugin.name]];
    if (module?.configuration_workflow) {
      try {
        const flow = await module.configuration_workflow();
        for (const step of flow?.steps || []) {
          if (step.form) {
            const form = await step.form({});
            for (const field of form?.fields || []) {
              if (
                field.exclude_from_mobile ||
                field.input_type === "password"
              ) {
                delete plugin.configuration[field.name];
              }
            }
          }
        }
      } catch (error) {
        console.log(`Error in configuration_workflow of plugin ${plugin.name}`);
        console.log(error);
      }
    }
    return plugin;
  };

  const filterTableFunc = async (table: any) => {
    let result = table;
    if (table.provider_name) {
      const oldProviderCfg = JSON.parse(
        JSON.stringify(table.provider_cfg || {})
      );
      const provider = state.table_providers[table.provider_name];
      if (provider?.configuration_workflow) {
        try {
          const flow = await provider.configuration_workflow();
          for (const step of flow?.steps || []) {
            if (step.form) {
              const form = await step.form(oldProviderCfg);
              for (const field of form?.fields || []) {
                if (
                  field.exclude_from_mobile ||
                  field.input_type === "password"
                ) {
                  delete result.provider_cfg[field.name];
                }
              }
            }
          }
        } catch (error) {
          console.log(
            `Error in configuration_workflow of table provider ${table.provider_name}`
          );
          console.log(error);
        }
      }
    }
    return result;
  };

  const filterFunc = async (table: string, rows: any) => {
    switch (table) {
      case "_sc_plugins":
        const included = rows.filter((plugin: any) =>
          includedPlugins ? includedPlugins.includes(plugin.name) : true
        );
        return await Promise.all(included.map(filterPluginFunc));
      case "_sc_config":
        const allCfgs = state.configs;
        // remove cfgs with excludeFromMobile or input_type=password
        return rows.filter((row: any) => {
          const cfg = allCfgs[row.key];
          return (
            cfg && !(cfg.excludeFromMobile || cfg.input_type === "password")
          );
        });
      case "_sc_tables":
        return await Promise.all(rows.map(filterTableFunc));
      default:
        return rows;
    }
  };

  const wwwDir = join(buildDir, "www", "data");
  const scTables = (await db.listScTables()).filter(
    (table: Row) =>
      [
        "_sc_migrations",
        "_sc_errors",
        "_sc_session",
        "_sc_event_log",
        "_sc_snapshots",
        "_sc_workflow_runs",
        "_sc_workflow_trace",
      ].indexOf(table.name) === -1
  );
  const tablesWithData = await Promise.all(
    scTables.map(async (row: Row) => {
      const dbData = await db.select(row.name);
      return {
        table: row.name,
        rows: await filterFunc(row.name, dbData),
      };
    })
  );
  const createdAt = new Date();
  writeFileSync(
    join(wwwDir, "tables.json"),
    JSON.stringify({
      created_at: createdAt.valueOf(),
      sc_tables: tablesWithData,
    })
  );
  writeFileSync(
    join(wwwDir, "tables_created_at.json"),
    JSON.stringify({
      created_at: createdAt.valueOf(),
    })
  );
}

/**
 * copy files form 'server/locales' into the app
 * @param buildDir directory where the app will be build
 */
export function copyTranslationFiles(buildDir: string) {
  const localesDir = join(require.resolve("@saltcorn/server"), "..", "locales");
  copySync(localesDir, join(buildDir, "www", "data", "locales"));
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
    const runExtra = {
      req: {
        user,
        getLocale: () => {
          return "en";
        },
        isSplashPage: true,
      },
    };
    const contents = await page.run({}, runExtra as any);
    const sbadmin2 = state.plugins["sbadmin2"];
    const html = (<PluginLayout>sbadmin2.layout).wrap({
      title: page.title,
      body: !contents
        ? { above: [] }
        : contents.above
          ? contents
          : { above: [contents] },
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

export function writePodfile(
  buildDir: string,
  hasPush: boolean,
  hasBackgroundFetch: boolean,
  hasSilentPush: boolean
) {
  const state = getState();
  let hasGeolocation = false;
  if (state) {
    for (const plugin of state.capacitorPlugins || []) {
      if (plugin.name === "@capacitor/geolocation") {
        hasGeolocation = true;
      }
    }
  }

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
    pod 'CapacitorApp', :path => '../../node_modules/@capacitor/app'
    pod 'CapacitorCommunitySqlite', :path => '../../node_modules/@capacitor-community/sqlite'
    pod 'CapacitorCamera', :path => '../../node_modules/@capacitor/camera'
    pod 'CapacitorFilesystem', :path => '../../node_modules/@capacitor/filesystem'
    ${hasGeolocation ? `pod 'CapacitorGeolocation', :path => '../../node_modules/@capacitor/geolocation'` : ""}
    pod 'CapacitorNetwork', :path => '../../node_modules/@capacitor/network'
    pod 'CapacitorScreenOrientation', :path => '../../node_modules/@capacitor/screen-orientation'
    pod 'SendIntent', :path => '../../node_modules/send-intent'
    pod 'CordovaPlugins', :path => '../capacitor-cordova-ios-plugins'
    pod 'CordovaPluginsResources', :path => '../capacitor-cordova-ios-plugins'
    ${
      hasPush || hasSilentPush
        ? `pod 'CapacitorPushNotifications', :path => '../../node_modules/@capacitor/push-notifications'
    pod 'CapacitorDevice', :path => '../../node_modules/@capacitor/device'`
        : ""
    }
    ${hasSilentPush ? `pod 'CapacitorPluginSilentNotifications', :path => '../../node_modules/capacitor-plugin-silent-notifications'` : ""}
    ${hasBackgroundFetch ? `pod 'TransistorsoftCapacitorBackgroundFetch', :path => '../../node_modules/@transistorsoft/capacitor-background-fetch'` : ""}
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
  fileContent = fileContent.replaceAll(
    /MARKETING_VERSION = 1.0;/g,
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

export function modifyGradleConfig(
  buildDir: string,
  appVersion: string,
  keyStoreData?: {
    keystorePath: string;
    keystorePassword: string;
    keyAlias: string;
    keyPassword: string;
  }
) {
  console.log("modifyGradleConfig");
  const gradleFile = join(buildDir, "android", "app", "build.gradle");
  const gradleContent = readFileSync(gradleFile, "utf8");
  const versionCode = generateAndroidVersionCode(appVersion);
  let newGradleContent = gradleContent
    .replace(/versionName "1.0"/, `versionName "${appVersion}"`)
    .replace(/versionCode 1/, `versionCode ${versionCode}`);

  if (keyStoreData) {
    const signingConfigs = `
    signingConfigs {
      debug {
        storeFile file("${keyStoreData.keystorePath}")
        storePassword "${keyStoreData.keystorePassword}"
        keyAlias "${keyStoreData.keyAlias}"
        keyPassword "${keyStoreData.keyPassword}"
      }
  }`;
    // add a new line with signingConfigs above     "defaultConfig {"
    newGradleContent = newGradleContent.replace(
      /defaultConfig \{/,
      `${signingConfigs}
    defaultConfig {`
    );

    const debugBuildTypesBlock = `
    debug {
      signingConfig signingConfigs.debug
    }`;
    // add the debug build type block above   "release {"
    newGradleContent = newGradleContent.replace(
      /release \{/,
      `${debugBuildTypesBlock}
    release {`
    );
  }
  writeFileSync(gradleFile, newGradleContent, "utf8");
}
