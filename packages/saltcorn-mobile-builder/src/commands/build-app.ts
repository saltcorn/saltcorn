import { Command, Flags } from "@oclif/core";
import { spawnSync } from "child_process";

import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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
  saltcornMarkupRoot = join(require.resolve("@saltcorn/markup"), "../../");
  appDir = join(require.resolve("@saltcorn/mobile-app"), "..");
  appBundlesDir = join(
    require.resolve("@saltcorn/mobile-app"),
    "../www/js/bundles"
  );

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    this.bundleSaltcornMarkup();
    this.copyBundleToApp();
    if (flags.platforms) {
      this.validatePlatforms(flags.platforms);
      this.addPlatforms(flags.platforms);
    }
    this.buildApk();
  }

  bundleSaltcornMarkup = () => {
    spawnSync("npm", ["run", "build"], {
      stdio: "inherit",
      cwd: this.saltcornMarkupRoot,
    });
  };
  copyBundleToApp = () => {
    if (!existsSync(this.appBundlesDir))
      mkdirSync(this.appBundlesDir, { recursive: true });
    copyFileSync(
      join(this.saltcornMarkupRoot, "bundle", "markup.bundle.js"),
      join(this.appBundlesDir, "markup.bundle.js")
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
