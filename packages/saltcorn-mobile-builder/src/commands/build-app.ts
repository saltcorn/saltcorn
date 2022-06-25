import { Command, Flags } from "@oclif/core";
import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  copySync,
  writeFileSync,
} from "fs-extra";
import { join } from "path";
import db from "@saltcorn/data/db/index";
import Plugin from "@saltcorn/data/models/plugin";
import { Row } from "@saltcorn/db-common/internal";
const reset = require("@saltcorn/data/db/reset_schema");
const { PluginManager } = require("live-plugin-manager");
const {
  staticDependencies,
  requirePlugin,
} = require("@saltcorn/server/load_plugins");

/**
 *
 */
export default class BuildAppCommand extends Command {
  static description = "build mobile app from tenant";

  static flags = {
    platforms: Flags.string({
      name: "platforms",
      char: "p",
      description: "Platforms to build for space separated list",
      multiple: true,
    }),
    entryPoint: Flags.string({
      name: "entry point",
      char: "v",
      description: "Entry Point",
    }),
    localUserTables: Flags.string({
      name: "local user tables",
      char: "l",
      description: "user defined tables that should be replicated into the app",
      multiple: true,
    }),
    useDocker: Flags.boolean({
      name: "user docker build container",
      char: "d",
      description: "Use a docker container to build the app.",
    }),
    copyAppDirectory: Flags.directory({
      name: "app target-directory",
      char: "c",
      description: "If set, the app file will be copied here",
    }),
    appFileName: Flags.string({
      name: "app file name",
      char: "a",
      description: "",
    }),
    serverURL: Flags.string({
      name: "server URL",
      char: "s",
      description: "",
    }),
  };

  supportedPlatforms = ["android", "ios"];

  packageRoot = join(__dirname, "../../");
  appDir = join(require.resolve("@saltcorn/mobile-app"), "..");
  wwwDir = join(this.appDir, "www");

  staticPlugins = ["base", "sbadmin2"];

  manager = new PluginManager({
    pluginsPath: join(this.packageRoot, "plugin_packages", "node_modules"),
    staticDependencies,
  });

  validateParameters = (flags: any) => {
    if (!flags.entryPoint) {
      throw new Error("please specify an entry point for the first view");
    }
    if (!flags.platforms) {
      throw new Error("please specify cordova platforms (android or iOS)");
    }
    for (const platform of flags.platforms)
      if (!this.supportedPlatforms.includes(platform))
        throw new Error(`The platform '${platform}' is not supported`);
  };

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    this.validateParameters(flags);

    const localUserTables = flags.localUserTables ? flags.localUserTables : [];
    this.copyStaticAssets();
    this.copySbadmin2Deps();
    this.writeCfgFile({
      entryPoint: flags.entryPoint,
      serverPath: flags.serverURL ? flags.serverURL : "http://10.0.2.2:3000", // host localhost of the android emulator
      localUserTables: localUserTables,
    });
    await this.bundlePackages();
    this.copyBundlesToApp();
    await this.installNpmPackages();
    await this.buildTablesFile(localUserTables);
    await this.createSqliteDb();
    const resultCode = this.buildApp(flags);
    if (resultCode === 0 && flags.copyAppDirectory) await this.copyApp(flags);
    process.exit(resultCode);
  }

  copyStaticAssets = () => {
    const assetsDst = join(
      this.wwwDir,
      "static_assets",
      db.connectObj.version_tag
    );
    if (!existsSync(assetsDst)) {
      mkdirSync(assetsDst, { recursive: true });
    }
    const serverRoot = join(require.resolve("@saltcorn/server"), "..");
    const srcPrefix = join(serverRoot, "public");
    const srcFiles = [
      "jquery-3.6.0.min.js",
      "saltcorn-common.js",
      "saltcorn.js",
      "saltcorn.css",
      "codemirror.js",
      "codemirror.css",
    ];
    for (const srcFile of srcFiles) {
      copySync(join(srcPrefix, srcFile), join(assetsDst, srcFile));
    }
  };

  copySbadmin2Deps = () => {
    const sbadmin2Dst = join(
      this.wwwDir,
      "plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.5"
    );
    if (!existsSync(sbadmin2Dst)) {
      mkdirSync(sbadmin2Dst, { recursive: true });
    }
    const devPath = join(
      __dirname,
      "../../../../",
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
  };

  writeCfgFile = ({ entryPoint, serverPath, localUserTables }: any) => {
    let cfg = {
      version_tag: db.connectObj.version_tag,
      entry_view: `get/view/${entryPoint}`,
      server_path: serverPath,
      localUserTables,
    };
    writeFileSync(join(this.wwwDir, "config"), JSON.stringify(cfg));
  };

  bundlePackages = async () => {
    const plugins = (await Plugin.find()).filter(
      (plugin: Plugin) => !this.staticPlugins.includes(plugin.name)
    );
    const result = spawnSync(
      "npm",
      ["run", "build", "--", "--env", `plugins=${JSON.stringify(plugins)}`],
      {
        stdio: "pipe",
        cwd: this.packageRoot,
      }
    );
    console.log(result.output.toString());
    for (const plugin of plugins) {
      const required = await requirePlugin(plugin, false, this.manager);
      const srcPublicDir = join(required.location, "public");
      if (existsSync(srcPublicDir)) {
        const dstPublicDir = join(
          this.wwwDir,
          "plugins",
          "public",
          plugin.name
        );
        if (!existsSync(dstPublicDir)) {
          mkdirSync(dstPublicDir, { recursive: true });
        }
        for (const dirEntry of readdirSync(srcPublicDir)) {
          copySync(join(srcPublicDir, dirEntry), join(dstPublicDir, dirEntry));
        }
      }
    }
  };

  copyBundlesToApp = () => {
    const localBundleDir = join(this.packageRoot, "bundle");
    const appBundlesDir = join(
      require.resolve("@saltcorn/mobile-app"),
      "../www/js/bundles"
    );
    if (!existsSync(appBundlesDir))
      mkdirSync(appBundlesDir, { recursive: true });
    for (let bundleName of readdirSync(localBundleDir)) {
      copySync(
        join(localBundleDir, bundleName),
        join(appBundlesDir, bundleName)
      );
    }
  };

  installNpmPackages = async () => {
    const npmTargetDir = join(this.wwwDir, "npm_packages");
    if (!existsSync(npmTargetDir)) mkdirSync(npmTargetDir, { recursive: true });
    const jwtInfo = await this.manager.install("jwt-decode", "3.1.2");
    copySync(
      join(jwtInfo.location, "build/jwt-decode.js"),
      join(npmTargetDir, "jwt-decode.js")
    );
    const routerInfo = await this.manager.install("universal-router", "9.1.0");
    copySync(
      join(routerInfo.location, "universal-router.min.js"),
      join(npmTargetDir, "universal-router.min.js")
    );
    const axiosInfo = await this.manager.install("axios", "0.27.2");
    copySync(
      join(axiosInfo.location, "dist", "axios.min.js"),
      join(npmTargetDir, "axios.min.js")
    );
  };

  createSqliteDb = async () => {
    const dbPath = join(this.wwwDir, "scdb.sqlite");
    let connectObj = db.connectObj;
    connectObj.sqlite_path = dbPath;
    await db.changeConnection(connectObj);
    await reset();
  };

  buildTablesFile = async (localUserTables: string[]) => {
    const scTables = (await db.listScTables()).filter(
      (table: Row) =>
        ["_sc_migrations", "_sc_errors"].indexOf(table.name) === -1
    );
    const tablesWithData = await Promise.all(
      scTables.map(async (row: Row) => {
        const dbData = await db.select(row.name);
        return { table: row.name, rows: dbData };
      })
    );
    writeFileSync(
      join(this.wwwDir, "tables.json"),
      JSON.stringify({
        created_at: new Date(),
        sc_tables: tablesWithData,
      })
    );
  };

  addPlatforms = (platforms: string[]) => {
    const result = spawnSync(
      "npm",
      ["run", "add-platform", "--", ...platforms],
      {
        cwd: this.appDir,
      }
    );
    console.log(result.output.toString());
  };

  callBuild = (platforms: string[]) => {
    this.addPlatforms(platforms);
    const result = spawnSync("npm", ["run", "build-app", "--", ...platforms], {
      cwd: this.appDir,
    });
    console.log(result.output.toString());
    return result.status;
  };

  runBuildContainer = (options: any): any =>
    spawnSync(
      "docker",
      [
        "run",
        "-v",
        `${this.appDir}:/saltcorn-mobile-app`,
        "saltcorn/cordova-builder",
      ],
      options
    );

  buildApkInContainer = () => {
    const spawnOptions: any = {
      cwd: ".",
    };
    // try docker without sudo
    let result = this.runBuildContainer(spawnOptions);
    if (result.status === 0) {
      console.log(result.output.toString());
    } else if (result.status === 1 || result.status === 125) {
      // try docker rootless
      spawnOptions.env = {
        DOCKER_HOST: `unix://${process.env.XDG_RUNTIME_DIR}/docker.sock`,
      };
      result = this.runBuildContainer(spawnOptions);
      if (result.status === 0) {
        console.log(result.output.toString());
      } else {
        console.log("Unable to run the docker build image.");
        console.log(
          "Try installing 'docker rootless' mode, or add the current user to the 'docker' group."
        );
        console.log(result);
        console.log(result.output.toString());
      }
    } else {
      console.log("An error occured");
      console.log(result);
    }
    return result.status;
  };

  /**
   * build '.apk / .ipa' files with cordova (only android is tested)
   * @param flags
   * @returns
   */
  buildApp = (flags: any) => {
    if (!flags.useDocker) {
      return this.callBuild(flags.platforms);
    } else {
      let code = this.buildApkInContainer();
      if (code === 0 && flags.platforms.indexOf("ios") > -1)
        code = this.callBuild(["ios"]);
      return code;
    }
  };

  copyApp = async (flags: any) => {
    if (!existsSync(flags.copyAppDirectory)) {
      mkdirSync(flags.copyAppDirectory);
    }
    const apkName = "app-debug.apk";
    const apkFile = join(
      this.appDir,
      "platforms",
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      apkName
    );
    const targetFile = flags.appFileName ? flags.appFileName : apkName;
    copySync(apkFile, join(flags.copyAppDirectory, targetFile));
  };
}
