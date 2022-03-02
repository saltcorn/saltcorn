import { Command, Flags } from "@oclif/core";
import { spawnSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import db from "@saltcorn/data/db/index";

export default class BuildAppCommand extends Command {
  static description = "build mobile app from tenant";

  static flags = {
    platforms: Flags.string({
      name: "platforms",
      char: "p",
      description: "Platforms to build for space separated list",
      multiple: true,
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

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    this.copyPublics();
    this.copyPluginSources();
    this.bundlePackages();
    this.copyBundlesToApp();
    this.copySqliteDbToApp();
    if (flags.platforms) {
      this.validatePlatforms(flags.platforms);
      this.addPlatforms(flags.platforms);
    }
    this.buildApk();
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
  bundlePackages = () => {
    spawnSync("npm", ["run", "build"], {
      stdio: "inherit",
      cwd: this.packageRoot,
    });
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
  copySqliteDbToApp = () => {
    copyFileSync(db.connectObj.sqlite_path, join(this.wwwDir, "scdb.sqlite"));
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
