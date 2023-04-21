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
  copyStaticAssets,
  copyTranslationFiles,
  createSqliteDb,
  writeCfgFile,
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
} from "./utils/cordova-build-utils";
import User from "@saltcorn/data/models/user";

type EntryPointType = "view" | "page";

/**
 *
 */
export class MobileBuilder {
  templateDir: string;
  buildDir: string;
  cliDir: string;
  useDocker?: boolean;
  platforms: string[];
  localUserTables: string[];
  entryPoint: string;
  entryPointType: EntryPointType;
  serverURL: string;
  pluginManager: any;
  plugins: Plugin[];
  packageRoot = join(__dirname, "../");
  copyTargetDir?: string;
  user?: User;
  copyFileName?: string;
  buildForEmulator?: boolean;
  tenantAppName?: string;

  /**
   *
   * @param cfg
   */
  constructor(cfg: {
    templateDir: string;
    buildDir: string;
    cliDir: string;
    useDocker?: boolean;
    platforms: string[];
    localUserTables?: string[];
    entryPoint: string;
    entryPointType: EntryPointType;
    serverURL: string;
    plugins: Plugin[];
    copyTargetDir?: string;
    user?: User;
    copyFileName?: string;
    buildForEmulator?: boolean;
    tenantAppName?: string;
  }) {
    this.templateDir = cfg.templateDir;
    this.buildDir = cfg.buildDir;
    this.cliDir = cfg.cliDir;
    this.useDocker = cfg.useDocker;
    this.platforms = cfg.platforms;
    this.localUserTables = cfg.localUserTables ? cfg.localUserTables : [];
    this.entryPoint = cfg.entryPoint;
    this.entryPointType = cfg.entryPointType;
    this.serverURL = cfg.serverURL;
    this.pluginManager = new PluginManager({
      pluginsPath: join(this.buildDir, "plugin_packages", "node_modules"),
      staticDependencies,
    });
    this.plugins = cfg.plugins;
    this.copyTargetDir = cfg.copyTargetDir;
    this.user = cfg.user;
    this.copyFileName = cfg.copyFileName;
    this.buildForEmulator = cfg.buildForEmulator;
    this.tenantAppName = cfg.tenantAppName;
  }

  /**
   *
   */
  async build() {
    prepareBuildDir(this.buildDir, this.templateDir);
    copyStaticAssets(this.buildDir);
    copySbadmin2Deps(this.buildDir);
    copyTranslationFiles(this.buildDir);
    writeCfgFile({
      buildDir: this.buildDir,
      entryPoint: this.entryPoint,
      entryPointType: this.entryPointType,
      serverPath: this.serverURL ? this.serverURL : "http://10.0.2.2:3000", // host localhost of the android emulator
      localUserTables: this.localUserTables,
      tenantAppName: this.tenantAppName,
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
        this.copyFileName
      );
    }
    return resultCode;
  }
}
