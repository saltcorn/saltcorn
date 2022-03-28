import { Command, Flags } from "@oclif/core";
import { spawnSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { Builder, parseString } from "xml2js";
import db from "@saltcorn/data/db/index";
import Plugin from "@saltcorn/data/models/plugin";

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

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    if (!flags.entryPoint) {
      throw new Error("please specify an entry point for the first view");
    }
    this.copyPublics();
    this.copyPluginSources();
    await this.bundlePackages();
    this.copyBundlesToApp();
    // TODO ch postgres
    await this.copySqliteDbToApp();
    if (flags.platforms) {
      this.validatePlatforms(flags.platforms);
      this.addPlatforms(flags.platforms);
    }
    this.buildApk(flags.entryPoint, this.serverPath);
  }

  copyPublics = () => {
    if (!existsSync(join(this.wwwDir, "plugin_sources")))
      mkdirSync(join(this.wwwDir, "public"), { recursive: true });
    copyFileSync(
      join(this.serverRoot, "public/jquery-3.6.0.min.js"),
      join(this.wwwDir, "public", "jquery-3.6.0.min.js")
    );
    copyFileSync(
      join(this.serverRoot, "public/saltcorn.js"),
      join(this.wwwDir, "public", "saltcorn.js")
    );
    copyFileSync(
      join(this.serverRoot, "public/saltcorn.css"),
      join(this.wwwDir, "public", "saltcorn.css")
    );
  };

  copyPluginSources = () => {
    if (!existsSync(join(this.wwwDir, "plugin_sources")))
      mkdirSync(join(this.wwwDir, "plugin_sources"), { recursive: true });
    copyFileSync(
      join(
        this.sbadmin2Root,
        "node_modules/startbootstrap-sb-admin-2-bs5/vendor/fontawesome-free/css/all.min.css"
      ),
      join(this.wwwDir, "plugin_sources", "all.min.css")
    );
    copyFileSync(
      join(
        this.sbadmin2Root,
        "node_modules/startbootstrap-sb-admin-2-bs5/vendor/bootstrap/js/bootstrap.bundle.min.js"
      ),
      join(this.wwwDir, "plugin_sources", "bootstrap.bundle.min.js")
    );
    copyFileSync(
      join(
        this.sbadmin2Root,
        "node_modules/startbootstrap-sb-admin-2-bs5/vendor/jquery-easing/jquery.easing.min.js"
      ),
      join(this.wwwDir, "plugin_sources", "jquery.easing.min.js")
    );
    copyFileSync(
      join(
        this.sbadmin2Root,
        "node_modules/startbootstrap-sb-admin-2-bs5/css/sb-admin-2.css"
      ),
      join(this.wwwDir, "plugin_sources", "sb-admin-2.css")
    );
    copyFileSync(
      join(
        this.sbadmin2Root,
        "node_modules/startbootstrap-sb-admin-2-bs5/js/sb-admin-2.min.js"
      ),
      join(this.wwwDir, "plugin_sources", "sb-admin-2.min.js")
    );
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
  };

  copyBundlesToApp = () => {
    if (!existsSync(this.appBundlesDir))
      mkdirSync(this.appBundlesDir, { recursive: true });
    for (let bundleName of readdirSync(this.bundleDir)) {
      copyFileSync(
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

  buildApk = (entryPoint: string, serverPath: string) => {
    const cfgFile = join(this.appDir, "config.xml");
    const xml = readFileSync(cfgFile).toString();
    parseString(xml, (err: any, result: any) => {
      if (err) {
        throw new Error(err);
      }
      if (
        result.widget &&
        result.widget.content &&
        result.widget.content.length === 1 &&
        result.widget.content[0].$
      ) {
        result.widget.content[0].$.src = `index.html?entry_view=get/view/${entryPoint}&server_path=${serverPath}`;
      } else {
        throw new Error("config.xml is missing a content element");
      }
      writeFileSync(cfgFile, new Builder().buildObject(result));
    });
    spawnSync("npm", ["run", "build-app"], {
      stdio: "inherit",
      cwd: this.appDir,
    });
  };
}
