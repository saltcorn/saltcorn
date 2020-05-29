const { Command, flags } = require("@oclif/command");
const fixtures = require("@saltcorn/server/fixtures");
const reset = require("@saltcorn/data/db/reset_schema");
const { auto_test_plugin } = require("@saltcorn/data/plugin-testing");
const db = require("@saltcorn/data/db");
const { requirePlugin } = require("@saltcorn/server/load_plugins");

const lastPath = ps =>
  ps[ps.length - 1] === "" ? ps[ps.length - 2] : ps[ps.length - 1];

class TestPluginCommand extends Command {
  async run() {
    const { args } = this.parse(TestPluginCommand);
    await db.changeConnection({ database: "saltcorn_test" });
    await reset();
    await fixtures();
    if (args.path[0] === "." || args.path[0] === "/") {
      const segments = args.path.split("/");
      const moduleName = lastPath(segments);
      const { plugin_module } = await requirePlugin({
        source: "local",
        location: args.path,
        name: moduleName
      });
      await auto_test_plugin(plugin_module);
    } else {
      console.error("unknown plugin type");
      this.exit(1);
    }

    this.exit(0);
  }
}

TestPluginCommand.args = [
  { name: "path", description: "path to plugin package", required: true }
];

TestPluginCommand.description = `Describe the command here
...
Extra documentation goes here
`;

module.exports = TestPluginCommand;
