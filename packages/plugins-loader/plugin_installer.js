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
const { rm, rename, cp, readFile, readdir } = require("fs").promises;
const envPaths = require("env-paths");
const semver = require("semver");
const path = require("path");

const staticDeps = [
  "@saltcorn/markup",
  "@saltcorn/data",
  "@saltcorn/postgres",
  "jest",
];
const fixedPlugins = ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"];

const isGitCheckout = async () => {
  const gitPath = join(__dirname, "..", "..", "Dockerfile.release");
  return await pathExists(gitPath);
};

const readPackageJson = async (filePath) => {
  if (await pathExists(filePath)) return JSON.parse(await readFile(filePath));
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
const npmInstallNeeded = (oldPckJSON, newPckJSON) => {
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

/**
 * PluginInstaller class
 */
class PluginInstaller {
  constructor(plugin, opts = Object.create(null)) {
    this.plugin = plugin;
    this.rootFolder = opts.rootFolder || defaultRootFolder;
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
      ...tokens,
      plugin.version || "unknownversion"
    );
    this.pckJsonPath = join(this.pluginDir, "package.json");
    this.tempDir = join(this.tempRootFolder, "temp_install", ...tokens);
    this.tempPckJsonPath = join(this.tempDir, "package.json");
    this.scVersion = opts.scVersion;
    this.envVars = opts.envVars || {};
  }

  static async cleanPluginsDirectory(opts = Object.create(null)) {
    const rootFolder = opts.rootFolder || defaultRootFolder;
    await rm(rootFolder, { recursive: true, force: true });
  }

  /**
   *
   * @param {boolean} force
   * @param {boolean} preInstall Only npm install without loading the module
   * @returns
   */
  async install(force = false, preInstall = false) {
    getState().log(5, `loading plugin ${this.plugin.name}`);
    await this._ensurePluginsRootFolders();
    if (fixedPlugins.includes(this.plugin.location))
      return {
        location: path.join(require.resolve(this.plugin.location), ".."),
        plugin_module: require(this.plugin.location),
      };
    const msgs = [];
    let module = null;
    let loadedWithReload = false;
    let pckJSON = await this._installHelper(force, msgs);
    if (!preInstall) {
      try {
        module = await this._loadMainFile(pckJSON);
      } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") await this._dumpNodeMoules();
        if (force) {
          // remove and try again
          // could happen when there is a directory with a package.json
          // but without a valid node modules folder
          getState().log(
            2,
            `Error loading plugin ${this.plugin.name}. Removing and trying again.`
          );
          await this.remove();
          pckJSON = await this._installHelper(force, msgs);
        } else {
          getState().log(
            2,
            `Error loading plugin ${this.plugin.name}. Trying again with reload flag. ` +
              "A server restart may be required."
          );
        }

        module = await this._loadMainFile(pckJSON, true);
        loadedWithReload = true;
      }
    }
    return {
      version: this.plugin.version === "latest" ? "latest" : pckJSON.version,
      plugin_module: module,
      location: this.pluginDir,
      name: this.plugin.name,
      loadedWithReload,
      msgs,
    };
  }

  /**
   * remove plugin directory
   */
  async remove() {
    if (await pathExists(this.pluginDir))
      await rm(this.pluginDir, { recursive: true });
  }

  // -- private methods --

  /**
   * prepare the plugin folder and npm install if needed
   * @param {*} force
   * @param {*} pckJSON
   * @param {*} msgs
   */
  async _installHelper(force, msgs) {
    const airgap = getState().getConfig("airgap", false);
    let pckJSON = await readPackageJson(this.pckJsonPath);
    if (airgap) return pckJSON;
    else if (await this._prepPluginsFolder(force, pckJSON)) {
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
  _checkEngineWarning(pckJSON) {
    const scEngine = pckJSON.engines?.saltcorn;
    if (
      this.scVersion &&
      scEngine &&
      !semver.satisfies(this.scVersion, scEngine)
    ) {
      const warnMsg = `Plugin ${this.plugin.name} requires Saltcorn version ${scEngine} but running ${this.scVersion}`;
      getState().log(4, warnMsg);
      return warnMsg;
    }
    return null;
  }

  /**
   * helper to prepare the plugin folder
   * @param {*} force
   * @param {*} pckJSON
   * @returns
   */
  async _prepPluginsFolder(force, pckJSON) {
    let wasLoaded = false;
    const folderExists = await pathExists(this.pluginDir);
    switch (this.plugin.source) {
      case "npm":
        if (
          (force && !(await this._versionIsInstalled(pckJSON))) ||
          !folderExists
        ) {
          getState().log(6, "downloading from npm");
          wasLoaded = await downloadFromNpm(
            this.plugin,
            this.rootFolder,
            this.tempDir,
            pckJSON
          );
        }
        break;
      case "github":
        if (force || !folderExists) {
          getState().log(6, "downloading from github");
          await downloadFromGithub(this.plugin, this.rootFolder, this.tempDir);
          wasLoaded = true;
        }
        break;
      case "local":
        if (force || !folderExists) {
          getState().log(6, "copying from local");
          await copy(this.plugin.location, this.tempDir);
          // if tempdir has a node_modules folder, remove it
          if (await pathExists(join(this.tempDir, "node_modules")))
            await rm(join(this.tempDir, "node_modules"), { recursive: true });
          wasLoaded = true;
        }
        break;
      case "git":
        if (force || !folderExists) {
          getState().log(6, "downloading from git");
          await gitPullOrClone(this.plugin, this.tempDir);
          this.pckJsonPath = join(this.pluginDir, "package.json");
          wasLoaded = true;
        }
        break;
    }
    return wasLoaded;
  }

  async _ensurePluginsRootFolders() {
    const isWindows = process.platform === "win32";
    const ensureFn = async (folder) => {
      const pluginsFolder = join(this.rootFolder, folder);
      if (!(await pathExists(pluginsFolder)))
        await mkdir(pluginsFolder, { recursive: true });
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

  _isFixedVersion() {
    return !!this.plugin.version && this.plugin.version !== "latest";
  }

  async _versionIsInstalled(pckJSON) {
    if (!pckJSON || !this._isFixedVersion()) return false;
    else {
      const vInstalled = pckJSON.version;
      if (vInstalled === this.plugin.version) return true;
      else return false;
    }
  }

  async _loadMainFile(pckJSON, reload) {
    const isWindows = process.platform === "win32";
    if (process.env.NODE_ENV === "test") {
      // in jest, downgrad to require
      return require(normalize(join(this.pluginDir, pckJSON.main)));
    } else {
      const url = `${isWindows ? `file://` : ""}${normalize(
        join(this.pluginDir, pckJSON.main + (reload ? "?reload=true" : ""))
      )}`;
      const res = await import(url);
      return res.default;
    }
  }

  async _removeDependencies(tmpPckJSON, writeToDisk) {
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

  async _npmInstall(pckJSON) {
    const isWindows = process.platform === "win32";
    if (
      Object.keys(pckJSON.dependencies || {}).length > 0 ||
      Object.keys(pckJSON.devDependencies || {}).length > 0
    ) {
      getState().log(5, `NPM install plugin: ${pckJSON.name}`);
      const child = spawn("npm", ["install"], {
        cwd: this.tempDir,
        env: { ...process.env, ...this.envVars },
        ...(isWindows ? { shell: true } : {}),
      });
      return new Promise((resolve, reject) => {
        if (child.stdout) {
          child.stdout.on("data", (data) => {
            getState().log(6, data.toString());
          });
        }
        if (child.stderr) {
          child.stderr.on("data", (data) => {
            getState().log(6, data.toString());
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

  async _movePlugin(wasInstalled) {
    const isWindows = process.platform === "win32";
    const copyMove = async () => {
      await cp(this.tempDir, this.pluginDir, { recursive: true, force: true });
      try {
        await rm(this.tempDir, { recursive: true });
      } catch (error) {
        getState().log(2, `Error removing temp folder ${this.tempDir}`);
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

  async _dumpNodeMoules() {
    getState().log(5, `corrupt plugin dir: ${this.pluginDir}`);
    const files = await readdir(this.pluginDir);
    getState().log(5, `files in plugin dir: ${JSON.stringify(files)}`);
    if (files.includes("node_modules")) {
      const nodeModuleFiles = await readdir(
        join(this.pluginDir, "node_modules")
      );
      getState().log(
        5,
        `node_modules files: ${JSON.stringify(nodeModuleFiles)}`
      );
    } else getState().log(5, `no node_modules in plugin dir`);
  }
}

module.exports = PluginInstaller;
