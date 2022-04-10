import { Command, Flags } from "@oclif/core";
import { spawnSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  copySync,
  writeSync,
  writeFileSync,
} from "fs-extra";
import { join } from "path";
import db from "@saltcorn/data/db/index";
import Plugin from "@saltcorn/data/models/plugin";
const { PluginManager } = require("live-plugin-manager");
const {
  staticDependencies,
  requirePlugin,
} = require("@saltcorn/server/load_plugins");

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
  };

  supportedPlatforms = ["android", "browser"]; // TODO ios

  packageRoot = join(__dirname, "../../");
  bundleDir = join(this.packageRoot, "bundle");
  saltcornMarkupRoot = join(require.resolve("@saltcorn/markup"), "../../");
  appDir = join(require.resolve("@saltcorn/mobile-app"), "..");
  wwwDir = join(require.resolve("@saltcorn/mobile-app"), "..", "www");
  appBundlesDir = join(
    require.resolve("@saltcorn/mobile-app"),
    "../www/js/bundles"
  );
  sbadmin2Root = join(require.resolve("@saltcorn/sbadmin2"), "..");
  serverRoot = join(require.resolve("@saltcorn/server"), "..");

  tempPluginDir = join(this.packageRoot, "plugins");

  staticPlugins = ["base", "sbadmin2"];
  // host localhost of the android emulator, only for development,
  serverPath = "http://10.0.2.2:3000";

  manager = new PluginManager({
    pluginsPath: join(this.packageRoot, "plugin_packages", "node_modules"),
    staticDependencies,
  });

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    if (!flags.entryPoint) {
      throw new Error("please specify an entry point for the first view");
    }
    this.copyStaticAssets();
    this.copySbadmin2Deps();
    this.writeCfgFile({
      entryPoint: flags.entryPoint,
      serverPath: this.serverPath,
    });
    await this.bundlePackages();
    this.copyBundlesToApp();
    // TODO ch postgres
    await this.copySqliteDbToApp();
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
    const srcPrefix = join(this.serverRoot, "public");
    const srcFiles = ["jquery-3.6.0.min.js", "saltcorn.js", "saltcorn.css"];
    for (const srcFile of srcFiles) {
      copySync(join(srcPrefix, srcFile), join(assetsDst, srcFile));
    }
  };

  copySbadmin2Deps = () => {
    const sbadmin2Dst = join(
      this.wwwDir,
      "plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.0"
    );
    if (!existsSync(sbadmin2Dst)) {
      mkdirSync(sbadmin2Dst, { recursive: true });
    }
    const srcPrefix = join(
      this.sbadmin2Root,
      "node_modules/startbootstrap-sb-admin-2-bs5"
    );
    const srcFiles = [
      "vendor/fontawesome-free/css/all.min.css",
      "vendor/bootstrap/js/bootstrap.bundle.min.js",
      "vendor/jquery-easing/jquery.easing.min.js",
      "css/sb-admin-2.css",
      "js/sb-admin-2.min.js",
    ];
    for (const srcFile of srcFiles) {
      copySync(join(srcPrefix, srcFile), join(sbadmin2Dst, srcFile));
    }
  };

  writeCfgFile = ({ entryPoint, serverPath }: Record<string, string>) => {
    let cfg = {
      version_tag: db.connectObj.version_tag,
      entry_view: `get/view/${entryPoint}`,
      server_path: `${serverPath}`,
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
    if (!existsSync(this.appBundlesDir))
      mkdirSync(this.appBundlesDir, { recursive: true });
    for (let bundleName of readdirSync(this.bundleDir)) {
      copySync(
        join(this.bundleDir, bundleName),
        join(this.appBundlesDir, bundleName)
      );
    }
  };

  copySqliteDbToApp = async () => {
    const dbPath = join(this.wwwDir, "scdb.sqlite");
    copyFileSync(db.connectObj.sqlite_path, dbPath);
    let connectObj = db.connectObj;
    connectObj.sqlite_path = dbPath;
    await db.changeConnection(connectObj);
    await db.dropUserDefinedTables();
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
