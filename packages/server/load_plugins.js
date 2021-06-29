const db = require("@saltcorn/data/db");
const { PluginManager } = require("live-plugin-manager");
const { getState } = require("@saltcorn/data/db/state");
const Plugin = require("@saltcorn/data/models/plugin");
const fs = require("fs");
const proc = require("child_process");
const tmp = require("tmp-promise");

const manager = new PluginManager({
  staticDependencies: {
    contractis: require("contractis"),
    "@saltcorn/markup": require("@saltcorn/markup"),
    "@saltcorn/markup/tags": require("@saltcorn/markup/tags"),
    "@saltcorn/markup/layout": require("@saltcorn/markup/layout"),
    "@saltcorn/markup/helpers": require("@saltcorn/markup/helpers"),
    "@saltcorn/markup/layout_utils": require("@saltcorn/markup/layout_utils"),
    "@saltcorn/data": require("@saltcorn/data"),
    "@saltcorn/data/db": require("@saltcorn/data/db"),
    "@saltcorn/data/utils": require("@saltcorn/data/utils"),
    "@saltcorn/data/db/state": require("@saltcorn/data/db/state"),
    "@saltcorn/data/plugin-helper": require("@saltcorn/data/plugin-helper"),
    "@saltcorn/data/plugin-testing": require("@saltcorn/data/plugin-testing"),
    "@saltcorn/data/models/field": require("@saltcorn/data/models/field"),
    "@saltcorn/data/models/fieldrepeat": require("@saltcorn/data/models/fieldrepeat"),
    "@saltcorn/data/models/table": require("@saltcorn/data/models/table"),
    "@saltcorn/data/models/form": require("@saltcorn/data/models/form"),
    "@saltcorn/data/models/view": require("@saltcorn/data/models/view"),
    "@saltcorn/data/models/page": require("@saltcorn/data/models/page"),
    "@saltcorn/data/models/file": require("@saltcorn/data/models/file"),
    "@saltcorn/data/models/user": require("@saltcorn/data/models/user"),
    "@saltcorn/data/models/layout": require("@saltcorn/data/models/layout"),
    "@saltcorn/data/models/expression": require("@saltcorn/data/models/expression"),
    "@saltcorn/data/models/workflow": require("@saltcorn/data/models/workflow"),
  },
});

const loadPlugin = async (plugin, force) => {
  const res = await requirePlugin(plugin, force);
  getState().registerPlugin(
    plugin.name,
    res.plugin_module,
    plugin.configuration,
    res.location
  );
  if (res.plugin_module.onLoad) {
    try {
      await res.plugin_module.onLoad(plugin.configuration);
    } catch (error) {
      console.error(error);
    }
  }
  return res;
};

const gitPullOrClone = async (plugin) => {
  await fs.promises.mkdir("git_plugins", { recursive: true });
  let keyfnm,
    setKey = `-c core.sshCommand="ssh -oBatchMode=yes -o 'StrictHostKeyChecking no'" `;
  if (plugin.deploy_private_key) {
    keyfnm = await tmp.tmpName();
    await fs.promises.writeFile(
      keyfnm,
      plugin.deploy_private_key.replace(/[\r]+/g, "") + "\n",
      {
        mode: 0o600,
        encoding: "ascii",
      }
    );
    setKey = `-c core.sshCommand="ssh -oBatchMode=yes -o 'StrictHostKeyChecking no' -i ${keyfnm}" `;
  }
  const dir = `git_plugins/${plugin.name}`;
  if (fs.existsSync(dir)) {
    proc.execSync(`git ${setKey} -C ${dir} pull`);
  } else {
    proc.execSync(`git ${setKey} clone ${plugin.location} ${dir}`);
  }
  if (plugin.deploy_private_key) await fs.promises.unlink(keyfnm);
  return dir;
};

const requirePlugin = async (plugin, force) => {
  const installed_plugins = (await manager.list()).map((p) => p.name);
  if (
    ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"].includes(plugin.location)
  ) {
    return { plugin_module: require(plugin.location) };
  } else if (plugin.source === "npm") {
    if (force || !installed_plugins.includes(plugin.location)) {
      const plinfo = await manager.install(plugin.location, plugin.version);
      return { plugin_module: manager.require(plugin.location), ...plinfo };
    } else {
      const plinfo = manager.getInfo(plugin.location);
      return { plugin_module: manager.require(plugin.location), ...plinfo };
    }
  } else if (plugin.source === "local") {
    const plinfo = await manager.installFromPath(plugin.location, {
      force: true,
    });
    return { plugin_module: manager.require(plugin.name), ...plinfo };
  } else if (plugin.source === "git") {
    const loc = await gitPullOrClone(plugin);
    const plinfo = await manager.installFromPath(loc, {
      force: true,
    });
    return { plugin_module: manager.require(plugin.name), ...plinfo };
  } else if (plugin.source === "github") {
    if (force || !installed_plugins.includes(plugin.location)) {
      const plinfo = await manager.installFromGithub(plugin.location, {
        force: true,
      });
      return { plugin_module: manager.require(plugin.name), ...plinfo };
    } else {
      const plinfo = manager.getInfo(plugin.location);
      return { plugin_module: manager.require(plugin.location), ...plinfo };
    }
  }
};

const loadAllPlugins = async () => {
  await getState().refresh();
  const plugins = await db.select("_sc_plugins");
  for (const plugin of plugins) {
    try {
      const res = await loadPlugin(plugin);
    } catch (e) {
      console.error(e);
    }
  }
  await getState().refresh();
};

const loadAndSaveNewPlugin = async (plugin, force) => {
  const { version, plugin_module, location } = await requirePlugin(
    plugin,
    force
  );
  for (const loc of plugin_module.dependencies || []) {
    const existing = await Plugin.findOne({ location: loc });
    if (!existing && loc !== plugin.location) {
      await loadAndSaveNewPlugin(
        new Plugin({ name: loc, location: loc, source: "npm" })
      );
    }
  }
  getState().registerPlugin(plugin.name, plugin_module, undefined, location);
  if (plugin_module.onLoad) {
    try {
      await plugin_module.onLoad(plugin.configuration);
    } catch (error) {
      console.error(error);
    }
  }
  if (version) plugin.version = version;
  await plugin.upsert();
};

module.exports = {
  loadAndSaveNewPlugin,
  loadAllPlugins,
  loadPlugin,
  requirePlugin,
};
