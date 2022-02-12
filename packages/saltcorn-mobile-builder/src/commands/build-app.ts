import { Command } from "@oclif/core";
import { spawnSync } from "child_process";

import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";

export default class BuildAppCommand extends Command {
  static description = "build mobile app from tenant";

  packageRoot = join(__dirname, "../../");
  saltcornMarkupRoot = join(require.resolve("@saltcorn/markup"), "../../");
  appBundlesDir = join(this.packageRoot, "src/app/www/js/bundles");

  bundleSaltcornMarkup = () => {
    spawnSync("npm", ["run", "build"], {
      stdio: "inherit",
      cwd: this.saltcornMarkupRoot,
    });
  };
  copyBundleToApp = () => {
    mkdirSync(this.appBundlesDir);
    copyFileSync(
      join(this.saltcornMarkupRoot, "bundle", "index.bundle.js"),
      join(this.appBundlesDir, "index.bundle.js")
    );
  };
  addAndroidPlatform = () => {
    spawnSync("cordova", ["platform", "add", "android"], {
      stdio: "inherit",
      cwd: join(this.packageRoot, "src/app"),
    });
  };
  buildApk = () => {
    spawnSync("cordova", ["build"], {
      stdio: "inherit",
      cwd: join(this.packageRoot, "src/app"),
    });
  };

  async run() {
    this.bundleSaltcornMarkup();
    this.copyBundleToApp();
    this.addAndroidPlatform();
    this.buildApk();
  }
}
