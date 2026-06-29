import Plugin from "@saltcorn/data/models/plugin";

/** @deprecated Import directly from @saltcorn/data/models/plugin (Plugin static methods) */
export default {
  loadAndSaveNewPlugin: Plugin.loadAndSaveNewPlugin,
  loadAllPlugins: Plugin.loadAllPlugins,
  loadPlugin: Plugin.loadPlugin,
  requirePlugin: Plugin.requirePlugin,
  getEngineInfos: Plugin.getEngineInfos,
  ensurePluginSupport: Plugin.ensurePluginSupport,
};
