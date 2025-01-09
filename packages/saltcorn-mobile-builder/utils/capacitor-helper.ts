import { spawnSync, execSync } from "child_process";
import { join, basename } from "path";
import { existsSync } from "fs";
import { copySync } from "fs-extra";
import type User from "@saltcorn/data/models/user";
import utils = require("@saltcorn/data/utils");
const { safeEnding } = utils;
import File from "@saltcorn/data/models/file";
import { copyPrepopulatedDb } from "./common-build-utils";

import type { IosCfg } from "../mobile-builder";

export type CapacitorCfg = {
  buildDir: string;
  platforms: string[];
  buildType: "debug" | "release";
  appName: string;
  appVersion: string;
  serverURL: string;

  useDocker?: boolean;
  keyStorePath: string;
  keyStoreAlias: string;
  keyStorePassword: string;
  isUnsecureKeyStore: boolean;

  iosParams?: IosCfg;
};

export class CapacitorHelper {
  buildDir: string;
  platforms: string[];
  buildType: "debug" | "release";
  appName: string;
  appVersion: string;
  serverURL: string;

  useDocker?: boolean;
  keyStoreFile: string;
  keyStoreAlias: string;
  keyStorePassword: string;
  isUnsecureKeyStore: boolean;

  isAndroid: boolean;
  isIOS: boolean;
  iosParams?: IosCfg;

  constructor(cfg: CapacitorCfg) {
    this.buildDir = cfg.buildDir;
    this.platforms = cfg.platforms;
    this.buildType = cfg.buildType || "debug";
    this.appName = cfg.appName;
    this.serverURL = cfg.serverURL;
    this.appVersion = cfg.appVersion;
    this.useDocker = cfg.useDocker;
    this.keyStoreFile = basename(cfg.keyStorePath);
    this.keyStoreAlias = cfg.keyStoreAlias;
    this.keyStorePassword = cfg.keyStorePassword;
    this.isUnsecureKeyStore = cfg.isUnsecureKeyStore;
    this.iosParams = cfg.iosParams;
    this.isAndroid = this.platforms.includes("android");
    this.isIOS = this.platforms.includes("ios");
  }

  public async buildApp() {
    if (!this.useDocker) {
      this.capSync();
      copyPrepopulatedDb(this.buildDir, this.platforms);
      if (this.isAndroid) {
        if (this.buildType === "release") this.capBuild();
        else {
          // there seems to be a problem with apks generated from 'npx cap build'
          // so for debug builds we use gradle directly
          this.gradleBuild();
        }
      }
    } else this.buildWithDocker();
    if (this.isIOS) this.xCodeBuild();
  }

  public tryCopyAppFiles(copyDir: string, user: User, appName?: string) {
    if (this.isAndroid) {
      if (this.buildType === "release") {
        const bundleDir = join(
          this.buildDir,
          "android",
          "app",
          "build",
          "outputs",
          "bundle",
          "release"
        );
        const aabFile = join(
          bundleDir,
          !this.isUnsecureKeyStore
            ? "app-release-signed.aab"
            : "app-release.aab"
        );
        if (existsSync(aabFile)) {
          const dstFile = appName
            ? safeEnding(appName, ".aab")
            : `app-${this.buildType}.aab`;
          copySync(aabFile, join(copyDir, dstFile));
          File.set_xattr_of_existing_file(dstFile, copyDir, user);
        }
      } else {
        const apkFile = join(
          this.buildDir,
          "android",
          "app",
          "build",
          "outputs",
          "apk",
          "debug",
          "app-debug.apk"
        );
        if (existsSync(apkFile)) {
          const dstFile = appName
            ? safeEnding(appName, ".apk")
            : `app-${this.buildType}.apk`;
          copySync(apkFile, join(copyDir, dstFile));
          File.set_xattr_of_existing_file(dstFile, copyDir, user);
        }
      }
    } else if (this.isIOS) {
      const ipaFile = join(this.buildDir, "App.ipa");
      if (existsSync(ipaFile)) {
        const dstFile = appName
          ? safeEnding(appName, ".ipa")
          : `app-${this.buildType}.ipa`;
        copySync(ipaFile, join(copyDir, dstFile));
        File.set_xattr_of_existing_file(dstFile, copyDir, user);
      }
    }
  }

  public addPlatforms() {
    console.log("add platforms");
    const addFn = (platform: string) => {
      let result = spawnSync("npm", ["install", `@capacitor/${platform}`], {
        cwd: this.buildDir,
        maxBuffer: 1024 * 1024 * 10,
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
      result = spawnSync("npx", ["cap", "add", platform], {
        cwd: this.buildDir,
        maxBuffer: 1024 * 1024 * 10,
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

  public generateAssets() {
    console.log("npx capacitor-assets generate");
    const result = spawnSync("npx", ["capacitor-assets", "generate"], {
      cwd: this.buildDir,
      maxBuffer: 1024 * 1024 * 10,
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

  private capBuild() {
    console.log("npx cap build");
    const result = spawnSync(
      "npx",
      [
        "cap",
        "build",
        "android",
        "--androidreleasetype",
        "AAB",
        "--keystorepath",
        join(this.buildDir, this.keyStoreFile),
        "--keystorepass",
        this.keyStorePassword,
        "--keystorealias",
        this.keyStoreAlias,
        "--keystorealiaspass",
        this.keyStorePassword,
      ],
      {
        cwd: this.buildDir,
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      }
    );
    if (result.output) console.log(result.output.toString());
    else if (result.error)
      throw new Error(
        `Unable to call the build (code ${result.status})` +
          `\n\n${result.error.toString()}`
      );
  }

  private gradleBuild() {
    console.log("gradlew assembleDebug");
    const result = spawnSync("./gradlew", ["assembleDebug"], {
      cwd: this.buildDir + "/android",
      maxBuffer: 1024 * 1024 * 10,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    });
    if (result.output) console.log(result.output.toString());
    else if (result.error)
      throw new Error(
        `Unable to call the gradlew build (code ${result.status})` +
          `\n\n${result.error.toString()}`
      );
  }

  private buildWithDocker() {
    console.log("building with docker");
    const spawnParams = [
      "run",
      "--network",
      "host",
      "-v",
      `${this.buildDir}:/saltcorn-mobile-app`,
      "saltcorn/capacitor-builder",
    ];
    spawnParams.push(this.buildType);
    spawnParams.push(this.appVersion);
    spawnParams.push(this.serverURL);
    if (this.buildType === "release")
      spawnParams.push(
        this.keyStoreFile,
        this.keyStoreAlias,
        this.keyStorePassword
      );
    const result = spawnSync("docker", spawnParams, {
      cwd: ".",
      maxBuffer: 1024 * 1024 * 10,
    });
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
      let buffer = execSync(
        `xcodebuild -workspace ios/App/App.xcworkspace ` +
          `-scheme App -destination "generic/platform=iOS" ` +
          `-archivePath MyArchive.xcarchive archive PROVISIONING_PROFILE="${this.iosParams?.mainProvisioningProfile.guuid}" ` +
          ' CODE_SIGN_STYLE="Manual" CODE_SIGN_IDENTITY="iPhone Distribution" ' +
          ` DEVELOPMENT_TEAM="${this.iosParams?.appleTeamId}" `,
        { cwd: this.buildDir, maxBuffer: 1024 * 1024 * 10 }
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
          { cwd: this.buildDir, maxBuffer: 1024 * 1024 * 10 }
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

  public capSync() {
    console.log("npx cap sync");
    const result = spawnSync("npx", ["cap", "sync"], {
      cwd: this.buildDir,
      maxBuffer: 1024 * 1024 * 10,
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
}
