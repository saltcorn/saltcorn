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
const semver = require("semver");
const fs = require("fs");
const { rm } = require("fs").promises;

const rootFolder = process.cwd();
const staticDeps = ["@saltcorn/markup", "@saltcorn/data", "jest"];
const fixedPlugins = ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"];

const isGitCheckout = async () => {
  const gitPath = join(__dirname, "..", "..", "Dockerfile.release");
  return await pathExists(gitPath);
};

class PluginInstaller {
  constructor(plugin) {
    this.plugin = plugin;
    this.pckJson = null;
    this.tarFile = null;
    const tokens =
      plugin.source === "npm"
        ? plugin.location.split("/")
        : plugin.name.split("/");
    this.pluginDir = join(
      rootFolder,
      plugin.source === "git" ? "git_plugins" : "plugins_folder",
      ...tokens
    );
    this.pckJsonPath = join(this.pluginDir, "package.json");
    this.name = tokens[tokens.length - 1];
  }

  async install(force) {
    await this.ensurePluginsRootFolders();
    if (fixedPlugins.includes(this.plugin.location))
      return { plugin_module: require(this.plugin.location) };
    this.pckJson = await this.readPackageJson();
    if (await this.prepPluginsFolder(force)) {
      await this.removeDependencies();
      this.pckJson = await this.readPackageJson();
      await this.npmInstall();
      if (await tarballExists(this.plugin)) await removeTarball(this.plugin);
    }
    return {
      version: this.pckJson.version,
      plugin_module: await this.loadMainFile(),
      location: this.pluginDir,
      name: this.name,
    };
  }

  async prepPluginsFolder(force) {
    let wasLoaded = false;
    switch (this.plugin.source) {
      case "npm":
        if (
          (force && !(await this.versionIsInstalled())) ||
          !(await pathExists(this.pluginDir))
        ) {
          this.tarFile = await downloadFromNpm(
            this.plugin,
            this.pluginDir,
            this.pckJson
          );
          wasLoaded = true;
        }
        break;
      case "github":
        if (force || !(await pathExists(this.pluginDir))) {
          this.tarFile = await downloadFromGithub(this.plugin, this.pluginDir);
          wasLoaded = true;
        }
        break;
      case "local":
        if (force || !(await pathExists(this.pluginDir))) {
          await copy(this.plugin.location, this.pluginDir);
          wasLoaded = true;
        }
        break;
      case "git":
        if (force || !(await pathExists(this.pluginDir))) {
          await gitPullOrClone(this.plugin, this.pluginDir);
          this.pckJsonPath = join(this.pluginDir, "package.json");
          wasLoaded = true;
        }
        break;
    }
    return wasLoaded;
  }

  async ensurePluginsRootFolders() {
    const ensureFn = async (folder) => {
      const pluginsFolder = join(rootFolder, folder);
      if (!(await pathExists(pluginsFolder))) await mkdir(pluginsFolder);
      const symLinkDst = join(pluginsFolder, "node_modules");
      const symLinkSrc = (await isGitCheckout())
        ? join(__dirname, "..", "..", "node_modules")
        : join(dirname(require.resolve("@saltcorn/cli")), "..", "node_modules");
      if (!(await pathExists(symLinkDst)))
        await symlink(symLinkSrc, symLinkDst, "dir");
    };
    for (const folder of ["plugins_folder", "git_plugins"])
      await ensureFn(folder);
  }

  isFixedVersion() {
    return !!this.plugin.version && this.plugin.version !== "latest";
  }

  async versionIsInstalled() {
    if (!this.pckJson || !this.isFixedVersion()) return false;
    else {
      const vInstalled = this.pckJson.version;
      if (vInstalled === this.plugin.version) return true;
      else return false;
    }
  }

  async remove() {
    if (await pathExists(this.pluginDir))
      await rm(this.pluginDir, { recursive: true });
  }

  async loadMainFile() {
    const isWindows = process.platform === "win32";
    if (process.env.NODE_ENV === "test") {
      // in jest, downgrad to require
      return require(normalize(join(this.pluginDir, this.pckJson.main)));
    } else {
      const res = await import(
        `${isWindows ? `file://` : ""}${normalize(
          join(this.pluginDir, this.pckJson.main)
        )}`
      );
      return res.default;
    }
  }

  async removeDependencies() {
    const pckJson = await this.readPackageJson();
    const oldDepsLength = Object.keys(pckJson.dependencies || {}).length;
    const oldDevDepsLength = Object.keys(pckJson.devDependencies || {}).length;

    const satisfiedRemover = (deps) => {
      for (const [name, version] of Object.entries(deps)) {
        try {
          const vInstalled = require(`${name}/package.json`).version;
          if (semver.satisfies(vInstalled, version)) {
            delete deps[name];
          }
        } catch (e) {} // continue, npm installs it
      }
    };
    const staticsRemover = (deps) => {
      for (const staticDep of staticDeps) {
        if (deps[staticDep]) delete deps[staticDep];
      }
    };
    if (pckJson.dependencies) {
      satisfiedRemover(pckJson.dependencies);
      staticsRemover(pckJson.dependencies);
    }
    if (pckJson.devDependencies) {
      satisfiedRemover(pckJson.devDependencies);
      staticsRemover(pckJson.devDependencies);
    }
    if (
      Object.keys(pckJson.dependencies || {}).length !== oldDepsLength ||
      Object.keys(pckJson.devDependencies || {}).length !== oldDevDepsLength
    )
      await writeFile(this.pckJsonPath, JSON.stringify(pckJson, null, 2));
  }

  async npmInstall() {
    if (
      Object.keys(this.pckJson.dependencies || {}).length > 0 ||
      Object.keys(this.pckJson.devDependencies || {}).length > 0
    ) {
      const child = spawn("npm", ["install"], {
        cwd: this.pluginDir,
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

  async readPackageJson() {
    if (await pathExists(this.pckJsonPath)) {
      const str = await fs.promises.readFile(this.pckJsonPath);
      return JSON.parse(str);
    } else {
      return null;
    }
  }
}

module.exports = PluginInstaller;
