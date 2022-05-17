import { Command, Flags } from "@oclif/core";
import { spawnSync } from "child_process";
import {
  copyFileSync,
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
  };

  supportedPlatforms = ["android", "browser"]; // TODO ios

  packageRoot = join(__dirname, "../../");
  appDir = join(require.resolve("@saltcorn/mobile-app"), "..");
  wwwDir = join(require.resolve("@saltcorn/mobile-app"), "..", "www");

  staticPlugins = ["base", "sbadmin2"];

  manager = new PluginManager({
    pluginsPath: join(this.packageRoot, "plugin_packages", "node_modules"),
    staticDependencies,
  });

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    if (!flags.entryPoint) {
      throw new Error("please specify an entry point for the first view");
    }
    const localUserTables = flags.localUserTables ? flags.localUserTables : [];
    this.copyStaticAssets();
    this.copySbadmin2Deps();
    this.writeCfgFile({
      entryPoint: flags.entryPoint,
      serverPath: "http://10.0.2.2:3000", // host localhost of the android emulator, only for development,
      localUserTables: localUserTables,
    });
    await this.bundlePackages();
    this.copyBundlesToApp();
    await this.installNpmPackages();
    // TODO ch postgres
    await this.copySqliteDbToApp(localUserTables);
    await this.buildTablesFile();
    if (flags.platforms) {
      this.validatePlatforms(flags.platforms);
      this.addPlatforms(flags.platforms);
    }
    this.buildApk();
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
    const sbadmin2Root = join(require.resolve("@saltcorn/sbadmin2"), "..");
    const srcPrefix = join(
      sbadmin2Root,
      "node_modules/startbootstrap-sb-admin-2-bs5"
    );
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
    spawnSync(
      "npm",
      ["run", "build", "--", "--env", `plugins=${JSON.stringify(plugins)}`],
      {
        stdio: "inherit",
        cwd: this.packageRoot,
      }
    );
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
    const info = await this.manager.install("jwt-decode", "3.1.2");
    copySync(
      join(info.location, "build/jwt-decode.js"),
      join(npmTargetDir, "jwt-decode.js")
    );
  };

  copySqliteDbToApp = async (localUserTables: string[]) => {
    const dbPath = join(this.wwwDir, "scdb.sqlite");
    copyFileSync(db.connectObj.sqlite_path, dbPath);
    let connectObj = db.connectObj;
    connectObj.sqlite_path = dbPath;
    await db.changeConnection(connectObj);
    const tablesToDrop = (await db.listUserDefinedTables())
      .filter(
        (table: any) =>
          !localUserTables.find(
            (current) => current.toUpperCase() === table.name.toUpperCase()
          )
      )
      .map(({ name }: { name: string }) => name);
    await db.dropTables(tablesToDrop);
  };

  buildTablesFile = async () => {
    const scTables = (await db.listScTables()).filter(
      (table: Row) =>
        ["_sc_migrations", "_sc_errors"].indexOf(table.name) === -1
    );
    const tables = await Promise.all(
      scTables.map(async (row: Row) => {
        const dbData = await db.select(row.name);
        return { table: row.name, rows: dbData };
      })
    );
    writeFileSync(
      join(this.wwwDir, "tables.json"),
      JSON.stringify({
        created_at: new Date(),
        tables,
      })
    );
  };

  validatePlatforms = (platforms: string[]) => {
    for (const platform of platforms)
      if (!this.supportedPlatforms.includes(platform))
        throw new Error(`The platform '${platform}' is not supported`);
  };

  addPlatforms = (platforms: string[]) => {
    spawnSync("npm", ["run", "add-platform", "--", ...platforms], {
      stdio: "inherit",
      cwd: this.appDir,
    });
  };

  buildApk = () => {
    spawnSync("npm", ["run", "build-app"], {
      stdio: "inherit",
      cwd: this.appDir,
    });
  };
}
