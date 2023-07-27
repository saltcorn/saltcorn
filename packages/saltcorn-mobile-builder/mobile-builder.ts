const { PluginManager } = require("live-plugin-manager");
const {
  loadAllPlugins,
  staticDependencies,
} = require("@saltcorn/server/load_plugins");
const { features } = require("@saltcorn/data/db/state");
import { join } from "path";
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
} from "./utils/common-build-utils";
import {
  bundlePackagesAndPlugins,
  copyPublicDirs,
  installNpmPackages,
} from "./utils/package-bundle-utils";
import {
  buildApp,
  tryCopyAppFiles,
  prepareBuildDir,
  setAppName,
  setAppVersion,
  prepareAppIcon,
} from "./utils/cordova-build-utils";
import User from "@saltcorn/data/models/user";

type EntryPointType = "view" | "page";

/**
 *
 */
export class MobileBuilder {
  appName?: string;
  appVersion?: string;
  appIcon?: string;
  templateDir: string;
  buildDir: string;
  cliDir: string;
  useDocker?: boolean;
  platforms: string[];
  localUserTables: string[];
  entryPoint: string;
  entryPointType: EntryPointType;
  serverURL: string;
  splashPage?: string;
  allowOfflineMode: string;
  pluginManager: any;
  plugins: Plugin[];
  packageRoot = join(__dirname, "../");
  copyTargetDir?: string;
  user?: User;
  buildForEmulator?: boolean;
  tenantAppName?: string;

  /**
   *
   * @param cfg
   */
  constructor(cfg: {
    appName?: string;
    appVersion?: string;
    appIcon?: string;
    templateDir: string;
    buildDir: string;
    cliDir: string;
    useDocker?: boolean;
    platforms: string[];
    localUserTables?: string[];
    entryPoint: string;
    entryPointType: EntryPointType;
    serverURL: string;
    splashPage?: string;
    allowOfflineMode: string;
    plugins: Plugin[];
    copyTargetDir?: string;
    user?: User;
    buildForEmulator?: boolean;
    tenantAppName?: string;
  }) {
    this.appName = cfg.appName;
    this.appVersion = cfg.appVersion;
    this.appIcon = cfg.appIcon;
    this.templateDir = cfg.templateDir;
    this.buildDir = cfg.buildDir;
    this.cliDir = cfg.cliDir;
    this.useDocker = cfg.useDocker;
    this.platforms = cfg.platforms;
    this.localUserTables = cfg.localUserTables ? cfg.localUserTables : [];
    this.entryPoint = cfg.entryPoint;
    this.entryPointType = cfg.entryPointType;
    this.serverURL = cfg.serverURL;
    this.splashPage = cfg.splashPage;
    this.allowOfflineMode = cfg.allowOfflineMode;
    this.pluginManager = new PluginManager({
      pluginsPath: join(this.buildDir, "plugin_packages", "node_modules"),
      staticDependencies,
    });
    this.plugins = cfg.plugins;
    this.copyTargetDir = cfg.copyTargetDir;
    this.user = cfg.user;
    this.buildForEmulator = cfg.buildForEmulator;
    this.tenantAppName = cfg.tenantAppName;
  }

  /**
   *
   */
  async build() {
    prepareBuildDir(this.buildDir, this.templateDir);
    if (this.appName) await setAppName(this.buildDir, this.appName);
    if (this.appVersion) await setAppVersion(this.buildDir, this.appVersion);
    if (this.appIcon) await prepareAppIcon(this.buildDir, this.appIcon);
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
      tenantAppName: this.tenantAppName,
      allowOfflineMode: this.allowOfflineMode,
    });
    let resultCode = await bundlePackagesAndPlugins(
      this.buildDir,
      this.plugins
    );
    if (resultCode !== 0) return resultCode;
    features.version_plugin_serve_path = false;
    await loadAllPlugins();
    await copyPublicDirs(this.buildDir);
    await installNpmPackages(this.buildDir, this.pluginManager);
    await buildTablesFile(this.buildDir);
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
    resultCode = buildApp(
      this.buildDir,
      this.platforms,
      this.useDocker,
      this.buildForEmulator
    );
    if (resultCode === 0 && this.copyTargetDir) {
      await tryCopyAppFiles(
        this.buildDir,
        this.copyTargetDir,
        this.user!,
        this.appName
      );
    }
    return resultCode;
  }
}
