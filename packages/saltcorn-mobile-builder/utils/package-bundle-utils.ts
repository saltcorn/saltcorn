import { join } from "path";
import { existsSync, mkdirSync, copySync, readdirSync, rmSync } from "fs-extra";
import Plugin from "@saltcorn/data/models/plugin";
import { spawnSync } from "child_process";
const { requirePlugin } = require("@saltcorn/server/load_plugins");

/**
 *
 * @param buildDir directory where the app will be build
 * @param plugins saltcorn plugins to install
 */
export async function bundlePackagesAndPlugins(
  buildDir: string,
  plugins: Plugin[]
) {
  const result = spawnSync(
    "npm",
    [
      "run",
      "build",
      "--",
      "--env",
      `plugins=${JSON.stringify(plugins)}`,
      "--env",
      `output=${buildDir}/www/js/`,
    ],
    {
      cwd: join(__dirname, "../../"),
    }
  );
  console.log(result.output.toString());
  rmSync(join(__dirname, "../..", "plugin_packages"), {
    force: true,
    recursive: true,
  });
}

/**
 *
 * @param buildDir directory where the app will be build
 * @param manager live-plugin-manager to load a saltcorn-plugin
 * @param plugins saltcorn plugins
 */
export async function copyPublicDirs(
  buildDir: string,
  manager: any,
  plugins: Plugin[]
) {
  const wwwDir = join(buildDir, "www");
  for (const plugin of plugins) {
    const required = await requirePlugin(plugin, false, manager);
    const srcPublicDir = join(required.location, "public");
    if (existsSync(srcPublicDir)) {
      const dstPublicDir = join(wwwDir, "plugins", "public", plugin.name);
      if (!existsSync(dstPublicDir)) {
        mkdirSync(dstPublicDir, { recursive: true });
      }
      for (const dirEntry of readdirSync(srcPublicDir)) {
        copySync(join(srcPublicDir, dirEntry), join(dstPublicDir, dirEntry));
      }
    }
  }
}

/**
 *
 * @param buildDir directory where the app will be build
 * @param manager live-plugin-manager to load a npm pacakage (change to dependency??)
 */
export async function installNpmPackages(buildDir: string, manager: any) {
  const npmTargetDir = join(buildDir, "www", "npm_packages");
  if (!existsSync(npmTargetDir)) mkdirSync(npmTargetDir, { recursive: true });
  const jwtInfo = await manager.install("jwt-decode", "3.1.2");
  copySync(
    join(jwtInfo.location, "build/jwt-decode.js"),
    join(npmTargetDir, "jwt-decode.js")
  );
  const routerInfo = await manager.install("universal-router", "9.1.0");
  copySync(
    join(routerInfo.location, "universal-router.min.js"),
    join(npmTargetDir, "universal-router.min.js")
  );
  const axiosInfo = await manager.install("axios", "0.27.2");
  copySync(
    join(axiosInfo.location, "dist", "axios.min.js"),
    join(npmTargetDir, "axios.min.js")
  );
}
