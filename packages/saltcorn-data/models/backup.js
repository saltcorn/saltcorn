const { contract, is } = require("contractis");
const { getState } = require("../db/state");
const Table = require("./table");
const View = require("./view");
const Field = require("./field");
const Plugin = require("./plugin");
const Page = require("./page");
const { is_pack, is_plugin } = require("../contracts");

const install_pack = contract(
    is.fun([is_pack, is.maybe(is.str), is.fun(is_plugin, is.undefined)], is.promise(is.undefined)),
    async (pack, name, loadAndSaveNewPlugin) => {
      const existingPlugins = await Plugin.find({});
      for (const plugin of pack.plugins) {
        if (!existingPlugins.some(ep => ep.name === plugin.name)) {
          const p = new Plugin(plugin);
          await loadAndSaveNewPlugin(p);
        }
      }
      for (const tableSpec of pack.tables) {
        await Table.create(tableSpec.name, tableSpec);
      }
      for (const tableSpec of pack.tables) {
        const table = await Table.findOne({ name: tableSpec.name });
        for (const field of tableSpec.fields)
          await Field.create({ table, ...field });
      }
      for (const viewSpec of pack.views) {
        const { table, on_menu, ...viewNoTable } = viewSpec;
        const vtable = await Table.findOne({ name: table });
        await View.create({ ...viewNoTable, table_id: vtable.id });
      }
      for (const pageSpec of pack.pages || []) {
        await Page.create(pageSpec);
      }
      if (name) {
        const existPacks = getState().getConfig("installed_packs", []);
        await getState().setConfig("installed_packs", [...existPacks, name]);
      }
    }
  );
  
  module.exports={install_pack}