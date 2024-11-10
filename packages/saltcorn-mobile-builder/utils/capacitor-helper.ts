import { spawnSync, execSync } from "child_process";
import { join, basename } from "path";
import { existsSync, mkdirSync } from "fs";
import { copySync } from "fs-extra";
import type User from "@saltcorn/data/models/user";
import utils = require("@saltcorn/data/utils");
const { fileWithEnding, safeEnding } = utils;
import File from "@saltcorn/data/models/file";
import {
  writePodfile,
  modifyGradleConfig,
  modifyAndroidManifest,
  writeDataExtractionRules,
  writeNetworkSecurityConfig,
  copyPrepopulatedDb,
} from "./common-build-utils";

export type CapacitorCfg = {
  buildDir: string;
  platforms: string[];
  buildType: "debug" | "release";
  appName: string;

  useDocker?: boolean;
  keyStorePath?: string;
  keyStoreAlias?: string;
  keyStorePassword?: string;

  appleTeamId?: string;
  provisioningGUUID?: string;
};

export class CapacitorHelper {
  buildDir: string;
  platforms: string[];
  buildType: "debug" | "release";
  appName: string;

  useDocker?: boolean;
  keyStoreFile?: string;
  keyStoreAlias?: string;
  keyStorePassword?: string;

  appleTeamId?: string;
  provisioningGUUID?: string;

  isAndroid: boolean;
  isIOS: boolean;

  constructor(cfg: CapacitorCfg) {
    this.buildDir = cfg.buildDir;
    this.platforms = cfg.platforms;
    this.buildType = cfg.buildType || "debug";
    this.appName = cfg.appName;

    this.useDocker = cfg.useDocker;
    this.keyStoreFile = cfg.keyStorePath
      ? basename(cfg.keyStorePath)
      : undefined;
    this.keyStoreAlias = cfg.keyStoreAlias;
    this.keyStorePassword = cfg.keyStorePassword;

    this.appleTeamId = cfg.appleTeamId;
    this.provisioningGUUID = cfg.provisioningGUUID;

    this.isAndroid = this.platforms.includes("android");
    this.isIOS = this.platforms.includes("ios");
  }

  public async buildApp() {
    if (!this.useDocker) {
      this.addPlatforms();
      this.capCopy();
      this.addCordovaPlugins();
      this.addCapacitorPlugins();
      this.generateAssets();
      this.capSync();
      if (this.isAndroid) {
        await modifyAndroidManifest(this.buildDir);
        writeDataExtractionRules(this.buildDir);
        writeNetworkSecurityConfig(this.buildDir);
        copyPrepopulatedDb(this.buildDir);
        if (this.keyStoreFile && this.keyStoreAlias && this.keyStorePassword)
          modifyGradleConfig(
            this.buildDir,
            this.keyStoreFile,
            this.keyStoreAlias,
            this.keyStorePassword
          );
        this.gradleBuild();
      }
      if (this.isIOS) {
        writePodfile(this.buildDir);
        this.xCodeBuild();
      }
    } else this.buildWithDocker();
  }

  public tryCopyAppFiles(copyDir: string, user: User, appName?: string) {
    const copyHelper = async (
      ending: "apk" | "aab" | "ipa",
      apkBuildDir: string
    ) => {
      const appFile = fileWithEnding(apkBuildDir, `.${ending}`);
      if (appFile) {
        const dstFile = appName
          ? safeEnding(appName, `.${ending}`)
          : `app-${this.buildType}.${ending}`;
        copySync(join(apkBuildDir, appFile), join(copyDir, dstFile));
        await File.set_xattr_of_existing_file(dstFile, copyDir, user);
      }
    };
    const appDir = join(
      this.buildDir,
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      this.buildType
    );
    const ending = this.buildType === "debug" ? "apk" : "aab";
    if (!existsSync(copyDir)) mkdirSync(copyDir);
    copyHelper(ending, appDir);
    // ipa
    copyHelper("ipa", this.buildDir);
  }

  private addPlatforms() {
    const addFn = (platform: string) => {
      let result = spawnSync("npm", ["install", `@capacitor/${platform}`], {
        cwd: this.buildDir,
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      });
      if (result.output) console.log(result.output.toString());
      else if (result.error)
        throw new Error(
          `Unable to install ${platform} (code ${result.status})` +
            `\n\n${result.error.toString()}`
        );
      result = spawnSync("npm", ["run", "add-platform", "--", platform], {
        cwd: this.buildDir,
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      });
      if (result.output) console.log(result.output.toString());
      else if (result.error)
        throw new Error(
          `Unable to add ${platform} (code ${result.status})` +
            `\n\n${result.error.toString()}`
        );
    };
    for (const platform of this.platforms) addFn(platform);
  }

  private addCordovaPlugins() {
    const addFn = (plugin: string) => {
      let result = spawnSync("npm", ["install", plugin], {
        cwd: this.buildDir,
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      });
      if (result.output) console.log(result.output.toString());
      else if (result.error)
        throw new Error(
          `Unable to add ${plugin} (code ${result.status})` +
            `\n\n${result.error.toString()}`
        );
    };

    for (const plugin of [
      "cordova-plugin-file@7.0.0",
      "cordova-plugin-inappbrowser",
      "cordova-plugin-network-information",
      "cordova-plugin-geolocation",
      "cordova-plugin-camera",
    ])
      addFn(plugin);
  }

  private addCapacitorPlugins() {
    const addFn = (plugin: string) => {
      let result = spawnSync("npm", ["install", plugin], {
        cwd: this.buildDir,
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      });
      if (result.output) console.log(result.output.toString());
      else if (result.error)
        throw new Error(
          `Unable to add ${plugin} (code ${result.status})` +
            `\n\n${result.error.toString()}`
        );
    };

    for (const plugin of [
      "@capacitor-community/sqlite",
      "@capacitor/filesystem",
    ])
      addFn(plugin);
  }

  private generateAssets() {
    const result = spawnSync("npx", ["capacitor-assets", "generate"], {
      cwd: this.buildDir,
      env: {
        ...process.env,
      },
    });
    if (result.output) console.log(result.output.toString());
    else if (result.error)
      throw new Error(
        `Unable to generate assets (code ${result.status})` +
          `\n\n${result.error.toString()}`
      );
  }

  private gradleBuild() {
    const result = spawnSync(
      "./gradlew",
      [this.buildType === "release" ? "bundleRelease" : "assembleDebug"],
      {
        cwd: this.buildDir + "/android",
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      }
    );
    if (result.output) console.log(result.output.toString());
    else if (result.error)
      throw new Error(
        `Unable to call the gradlew build (code ${result.status})` +
          `\n\n${result.error.toString()}`
      );
  }

  private buildWithDocker() {
    const spawnParams = [
      "run",
      "--network",
      "host",
      "-v",
      `${this.buildDir}:/saltcorn-mobile-app`,
      "saltcorn/capacitor-builder",
    ];
    spawnParams.push(this.buildType);
    if (this.keyStoreFile)
      spawnParams.push(
        this.keyStoreFile,
        this.keyStoreAlias || "??",
        this.keyStorePassword || "??"
      );
    const result = spawnSync("docker", spawnParams, { cwd: "." });
    if (result.output) console.log(result.output.toString());
    else if (result.error)
      throw new Error(
        `Unable to build with docker (code ${result.status})` +
          `\n\n${result.error.toString()}`
      );
  }

  private xCodeBuild() {
    try {
      console.log("xcodebuild -workspace");

      // xcodebuild archive -workspace App.xcworkspace -scheme App -configuration Release -archivePath ./build/App.xcarchive
      let buffer = execSync(
        `xcodebuild -workspace ios/App/App.xcworkspace ` +
          `-scheme App -destination "generic/platform=iOS" ` +
          `-archivePath MyArchive.xcarchive archive PROVISIONING_PROFILE="${this.provisioningGUUID}" ` +
          ' CODE_SIGN_STYLE="Manual" CODE_SIGN_IDENTITY="iPhone Distribution" ' +
          ` DEVELOPMENT_TEAM="${this.appleTeamId}" `,
        { cwd: this.buildDir }
      );

      if (!existsSync(join(this.buildDir, "MyArchive.xcarchive"))) {
        console.log(
          "Unable to export ipa: xcodebuild did not create the archivePath."
        );
        return 1;
      } else {
        console.log("xcodebuild -exportArchive");
        buffer = execSync(
          "xcodebuild -exportArchive -archivePath MyArchive.xcarchive " +
            `-exportPath ${this.buildDir} -exportOptionsPlist ExportOptions.plist`,
          { cwd: this.buildDir }
        );
        console.log(buffer.toString());
        // to upload it automatically:
        // xrun altool --upload-app -f [.ipa file] -t ios -u [apple-id] -p [app-specific password]
        return 0;
      }
    } catch (err) {
      console.log(err);
      return 1;
    }
  }

  private capSync() {
    const result = spawnSync("npx", ["cap", "sync"], {
      cwd: this.buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    });
    if (result.output) console.log(result.output.toString());
    else if (result.error)
      throw new Error(
        `Unable to sync the native directory (code ${result.status})` +
          `\n\n${result.error.toString()}`
      );
  }

  private capCopy() {
    const result = spawnSync("npx", ["cap", "sync"], {
      cwd: this.buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    });
    if (result.output) console.log(result.output.toString());
    else if (result.error)
      throw new Error(
        `Unable to update the native directory (code ${result.status})` +
          `\n\n${result.error.toString()}`
      );
  }
}
