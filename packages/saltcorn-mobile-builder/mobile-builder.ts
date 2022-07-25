const { PluginManager } = require("live-plugin-manager");
const { staticDependencies } = require("@saltcorn/server/load_plugins");
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
  copyApp,
  prepareBuildDir,
} from "./utils/cordova-build-utils";

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
  copyFileName?: string;

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
    copyFileName?: string;
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
    this.copyFileName = cfg.copyFileName;
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
    });
    await bundlePackagesAndPlugins(this.buildDir, this.plugins);
    await copyPublicDirs(this.buildDir, this.pluginManager, this.plugins);
    await installNpmPackages(this.buildDir, this.pluginManager);
    await buildTablesFile(this.buildDir);
    await createSqliteDb(this.buildDir);
    const resultCode = buildApp(this.buildDir, this.platforms, this.useDocker);
    if (resultCode === 0 && this.copyTargetDir) {
      // copy file to 'copyTargetDir' (only apk)
      await copyApp(this.buildDir, this.copyTargetDir, this.copyFileName);
    }
    return resultCode;
  }
}
