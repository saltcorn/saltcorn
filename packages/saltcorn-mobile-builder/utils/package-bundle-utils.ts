import { dirname, basename, join, sep } from "path";
import { existsSync, mkdirSync, copySync, readdirSync, rmSync } from "fs-extra";
import Plugin from "@saltcorn/data/models/plugin";
import File from "@saltcorn/data/models/file";
import { spawnSync } from "child_process";
const { getState } = require("@saltcorn/data/db/state");

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

export function bundleMobileAppCode(buildDir: string) {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: buildDir,
  });
  console.log(result.output.toString());
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
    try {
      copySync(
        join(pluginLocation, "public", pluginSubDir, headerFile),
        join(dstPublicDir, headerFile)
      );
    } catch (e) {
      console.log(`Error copying header ${header} to ${dstPublicDir}`);
      console.log(e);
    }
  } else {
    console.log(`skipping header '${header}'`);
  }
}

function copyAllPublicFiles(location: string, dstPublicDir: string) {
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

/**
 * Copy files from the plugin 'public' directories that are needed as headers into the app.
 * For themes, everything from 'public' will be copied.
 * @param buildDir directory where the app will be build
 */
export async function copyPublicDirs(buildDir: string) {
  const state = getState();
  const wwwDir = join(buildDir, "www");
  const pluginCfgs = state.plugin_cfgs || {};
  for (const [k, v] of <[string, any]>Object.entries(state.plugins)) {
    const location = state.plugin_locations[k];
    if (location) {
      for (const { script, css } of state.headers[k] || []) {
        if (script) copyHeaderToApp(location, script, wwwDir);
        if (css) copyHeaderToApp(location, css, wwwDir);
      }
      if (k !== "sbadmin2")
        copyAllPublicFiles(location, join(wwwDir, "sc_plugins", "public", k));
    }
    if (pluginCfgs[k] && pluginCfgs[k].alt_css_file) {
      const altCssFile = await File.findOne(pluginCfgs[k].alt_css_file);
      if (altCssFile)
        copySync(
          altCssFile.location,
          join(wwwDir, "sc_plugins", "public", k, pluginCfgs[k].alt_css_file),
          { recursive: true }
        );
    }
  }
}
