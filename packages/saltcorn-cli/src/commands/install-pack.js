const { Command, flags } = require("@oclif/command");
const { maybe_as_tenant } = require("../common");
const fs = require("fs");

class InstallPackCommand extends Command {
  async run() {
    const { flags } = this.parse(InstallPackCommand);
    const {
      fetch_pack_by_name,
      install_pack,
    } = require("@saltcorn/data/models/pack");
    const load_plugins = require("@saltcorn/server/load_plugins");

    if (!flags.name && !flags.file) {
      console.error(
        "You must provide either a pack name (-n) or a file with the pack definition (-f)"
      );
      this.exit(1);
    }
    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");
    await loadAllPlugins();
    await init_multi_tenant(loadAllPlugins);

    await maybe_as_tenant(flags.tenant, async () => {
      if (flags.name) {
        const pack = await fetch_pack_by_name(flags.name);
        if (!pack) {
          console.error(`Pack ${flags.name} not found in store`);
          this.exit(1);
        }
        await install_pack(pack.pack, flags.name, (p) =>
          load_plugins.loadAndSaveNewPlugin(p)
        );
      } else if (flags.file) {
        let pack;
        try {
          pack = JSON.parse(fs.readFileSync(flags.file));
        } catch (e) {
          console.error(e.message);
          this.exit(1);
        }
        await install_pack(pack, undefined, (p) =>
          load_plugins.loadAndSaveNewPlugin(p)
        );
      }
    });
    this.exit(0);
  }
}

InstallPackCommand.description = `Install a pack`;

InstallPackCommand.flags = {
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
  name: flags.string({
    char: "n",
    description: "Pack name in store",
  }),
  file: flags.string({
    char: "f",
    description: "File with pack JSON",
  }),
};

module.exports = InstallPackCommand;
