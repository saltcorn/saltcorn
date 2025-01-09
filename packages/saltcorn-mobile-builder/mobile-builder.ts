const { PluginManager } = require("live-plugin-manager");
const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
import { join, basename } from "path";
import { copySync } from "fs-extra";
import Plugin from "@saltcorn/data/models/plugin";
import {
  buildTablesFile,
  copySbadmin2Deps,
  copySiteLogo,
  copyServerFiles,
  copyTranslationFiles,
  createSqliteDb,
  writeCfgFile,
  prepareSplashPage,
  prepareBuildDir,
  prepareExportOptionsPlist,
  copyShareExtFiles,
  writeCapacitorConfig,
  prepAppIcon,
  modifyInfoPlist,
  writePodfile,
  modifyXcodeProjectFile,
  writePrivacyInfo,
  modifyAndroidManifest,
  writeDataExtractionRules,
  writeNetworkSecurityConfig,
  modifyGradleConfig,
} from "./utils/common-build-utils";
import {
  bundlePackagesAndPlugins,
  copyPublicDirs,
  bundleMobileAppCode,
} from "./utils/package-bundle-utils";
import User from "@saltcorn/data/models/user";
import { CapacitorHelper } from "./utils/capacitor-helper";
import { removeNonWordChars } from "@saltcorn/data/utils";

type EntryPointType = "view" | "page";
const appIdDefault = "saltcorn.mobile.app";
const appNameDefault = "SaltcornMobileApp";

export type IosCfg = {
  appleTeamId: string;
  mainProvisioningProfile: {
    guuid: string;
  };
  shareExtensionProvisioningProfile?: {
    guuid: string;
    specifier: string;
    identifier: string;
  };
};

type MobileBuilderConfig = {
  appName?: string;
  appId?: string;
  appVersion?: string;
  appIcon?: string;
  templateDir: string;
  buildDir: string;
  cliDir: string;
  useDocker?: boolean;
  platforms: string[];
  localUserTables?: string[];
  synchedTables?: string[];
  includedPlugins?: string[];
  entryPoint: string;
  entryPointType: EntryPointType;
  serverURL: string;
  splashPage?: string;
  autoPublicLogin: string;
  allowOfflineMode: string;
  plugins: Plugin[];
  copyTargetDir?: string;
  user?: User;
  iosParams?: IosCfg;
  allowShareTo?: boolean;
  tenantAppName?: string;
  keyStorePath?: string;
  keyStoreAlias?: string;
  keyStorePassword?: string;
  buildType: "debug" | "release";
};

/**
 *
 */
export class MobileBuilder {
  appName: string;
  appId: string;
  appVersion: string;
  appIcon?: string;
  templateDir: string;
  buildDir: string;
  cliDir: string;
  useDocker?: boolean;
  platforms: string[];
  localUserTables: string[];
  synchedTables: string[];
  includedPlugins: string[];
  entryPoint: string;
  entryPointType: EntryPointType;
  serverURL: string;
  splashPage?: string;
  autoPublicLogin: string;
  allowOfflineMode: string;
  pluginManager: any;
  plugins: Plugin[];
  packageRoot = join(__dirname, "../");
  copyTargetDir?: string;
  user?: User;
  allowShareTo: boolean;
  tenantAppName?: string;
  keyStorePath: string;
  keyStoreAlias: string;
  keyStorePassword: string;
  isUnsecureKeyStore: boolean;
  buildType: "debug" | "release";
  iosParams?: IosCfg;
  capacitorHelper: CapacitorHelper;

  /**
   *
   * @param cfg
   */
  constructor(cfg: MobileBuilderConfig) {
    this.appName = cfg.appName || appNameDefault;
    if (cfg.appId) this.appId = cfg.appId;
    else if (cfg.appName && cfg.appName !== appNameDefault)
      this.appId = `${removeNonWordChars(cfg.appName)}.mobile.app`;
    else this.appId = appIdDefault;
    this.appVersion = cfg.appVersion || "0.0.1";
    this.appIcon = cfg.appIcon;
    this.templateDir = cfg.templateDir;
    this.buildDir = cfg.buildDir;
    this.cliDir = cfg.cliDir;
    this.useDocker = cfg.useDocker;
    this.platforms = cfg.platforms;
    this.localUserTables = cfg.localUserTables ? cfg.localUserTables : [];
    this.synchedTables = cfg.synchedTables ? cfg.synchedTables : [];
    this.includedPlugins = cfg.includedPlugins ? cfg.includedPlugins : [];
    this.entryPoint = cfg.entryPoint;
    this.entryPointType = cfg.entryPointType;
    this.serverURL = cfg.serverURL;
    this.splashPage = cfg.splashPage;
    this.autoPublicLogin = cfg.autoPublicLogin;
    this.allowOfflineMode = cfg.allowOfflineMode;
    this.pluginManager = new PluginManager({
      pluginsPath: join(this.buildDir, "plugin_packages", "node_modules"),
    });
    this.plugins = cfg.plugins;
    this.copyTargetDir = cfg.copyTargetDir;
    this.user = cfg.user;
    this.allowShareTo = cfg.allowShareTo || false;
    this.tenantAppName = cfg.tenantAppName;
    if (cfg.keyStorePath && cfg.keyStoreAlias && cfg.keyStorePassword) {
      this.keyStorePath = cfg.keyStorePath;
      this.keyStoreAlias = cfg.keyStoreAlias;
      this.keyStorePassword = cfg.keyStorePassword;
      this.isUnsecureKeyStore = false;
    } else {
      this.keyStorePath = join(this.buildDir, "unsecure-default-key.jks");
      this.keyStoreAlias = "unsecure-default-alias";
      this.keyStorePassword = "unsecurepassw";
      this.isUnsecureKeyStore = true;
    }
    this.buildType = cfg.buildType;
    this.iosParams = cfg.iosParams;
    this.capacitorHelper = new CapacitorHelper({
      ...this,
      appVersion: this.appVersion,
    });
  }

  /**
   *
   */
  public async fullBuild() {
    try {
      let resultCode = await this.prepareStep();
      if (resultCode !== 0) return resultCode;
      else return await this.finishStep();
    } catch (error: any) {
      console.error(error);
      return 1;
    }
  }

  public async prepareStep() {
    try {
      prepareBuildDir(this.buildDir, this.templateDir);
      writeCapacitorConfig(this.buildDir, {
        appName: this.appName,
        appId: this.appId !== appIdDefault ? this.appId : undefined,
        appVersion: this.appVersion,
        unsecureNetwork:
          this.serverURL.startsWith("http://") || !this.serverURL,
        keystorePath: this.keyStorePath,
        keystoreAlias: this.keyStoreAlias,
        keystorePassword: this.keyStorePassword,
        keystoreAliasPassword: this.keyStorePassword,
        buildType: this.buildType,
      });
      this.capacitorHelper.addPlatforms();
      return 0;
    } catch (e: any) {
      console.error(e);
      return 1;
    }
  }

  public async finishStep() {
    try {
      if (this.appIcon) prepAppIcon(this.buildDir, this.appIcon);
      copyServerFiles(this.buildDir);
      copySbadmin2Deps(this.buildDir);
      await copySiteLogo(this.buildDir);
      copyTranslationFiles(this.buildDir);
      writeCfgFile({
        buildDir: this.buildDir,
        entryPoint: this.entryPoint,
        entryPointType: this.entryPointType,
        serverPath: this.serverURL ? this.serverURL : "http://10.0.2.2:3000", // host localhost of the android emulator
        localUserTables: this.localUserTables,
        synchedTables: this.synchedTables,
        tenantAppName: this.tenantAppName,
        autoPublicLogin: this.autoPublicLogin,
        allowOfflineMode: this.allowOfflineMode,
        allowShareTo: this.allowShareTo,
      });
      let resultCode = await bundlePackagesAndPlugins(
        this.buildDir,
        this.plugins
      );
      if (resultCode !== 0) return resultCode;
      resultCode = bundleMobileAppCode(this.buildDir);
      if (resultCode !== 0) return resultCode;
      await loadAllPlugins();
      await copyPublicDirs(this.buildDir);
      await buildTablesFile(this.buildDir, this.includedPlugins);
      if (this.splashPage)
        await prepareSplashPage(
          this.buildDir,
          this.splashPage,
          this.serverURL,
          this.tenantAppName,
          this.user
        );
      resultCode = await createSqliteDb(this.buildDir);
      if (resultCode !== 0) return resultCode;

      if (this.platforms.includes("ios")) await this.handleIosPlatform();
      if (this.platforms.includes("android"))
        await this.handleAndroidPlatform();
      this.capacitorHelper.generateAssets();
      await this.capacitorHelper.buildApp();
      if (resultCode === 0 && this.copyTargetDir) {
        this.capacitorHelper.tryCopyAppFiles(
          this.copyTargetDir,
          this.user!,
          this.appName
        );
      }
      return resultCode;
    } catch (e: any) {
      console.error(e);
      return 1;
    }
  }

  private async handleIosPlatform() {
    prepareExportOptionsPlist({
      buildDir: this.buildDir,
      appId: this.appId,
      iosParams: this.iosParams,
    });
    modifyXcodeProjectFile(this.buildDir, this.appVersion, this.iosParams!);
    writePodfile(this.buildDir);
    writePrivacyInfo(this.buildDir);
    modifyInfoPlist(this.buildDir, this.allowShareTo);
    if (this.allowShareTo) copyShareExtFiles(this.buildDir);
  }

  private async handleAndroidPlatform() {
    if (!this.isUnsecureKeyStore) {
      copySync(
        this.keyStorePath,
        join(this.buildDir, basename(this.keyStorePath))
      );
    }
    await modifyAndroidManifest(this.buildDir);
    writeDataExtractionRules(this.buildDir);
    writeNetworkSecurityConfig(this.buildDir, this.serverURL);
    modifyGradleConfig(this.buildDir, this.appVersion);
  }
}
