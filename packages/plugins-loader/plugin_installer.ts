import { join, normalize, dirname, delimiter } from "path";
import fsExtra from "fs-extra";
import {
  existsSync,
  mkdirSync,
  readlinkSync,
  unlinkSync,
  symlinkSync,
} from "fs";
import Module from "module";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";
import { spawn } from "child_process";
import {
  downloadFromNpm,
  downloadFromGithub,
  gitPullOrClone,
  tarballExists,
  removeTarball,
} from "./download_utils.js";
import type { PluginObj } from "./download_utils.js";
import { getState } from "@saltcorn/data/db/state";
import Plugin from "@saltcorn/data/models/plugin";
import { promises as fsPromises } from "fs";
import envPaths from "env-paths";
import semver from "semver";
import path from "path";
import { PluginLoaderResult } from "@saltcorn/types/base_types";

const { rm, rename, cp, readFile, readdir, readlink, unlink } = fsPromises;
const { writeFile, mkdir, pathExists, copy, symlink } = fsExtra;

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
// the compiled module lives in <package>/dist, so the package root is one
// level up from __dirname; the path math below mirrors the pre-ESM layout
// where this file sat at the package root.
const packageRoot = dirname(dirname(__filename));

const isGitCheckout = () =>
  existsSync(join(packageRoot, "..", "..", "packages"));

const saltcornModules = isGitCheckout()
  ? join(packageRoot, "..", "..", "node_modules")
  : join(packageRoot, "..", "..");
const existing = (process.env.NODE_PATH || "").split(delimiter).filter(Boolean);
if (!existing.includes(saltcornModules)) {
  process.env.NODE_PATH = [...existing, saltcornModules].join(delimiter);
  (Module as any)._initPaths();
}

try {
  const defaultRootFolderInit = envPaths("saltcorn", {
    suffix: "plugins",
  }).data;
  for (const folder of ["plugins_folder", "git_plugins"]) {
    const pluginsFolder = join(defaultRootFolderInit, folder);
    const symDst = join(pluginsFolder, "node_modules");
    try {
      if (!existsSync(pluginsFolder))
        mkdirSync(pluginsFolder, { recursive: true });
      let currentTarget: string | null = null;
      try {
        currentTarget = readlinkSync(symDst);
      } catch {
        /* missing or not a symlink */
      }
      if (currentTarget !== saltcornModules) {
        try {
          unlinkSync(symDst);
        } catch {
          /* already gone */
        }
        symlinkSync(saltcornModules, symDst, "dir");
      }
    } catch {
      /* _ensurePluginsRootFolders() will retry */
    }
  }
} catch {
  /* env-paths unavailable; symlink will be created by install() */
}

/**
 * options for the PluginInstaller constructor
 */
export type InstallerOpts = {
  rootFolder?: string;
  reloadModule?: boolean;
  force?: boolean;
  tempRootFolder?: string;
  scVersion?: string;
  envVars?: Record<string, string>;
};

const staticDeps = [
  "@saltcorn/markup",
  "@saltcorn/data",
  "@saltcorn/admin-models",
  "@saltcorn/postgres",
  "jest",
];

const readPackageJson = async (filePath: string): Promise<any> => {
  if (await pathExists(filePath))
    return JSON.parse(await readFile(filePath, "utf8"));
  else return null;
};

/**
 * install when the new package.json has different dependencies
 * or when the source is local and there are any dependencies
 * @param source
 * @param oldPckJSON
 * @param newPckJSON
 * @returns
 */
const npmInstallNeeded = (oldPckJSON: any, newPckJSON: any): boolean => {
  const oldDeps = oldPckJSON.dependencies || Object.create(null);
  const oldDevDeps = oldPckJSON.devDependencies || Object.create(null);
  const newDeps = newPckJSON.dependencies || Object.create(null);
  const newDevDeps = newPckJSON.devDependencies || Object.create(null);
  return (
    JSON.stringify(oldDeps) !== JSON.stringify(newDeps) ||
    JSON.stringify(oldDevDeps) !== JSON.stringify(newDevDeps)
  );
};

const defaultRootFolder = envPaths("saltcorn", { suffix: "plugins" }).data;

// tracks plugins already installed in this process (master process only)
const installedLocalPlugins = new Set<string>();
const installedGitPlugins = new Set<string>();
const installedGithubPlugins = new Set<string>();

/**
 * Find the most recently created localversion_<timestamp> directory for a local plugin.
 * Falls back to "localversion" if none exist yet.
 */
const findLatestLocalversionDir = (parentDir: string): string => {
  try {
    const dirs = readdirSync(parentDir).filter((e) =>
      /^localversion_\d+$/.test(e)
    );
    if (dirs.length === 0) return "localversion";
    return dirs.reduce((latest, d) => {
      return parseInt(d.split("_")[1]) > parseInt(latest.split("_")[1])
        ? d
        : latest;
    });
  } catch {
    return "localversion";
  }
};

/**
 * PluginInstaller class
 */
class PluginInstaller {
  plugin: PluginObj;
  rootFolder: string;
  reloadModule: boolean;
  force: boolean;
  tempRootFolder: string;
  name: string;
  pluginDir: string;
  pckJsonPath: string;
  tempDir: string;
  tempPckJsonPath: string;
  scVersion?: string;
  envVars: Record<string, string>;

  constructor(plugin: PluginObj, opts: InstallerOpts = Object.create(null)) {
    this.plugin = plugin;
    this.rootFolder = opts.rootFolder || defaultRootFolder;
    this.reloadModule = !!opts.reloadModule;
    this.force = !!opts.force;
    this.tempRootFolder =
      opts.tempRootFolder || envPaths("saltcorn", { suffix: "tmp" }).temp;
    const tokens =
      plugin.source === "npm"
        ? plugin.location.split("/")
        : plugin.name.split("/");
    this.name = tokens[tokens.length - 1];
    const localPluginParentDir = join(
      opts.rootFolder || defaultRootFolder,
      "plugins_folder",
      ...tokens
    );
    const localversionDir =
      opts.reloadModule && plugin.source === "local"
        ? opts.force
          ? `localversion_${Date.now()}`
          : findLatestLocalversionDir(localPluginParentDir)
        : "localversion";
    this.pluginDir = join(
      this.rootFolder,
      plugin.source === "git" ? "git_plugins" : "plugins_folder",
      ...tokens,
      plugin.source === "local"
        ? localversionDir
        : plugin.version || "unknownversion"
    );
    this.pckJsonPath = join(this.pluginDir, "package.json");
    this.tempDir = join(this.tempRootFolder, "temp_install", ...tokens);
    this.tempPckJsonPath = join(this.tempDir, "package.json");
    this.scVersion = opts.scVersion;
    this.envVars = opts.envVars || {};
  }

  static async cleanPluginsDirectory(
    opts: InstallerOpts = Object.create(null)
  ): Promise<void> {
    const rootFolder = opts.rootFolder || defaultRootFolder;
    await rm(rootFolder, { recursive: true, force: true });
  }

  /**
   *
   * @param {boolean} preInstall Only npm install without loading the module
   * @returns
   */
  async install(preInstall = false): Promise<PluginLoaderResult> {
    getState()!.log(5, `loading plugin ${this.plugin.name}`);
    await this._ensurePluginsRootFolders();
    if (Plugin.is_fixed_plugin(this.plugin.location))
      return {
        location: path.join(require.resolve(this.plugin.location), ".."),
        plugin_module: require(this.plugin.location),
        name: this.plugin.name,
        loadedWithReload: false,
        msgs: [],
      };
    const msgs: string[] = [];
    let loadedModule: any = null;
    let loadedWithReload = false;
    let pckJSON = await this._installHelper(msgs);
    if (!preInstall) {
      try {
        loadedModule = await this._loadMainFile(pckJSON);
      } catch (e: any) {
        if (e.code === "MODULE_NOT_FOUND") await this._dumpNodeMoules();
        if (this.force) {
          // remove and try again
          // could happen when there is a directory with a package.json
          // but without a valid node modules folder
          getState()!.log(
            2,
            `Error loading plugin ${this.plugin.name}. Removing and trying again.`
          );
          await this.remove();
          pckJSON = await this._installHelper(msgs);
        } else {
          getState()!.log(
            2,
            `Error loading plugin ${this.plugin.name}. Trying again with reload flag. ` +
              "A server restart may be required."
          );
        }

        loadedModule = await this._loadMainFile(pckJSON, true);
        loadedWithReload = true;
      }
    }
    return {
      version: this.plugin.version === "latest" ? "latest" : pckJSON.version,
      plugin_module: loadedModule,
      location: this.pluginDir,
      name: this.plugin.name,
      loadedWithReload,
      msgs,
    };
  }

  /**
   * remove plugin directory
   */
  async remove(): Promise<void> {
    if (await pathExists(this.pluginDir))
      await rm(this.pluginDir, { recursive: true });
  }

  // -- private methods --

  /**
   * prepare the plugin folder and npm install if needed
   * @param {*} msgs
   */
  async _installHelper(msgs: string[]): Promise<any> {
    const airgap = getState()!.getConfig("airgap", false);
    let pckJSON = await readPackageJson(this.pckJsonPath);
    if (airgap) return pckJSON;
    else if (await this._prepPluginsFolder(pckJSON)) {
      const tmpPckJSON = await this._removeDependencies(
        await readPackageJson(this.tempPckJsonPath),
        true
      );
      let wasInstalled = false;
      if (
        !pckJSON ||
        npmInstallNeeded(await this._removeDependencies(pckJSON), tmpPckJSON)
      ) {
        wasInstalled = true;
        await this._npmInstall(tmpPckJSON);
      }
      await this._movePlugin(wasInstalled);
      if (await tarballExists(this.rootFolder, this.plugin))
        await removeTarball(this.rootFolder, this.plugin);
      pckJSON = await readPackageJson(this.pckJsonPath);
      const msg = this._checkEngineWarning(pckJSON);
      if (msg && !msgs.includes(msg)) msgs.push(msg);
    }
    return pckJSON;
  }

  /**
   * check if the host supports the plugin and return a warning if not
   * @param pckJSON
   * @returns
   */
  _checkEngineWarning(pckJSON: any): string | null {
    const scEngine = pckJSON.engines?.saltcorn;
    if (
      this.scVersion &&
      scEngine &&
      !semver.satisfies(this.scVersion, scEngine)
    ) {
      const warnMsg = `Plugin ${this.plugin.name} requires Saltcorn version ${scEngine} but running ${this.scVersion}`;
      getState()!.log(4, warnMsg);
      return warnMsg;
    }
    return null;
  }

  /**
   * helper to prepare the plugin folder
   * @param {*} pckJSON
   * @returns
   */
  async _prepPluginsFolder(pckJSON: any): Promise<boolean> {
    let wasLoaded = false;
    const folderExists = await pathExists(this.pluginDir);
    switch (this.plugin.source) {
      case "npm":
        if (
          (this.force && !(await this._versionIsInstalled(pckJSON))) ||
          !folderExists
        ) {
          getState()!.log(6, "downloading from npm");
          wasLoaded = await downloadFromNpm(
            this.plugin,
            this.rootFolder,
            this.tempDir,
            pckJSON
          );
        }
        break;
      case "github":
        if (
          (this.force || !folderExists) &&
          (!installedGithubPlugins.has(this.pluginDir) || this.reloadModule)
        ) {
          getState()!.log(6, "downloading from github");
          await downloadFromGithub(this.plugin, this.rootFolder, this.tempDir);
          installedGithubPlugins.add(this.pluginDir);
          wasLoaded = true;
        }
        break;
      case "local":
        if (
          (this.force || !folderExists) &&
          (!installedLocalPlugins.has(this.pluginDir) || this.reloadModule)
        ) {
          getState()!.log(6, "copying from local");
          await copy(this.plugin.location, this.tempDir);
          // if tempdir has a node_modules folder, remove it
          if (await pathExists(join(this.tempDir, "node_modules")))
            await rm(join(this.tempDir, "node_modules"), { recursive: true });
          installedLocalPlugins.add(this.pluginDir);
          wasLoaded = true;
        }
        break;
      case "git":
        if (
          (this.force || !folderExists) &&
          (!installedGitPlugins.has(this.pluginDir) || this.reloadModule)
        ) {
          getState()!.log(6, "downloading from git");
          await gitPullOrClone(this.plugin, this.tempDir);
          this.pckJsonPath = join(this.pluginDir, "package.json");
          installedGitPlugins.add(this.pluginDir);
          wasLoaded = true;
        }
        break;
    }
    return wasLoaded;
  }

  async _ensurePluginsRootFolders(): Promise<void> {
    const isWindows = process.platform === "win32";
    const ensureFn = async (folder: string) => {
      const pluginsFolder = join(this.rootFolder, folder);
      if (!(await pathExists(pluginsFolder)))
        await mkdir(pluginsFolder, { recursive: true });
      const symLinkDst = join(pluginsFolder, "node_modules");
      const symLinkSrc = isGitCheckout()
        ? join(packageRoot, "..", "..", "node_modules")
        : join(dirname(require.resolve("@saltcorn/cli")), "..", "node_modules");
      if (await pathExists(symLinkDst)) {
        const currentTarget = await readlink(symLinkDst).catch(() => null);
        if (currentTarget !== symLinkSrc) {
          await unlink(symLinkDst);
          await symlink(
            symLinkSrc,
            symLinkDst,
            !isWindows ? "dir" : "junction"
          );
        }
      } else {
        await symlink(symLinkSrc, symLinkDst, !isWindows ? "dir" : "junction");
      }
    };
    for (const folder of ["plugins_folder", "git_plugins"])
      await ensureFn(folder);
  }

  _isFixedVersion(): boolean {
    return !!this.plugin.version && this.plugin.version !== "latest";
  }

  async _versionIsInstalled(pckJSON: any): Promise<boolean> {
    if (!pckJSON || !this._isFixedVersion()) return false;
    else {
      const vInstalled = pckJSON.version;
      if (vInstalled === this.plugin.version) return true;
      else return false;
    }
  }

  async _loadMainFile(pckJSON: any, reload?: boolean): Promise<any> {
    const isWindows = process.platform === "win32";
    if (process.env.NODE_ENV === "test") {
      // in jest, downgrad to require
      return require(normalize(join(this.pluginDir, pckJSON.main)));
    } else {
      const url = `${isWindows ? `file://` : ""}${normalize(
        join(this.pluginDir, pckJSON.main)
      )}${reload ? `?reload=${Date.now()}` : ""}`;
      const res = await import(url);
      return res.default;
    }
  }

  async _removeDependencies(
    tmpPckJSON: any,
    writeToDisk?: boolean
  ): Promise<any> {
    const pckJSON = { ...tmpPckJSON };
    const oldDepsLength = Object.keys(pckJSON.dependencies || {}).length;
    const oldDevDepsLength = Object.keys(pckJSON.devDependencies || {}).length;
    const staticsRemover = (deps: Record<string, any>) => {
      for (const staticDep of staticDeps) {
        if (deps[staticDep]) delete deps[staticDep];
      }
    };
    if (pckJSON.dependencies) staticsRemover(pckJSON.dependencies);
    if (pckJSON.devDependencies) staticsRemover(pckJSON.devDependencies);
    if (
      writeToDisk &&
      (Object.keys(pckJSON.dependencies || {}).length !== oldDepsLength ||
        Object.keys(pckJSON.devDependencies || {}).length !== oldDevDepsLength)
    )
      await writeFile(
        join(this.tempDir, "package.json"),
        JSON.stringify(pckJSON, null, 2)
      );
    return pckJSON;
  }

  async _npmInstall(pckJSON: any): Promise<void> {
    const isWindows = process.platform === "win32";
    if (
      Object.keys(pckJSON.dependencies || {}).length > 0 ||
      Object.keys(pckJSON.devDependencies || {}).length > 0
    ) {
      getState()!.log(5, `NPM install plugin: ${pckJSON.name}`);
      const child = spawn("npm", ["install"], {
        cwd: this.tempDir,
        env: { ...process.env, ...this.envVars },
        ...(isWindows ? { shell: true } : {}),
      });
      return new Promise((resolve, reject) => {
        if (child.stdout) {
          child.stdout.on("data", (data) => {
            getState()!.log(6, data.toString());
          });
        }
        if (child.stderr) {
          child.stderr.on("data", (data) => {
            getState()!.log(6, data.toString());
          });
        }
        child.on("exit", (exitCode, signal) => {
          if (exitCode !== 0) {
            reject(
              new Error(
                `NPM install failed for ${pckJSON.name} with exit code ${exitCode}`
              )
            );
          } else resolve();
        });
        child.on("error", (msg) => {
          reject(msg);
        });
      });
    }
  }

  async _movePlugin(wasInstalled: boolean): Promise<void> {
    const isWindows = process.platform === "win32";
    const copyMove = async () => {
      await cp(this.tempDir, this.pluginDir, { recursive: true, force: true });
      try {
        await rm(this.tempDir, { recursive: true });
      } catch (error) {
        getState()!.log(2, `Error removing temp folder ${this.tempDir}`);
      }
    };
    if (this.plugin.source === "npm" || wasInstalled) {
      if (await pathExists(this.pluginDir))
        await rm(this.pluginDir, { recursive: true });
      await mkdir(this.pluginDir, { recursive: true });
      if (!isWindows) {
        try {
          await rename(this.tempDir, this.pluginDir);
        } catch (error) {
          await copyMove();
        }
      } else await copyMove();
    } else await copyMove();
  }

  async _dumpNodeMoules(): Promise<void> {
    getState()!.log(5, `corrupt plugin dir: ${this.pluginDir}`);
    const files = await readdir(this.pluginDir);
    getState()!.log(5, `files in plugin dir: ${JSON.stringify(files)}`);
    if (files.includes("node_modules")) {
      const nodeModuleFiles = await readdir(
        join(this.pluginDir, "node_modules")
      );
      getState()!.log(
        5,
        `node_modules files: ${JSON.stringify(nodeModuleFiles)}`
      );
    } else getState()!.log(5, `no node_modules in plugin dir`);
  }
}

export default PluginInstaller;
