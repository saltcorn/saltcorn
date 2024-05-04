const { join, normalize, dirname } = require("path");
const { writeFile, mkdir, pathExists, copy, symlink } = require("fs-extra");
const { spawn } = require("child_process");
const {
  downloadFromNpm,
  downloadFromGithub,
  gitPullOrClone,
  tarballExists,
  removeTarball,
} = require("./download_utils");
const { getState } = require("@saltcorn/data/db/state");
const { rm, rename, cp, readFile } = require("fs").promises;
const envPaths = require("env-paths");

const staticDeps = ["@saltcorn/markup", "@saltcorn/data", "jest"];
const fixedPlugins = ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"];

const isGitCheckout = async () => {
  const gitPath = join(__dirname, "..", "..", "Dockerfile.release");
  return await pathExists(gitPath);
};

const readPackageJson = async (filePath) => {
  if (await pathExists(filePath)) return JSON.parse(await readFile(filePath));
  else return null;
};

const npmInstallNeeded = (oldPckJSON, newPckJSON) => {
  const oldDeps = oldPckJSON.dependencies || {};
  const oldDevDeps = oldPckJSON.devDependencies || {};
  const newDeps = newPckJSON.dependencies || {};
  const newDevDeps = newPckJSON.devDependencies || {};
  return (
    JSON.stringify(oldDeps) !== JSON.stringify(newDeps) ||
    JSON.stringify(oldDevDeps) !== JSON.stringify(newDevDeps)
  );
};

class PluginInstaller {
  constructor(plugin, opts = {}) {
    this.plugin = plugin;
    this.rootFolder = opts.rootFolder || process.cwd();
    this.tempRootFolder =
      opts.tempRootFolder || envPaths("saltcorn", { suffix: "tmp" }).temp;
    const tokens =
      plugin.source === "npm"
        ? plugin.location.split("/")
        : plugin.name.split("/");
    this.name = tokens[tokens.length - 1];
    this.pluginDir = join(
      this.rootFolder,
      plugin.source === "git" ? "git_plugins" : "plugins_folder",
      ...tokens
    );
    this.pckJsonPath = join(this.pluginDir, "package.json");
    this.tempDir = join(this.tempRootFolder, "temp_install", ...tokens);
    this.tempPckJsonPath = join(this.tempDir, "package.json");
  }

  async install(force) {
    await this.ensurePluginsRootFolders();
    if (fixedPlugins.includes(this.plugin.location))
      return { plugin_module: require(this.plugin.location) };

    let pckJSON = await readPackageJson(this.pckJsonPath);
    const installer = async () => {
      if (await this.prepPluginsFolder(force, pckJSON)) {
        const tmpPckJSON = await this.removeDependencies(
          await readPackageJson(this.tempPckJsonPath),
          true
        );
        if (
          !pckJSON ||
          npmInstallNeeded(await this.removeDependencies(pckJSON), tmpPckJSON)
        )
          await this.npmInstall(tmpPckJSON);
        await this.movePlugin();
        if (await tarballExists(this.plugin)) await removeTarball(this.plugin);
      }
      pckJSON = await readPackageJson(this.pckJsonPath);
    };
    await installer();
    let module = null;
    let loadedWithReload = false;
    try {
      // try importing it and if it fails, remove and try again
      // could happen when there is a directory with a valid package.json
      // but without a valid node modules folder
      module = await this.loadMainFile(pckJSON);
    } catch (e) {
      getState().log(
        2,
        `Error loading plugin ${this.plugin.name}. Removing and trying again.`
      );
      if (force) {
        await this.remove();
        pckJSON = null;
        await installer();
      }
      module = await this.loadMainFile(pckJSON, true);
      loadedWithReload = true;
    }
    return {
      version: pckJSON.version,
      plugin_module: module,
      location: this.pluginDir,
      name: this.plugin.name,
      loadedWithReload,
    };
  }

  async remove() {
    if (await pathExists(this.pluginDir))
      await rm(this.pluginDir, { recursive: true });
  }

  async prepPluginsFolder(force, pckJSON) {
    let wasLoaded = false;
    const folderExists = await pathExists(this.pluginDir);
    switch (this.plugin.source) {
      case "npm":
        if (
          (force && !(await this.versionIsInstalled(pckJSON))) ||
          !folderExists
        ) {
          wasLoaded = await downloadFromNpm(this.plugin, this.tempDir, pckJSON);
        }
        break;
      case "github":
        if (force || !folderExists) {
          await downloadFromGithub(this.plugin, this.tempDir);
          wasLoaded = true;
        }
        break;
      case "local":
        if (force || !folderExists) {
          await copy(this.plugin.location, this.tempDir);
          wasLoaded = true;
        }
        break;
      case "git":
        if (force || !folderExists) {
          await gitPullOrClone(this.plugin, this.tempDir);
          this.pckJsonPath = join(this.pluginDir, "package.json");
          wasLoaded = true;
        }
        break;
    }
    return wasLoaded;
  }

  async ensurePluginsRootFolders() {
    const isWindows = process.platform === "win32";
    const ensureFn = async (folder) => {
      const pluginsFolder = join(this.rootFolder, folder);
      if (!(await pathExists(pluginsFolder))) await mkdir(pluginsFolder);
      const symLinkDst = join(pluginsFolder, "node_modules");
      const symLinkSrc = (await isGitCheckout())
        ? join(__dirname, "..", "..", "node_modules")
        : join(dirname(require.resolve("@saltcorn/cli")), "..", "node_modules");
      if (!(await pathExists(symLinkDst)))
        await symlink(symLinkSrc, symLinkDst, !isWindows ? "dir" : "junction");
    };
    for (const folder of ["plugins_folder", "git_plugins"])
      await ensureFn(folder);
  }

  isFixedVersion() {
    return !!this.plugin.version && this.plugin.version !== "latest";
  }

  async versionIsInstalled(pckJSON) {
    if (!pckJSON || !this.isFixedVersion()) return false;
    else {
      const vInstalled = pckJSON.version;
      if (vInstalled === this.plugin.version) return true;
      else return false;
    }
  }

  async loadMainFile(pckJSON, reload) {
    const isWindows = process.platform === "win32";
    if (process.env.NODE_ENV === "test") {
      // in jest, downgrad to require
      return require(normalize(join(this.pluginDir, pckJSON.main)));
    } else {
      const res = await import(
        `${isWindows ? `file://` : ""}${normalize(
          join(this.pluginDir, pckJSON.main + (reload ? "?reload=true" : ""))
        )}`
      );
      return res.default;
    }
  }

  async removeDependencies(tmpPckJSON, writeToDisk) {
    const pckJSON = { ...tmpPckJSON };
    const oldDepsLength = Object.keys(pckJSON.dependencies || {}).length;
    const oldDevDepsLength = Object.keys(pckJSON.devDependencies || {}).length;
    const staticsRemover = (deps) => {
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

  async npmInstall(pckJSON) {
    getState().log(5, `NPM install plugin: ${pckJSON.name}`);
    const isWindows = process.platform === "win32";
    if (
      Object.keys(pckJSON.dependencies || {}).length > 0 ||
      Object.keys(pckJSON.devDependencies || {}).length > 0
    ) {
      const child = spawn("npm", ["install"], {
        cwd: this.tempDir,
        ...(isWindows ? { shell: true } : {}),
      });
      return new Promise((resolve, reject) => {
        child.on("exit", (exitCode, signal) => {
          resolve({ success: exitCode === 0 });
        });

        child.on("error", (msg) => {
          reject(msg);
        });
      });
    }
  }

  async movePlugin() {
    await copy(this.tempDir, this.pluginDir, { overwrite: true });
    try {
      await rm(this.tempDir, { recursive: true });
    } catch (error) {
      getState().log(2, `Error removing temp folder ${this.tempDir}`);
    }
  }
}

module.exports = PluginInstaller;
