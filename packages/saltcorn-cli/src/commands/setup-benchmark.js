const { Command, flags } = require("@oclif/command");
const { maybe_as_tenant } = require("../common");

class SetupBenchmarkCommand extends Command {
  async install_forum_pack() {
    const {
      fetch_pack_by_name,
      install_pack,
    } = require("@saltcorn/data/models/pack");
    const load_plugins = require("@saltcorn/server/load_plugins");
    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");
    await loadAllPlugins();
    await init_multi_tenant(loadAllPlugins);
    const pack = await fetch_pack_by_name("Forum");
    await install_pack(pack.pack, flags.name, (p) =>
      load_plugins.loadAndSaveNewPlugin(p)
    );
  }
  async run() {
    const { args, flags } = this.parse(SetupBenchmarkCommand);
    await maybe_as_tenant(flags.tenant, async () => {
      // install pack
      await this.install_forum_pack();
      // create user if one does not exist
      const User = require("@saltcorn/data/models/user");
      const nusers = await User.count();
      if (nusers === 0) {
        await User.create({
          email: "tomn@hey.com",
          password: User.generate_password(),
          role_id: 1,
          username: "tomn",
        });
      }
      const user = await User.findOne({});
      // insert rows
      const Table = require("@saltcorn/data/models/table");
      const threads = await Table.findOne({ name: "Threads" });
      const replies = await Table.findOne({ name: "Replies" });
      const thread_id = await threads.insertRow({
        title: "How fast is Saltcorn?",
        body: "How fast is it really?",
        posted: new Date(),
        poster: user.id,
        category: "General",
      });
      await replies.insertRow({
        body: "How fast is it really?",
        posted: new Date(),
        poster: user.id,
        thread: thread_id,
      });
      // install page
      const { install_pack } = require("@saltcorn/data/models/pack");
      await install_pack(simple_page_pack, flags.name, () => {});
      // install file
      const { rick_file } = require("@saltcorn/data/tests/mocks");
      await rick_file();

    });
  }
}

SetupBenchmarkCommand.args = [];

SetupBenchmarkCommand.description = `Setup an instance for benchmarking`;

SetupBenchmarkCommand.flags = {
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
};

const simple_page_pack = {
  tables: [],
  views: [],
  plugins: [],
  pages: [
    {
      name: "simplepage",
      title: "A simple page",
      description: "The simplest page ever",
      min_role: 10,
      layout: {
        icon: "",
        type: "blank",
        block: false,
        contents: "Installed by saltcorn setup-benchmark",
        labelFor: "",
        isFormula: {},
        textStyle: "",
      },
      fixed_states: {},
      root_page_for_roles: [],
    },
  ],
};

module.exports = SetupBenchmarkCommand;
