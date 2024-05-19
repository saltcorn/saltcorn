import { spawnSync, execSync } from "child_process";
import { join, basename } from "path";
import { existsSync, mkdirSync, copySync, rmSync } from "fs-extra";
import utils = require("@saltcorn/data/utils");
const { fileWithEnding, safeEnding } = utils;
import File from "@saltcorn/data/models/file";
import type User from "@saltcorn/data/models/user";

export type CordovaCfg = {
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

export class CordovaHelper {
  buildDir: string;
  platforms: string[];
  buildType: "debug" | "release";
  appName: string;

  useDocker?: boolean;
  keyStoreFile?: string;
  keyStoreAlias?: string;
  keyStorePassword?: string;
  androidReleaseOut: string;
  androidDebugOut: string;

  appleTeamId?: string;
  provisioningGUUID?: string;

  constructor(cfg: CordovaCfg) {
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
    const androidOut = join(
      this.buildDir,
      "platforms",
      "android",
      "app",
      "build",
      "outputs"
    );
    this.androidReleaseOut = join(androidOut, "bundle", "release");
    this.androidDebugOut = join(androidOut, "apk", "debug");

    this.appleTeamId = cfg.appleTeamId;
    this.provisioningGUUID = cfg.provisioningGUUID;
  }

  buildApp() {
    let code = null;
    if (!this.useDocker) {
      this.addPlugins();
      code = this.callBuild();
    } else {
      code = this.buildApkInContainer();
      if (code === 0 && this.platforms.includes("ios"))
        code = this.callBuild(["ios"]);
    }
    if (code !== 0) return code;
    if (this.platforms.includes("ios")) {
      this.copyAppIconsSet();
      code = this.runXcodeCmds();
    }
    return code;
  }

  private runXcodeCmds() {
    try {
      console.log("xcodebuild -workspace");
      let buffer = execSync(
        `xcodebuild -workspace platforms/ios/${this.appName}.xcworkspace ` +
          `-scheme ${this.appName} -destination "generic/platform=iOS" ` +
          `-archivePath MyArchive.xcarchive archive PROVISIONING_PROFILE="${this.provisioningGUUID}" ` +
          ` CODE_SIGN_STYLE="Manual" DEVELOPMENT_TEAM="${this.appleTeamId}"`,
        { cwd: this.buildDir }
      );
      console.log(buffer.toString());
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
        return 0;
      }
    } catch (err) {
      console.log(err);
      return 1;
    }
  }

  private copyAppIconsSet() {
    const src = join(this.buildDir, "AppIcon.appiconset");
    if (!existsSync(src)) {
      console.log("AppIcon.appiconset not found");
    } else {
      const dst = join(
        this.buildDir,
        "platforms",
        "ios",
        this.appName,
        "Assets.xcassets",
        "AppIcon.appiconset"
      );
      try {
        rmSync(dst, { recursive: true, force: true });
        copySync(src, dst, { recursive: true, overwrite: true });
      } catch (err) {
        console.log(err);
      }
    }
  }

  private buildApkInContainer() {
    const spawnParams = [
      "run",
      "--network",
      "host",
      "-v",
      `${this.buildDir}:/saltcorn-mobile-app`,
      "saltcorn/cordova-builder",
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
    else if (result.error) console.log(result.error.toString());
    else console.log("docker finished without output");
    return result.status;
  }

  private addPlugins() {
    const addFn = (plugin: string) => {
      let result = spawnSync("npm", ["run", "add-plugin", "--", plugin], {
        cwd: this.buildDir,
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      });
      console.log(result.output.toString());
    };
    addFn("cordova-sqlite-ext");
    addFn("cordova-plugin-file@7.0.0");
    addFn("cordova-plugin-inappbrowser");
    addFn("cordova-plugin-network-information");
    addFn("cordova-plugin-geolocation");
    addFn("cordova-plugin-camera");
  }

  private addPlatforms() {
    const result = spawnSync(
      "npm",
      ["run", "add-platform", "--", ...this.platforms],
      {
        cwd: this.buildDir,
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
      }
    );
    console.log(result.output.toString());
  }

  private callBuild(platforms: string[] = this.platforms) {
    this.addPlatforms();
    let buildParams = [...platforms, `--${this.buildType}`];
    if (this.keyStoreFile) {
      buildParams.push(
        `--keystore=${this.keyStoreFile}`,
        `--alias=${this.keyStoreAlias || "??"}`,
        `--password=${this.keyStorePassword || "??"}`,
        `--storePassword=${this.keyStorePassword || "??"}`
      );
    }
    if (platforms.includes("ios")) {
      buildParams.push(
        `--developmentTeam=${this.appleTeamId}`,
        "--codeSignIdentity=iPhone Developer",
        "--packageType=app-store",
        `--provisioningProfile=${this.provisioningGUUID}`
      );
    }
    const result = spawnSync(
      "npm",
      ["run", "build-app", "--", ...buildParams],
      {
        cwd: this.buildDir,
      }
    );
    console.log(result.output.toString());
    return result.status;
  }

  /**
   * copy .apk / .aab / .ipa files to 'copyDir' if they exist
   * @param copyDir directory where the resulting app file will be copied to
   * @param user the user specified by the userEmail (-c) parameter
   * @param appName
   */
  async tryCopyAppFiles(copyDir: string, user: User, appName?: string) {
    const copyHelper = async (ending: "apk" | "aab", apkBuildDir: string) => {
      const appFile = fileWithEnding(apkBuildDir, `.${ending}`);
      if (appFile) {
        const dstFile = appName
          ? safeEnding(appName, `.${ending}`)
          : `app-${this.buildType}.${ending}`;
        copySync(join(apkBuildDir, appFile), join(copyDir, dstFile));
        await File.set_xattr_of_existing_file(dstFile, copyDir, user);
      }
    };

    if (!existsSync(copyDir)) mkdirSync(copyDir);
    if (this.buildType === "debug") copyHelper("apk", this.androidDebugOut);
    else copyHelper("aab", this.androidReleaseOut);

    // iOS .ipa file
    const ipaFile = fileWithEnding(this.buildDir, ".ipa");
    if (ipaFile) {
      const dstFile = appName ? safeEnding(appName, ".ipa") : "app-debug.ipa";
      copySync(join(this.buildDir, ipaFile), join(copyDir, dstFile));
      await File.set_xattr_of_existing_file(dstFile, copyDir, user);
    }
  }
}
