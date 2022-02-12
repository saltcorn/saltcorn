import { Command } from "@oclif/core";
import { spawnSync, execSync } from "child_process";

import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export default class BuildAppCommand extends Command {
  static description = "build mobile app from tenant";

  packageRoot = join(__dirname, "../../");
  saltcornMarkupRoot = join(require.resolve("@saltcorn/markup"), "../../");
  appDir = join(require.resolve("@saltcorn/mobile-app"), "..");
  appBundlesDir = join(
    require.resolve("@saltcorn/mobile-app"),
    "../www/js/bundles"
  );

  bundleSaltcornMarkup = () => {
    spawnSync("npm", ["run", "build"], {
      stdio: "inherit",
      cwd: this.saltcornMarkupRoot,
    });
  };
  copyBundleToApp = () => {
    if (!existsSync(this.appBundlesDir)) mkdirSync(this.appBundlesDir);
    copyFileSync(
      join(this.saltcornMarkupRoot, "bundle", "index.bundle.js"),
      join(this.appBundlesDir, "index.bundle.js")
    );
  };
  addAndroidPlatform = () => {
    spawnSync("npm", ["run", "add-platform"], {
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

  async run() {
    this.bundleSaltcornMarkup();
    this.copyBundleToApp();
    this.addAndroidPlatform();
    this.buildApk();
  }
}
