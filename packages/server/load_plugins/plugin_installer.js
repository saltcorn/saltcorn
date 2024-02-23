const { join } = require("path");
const { writeFile, mkdir, rm, pathExists, copy } = require("fs-extra");
const { spawn } = require("child_process");
const {
  downloadTarball,
  gitPullOrClone,
  extractTarball,
  latestVersion,
} = require("./code_load_utils");

const projectRoot = join(__dirname, "..", "..", ".."); // TODO only tested in dev mode
const staticDeps = ["@saltcorn/markup", "@saltcorn/data"];
const fixedPlugins = ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"];

class PluginInstaller {
  constructor(plugin) {
    this.plugin = plugin;
    const tokens =
      plugin.source === "npm"
        ? plugin.location.split("/")
        : plugin.name.split("/");
    this.pluginDir = join(projectRoot, "plugins_folder", ...tokens);
    this.name = tokens[tokens.length - 1];
  }

  async install(force) {
    if (fixedPlugins.includes(this.plugin.location))
      return { plugin_module: require(this.plugin.location) };
    else {
      if (force || !(await this.isInstalled())) {
        await this.prepPluginDir();
        await this.removeStaticDeps();
        await this.npmInstall();
      }
      return {
        plugin_module: await this.loadMainFile(),
        location: this.pluginDir,
        name: this.name,
      };
    }
  }

  async isInstalled() {
    if (this.plugin.source === "npm") {
      const pckJsonPath = join(this.pluginDir, "package.json");
      if (!(await pathExists(pckJsonPath))) return false;
      else {
        const vToInstall = this.plugin.version;
        const vInstalled = require(pckJsonPath).version;
        if (vToInstall === vInstalled) return true;
        else if (vToInstall === "latest") {
          const latest = await latestVersion(this.plugin);
          return latest === vInstalled;
        } else return false;
      }
    } else if (this.plugin.source === "local") {
      return await pathExists(this.pluginDir);
    }
    return false;
  }

  async remove() {
    if (await pathExists(this.pluginDir))
      await rm(this.pluginDir, { recursive: true });
  }

  async loadMainFile() {
    const pckJson = require(join(this.pluginDir, "package.json"));
    const res = await import(join(this.pluginDir, pckJson.main));
    return res.default;
  }

  async prepPluginDir() {
    if (!(await pathExists(this.pluginDir)))
      await mkdir(this.pluginDir, { recursive: true });
    switch (this.plugin.source) {
      case "npm":
        const tarFile = await downloadTarball(this.plugin);
        await extractTarball(tarFile, this.pluginDir);
        await rm(tarFile);
        break;
      case "local":
        await copy(this.plugin.location, this.pluginDir);
        break;
      // case "git":
      // case "github":
      //   await gitPullOrClone(this.plugin);
      //   break;
      default:
        throw new Error("Not yet implemented");
    }
  }

  async removeStaticDeps() {
    const pckJsonPath = join(this.pluginDir, "package.json");
    const pckJson = require(pckJsonPath);
    const oldDepsLength = Object.keys(pckJson.dependencies).length;
    for (const staticDep of staticDeps)
      if (pckJson.dependencies[staticDep])
        delete pckJson.dependencies[staticDep];
    if (Object.keys(pckJson.dependencies).length !== oldDepsLength)
      await writeFile(pckJsonPath, JSON.stringify(pckJson, null, 2));
  }

  async npmInstall() {
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

module.exports = PluginInstaller;
