import { dirname, basename, join, sep } from "path";
import { existsSync, mkdirSync, copySync, readdirSync, rmSync } from "fs-extra";
import Plugin from "@saltcorn/data/models/plugin";
import { spawnSync } from "child_process";
const { getState, features } = require("@saltcorn/data/db/state");

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
  return result.status;
}

async function copyHeaderToApp(
  pluginLocation: string,
  header: string,
  wwwDir: string
) {
  const pathArr = header.split(sep);
  if (pathArr.length > 4) {
    const pluginSubDir = pathArr.slice(4, pathArr.length - 1).join(sep);
    const dstPublicDir = join(wwwDir, dirname(header));
    if (!existsSync(dstPublicDir)) {
      mkdirSync(dstPublicDir, { recursive: true });
    }
    const headerFile = basename(header);
    copySync(
      join(pluginLocation, "public", pluginSubDir, headerFile),
      join(dstPublicDir, headerFile)
    );
  } else {
    console.log(`skipping header '${header}'`);
  }
}

function copyAllThemeFiles(location: string, dstPublicDir: string) {
  const srcPublicDir = join(location, "public");
  if (existsSync(srcPublicDir)) {
    if (!existsSync(dstPublicDir)) {
      mkdirSync(dstPublicDir, { recursive: true });
    }
    for (const dirEntry of readdirSync(srcPublicDir)) {
      copySync(join(srcPublicDir, dirEntry), join(dstPublicDir, dirEntry));
    }
  }
}

function hasTheme(plugin: any) {
  return plugin.layout;
}

/**
 * Copy files from the plugin 'public' directories that are needed as headers into the app.
 * For themes, everything from 'public' will be copied.
 * @param buildDir directory where the app will be build
 */
export async function copyPublicDirs(buildDir: string) {
  const state = getState();
  const wwwDir = join(buildDir, "www");
  for (const [k, v] of <[string, any]>Object.entries(state.plugins)) {
    const location = state.plugin_locations[k];
    if (location) {
      for (const { script, css } of state.headers[k] || []) {
        if (script) copyHeaderToApp(location, script, wwwDir);
        if (css) copyHeaderToApp(location, css, wwwDir);
      }
      if (hasTheme(v) && k !== "sbadmin2")
        copyAllThemeFiles(location, join(wwwDir, "plugins", "public", k));
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
  const i18nNextInfo = await manager.install("i18next", "21.8.16");
  copySync(
    join(i18nNextInfo.location, "i18next.min.js"),
    join(npmTargetDir, "i18next.min.js")
  );
  const postProcInfo = await manager.install(
    "i18next-sprintf-postprocessor",
    "0.2.2"
  );
  copySync(
    join(postProcInfo.location, "i18nextSprintfPostProcessor.min.js"),
    join(npmTargetDir, "i18nextSprintfPostProcessor.min.js")
  );
}
