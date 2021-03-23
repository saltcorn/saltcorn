const { Command, flags } = require("@oclif/command");
const {
  configFilePath,
  getConnectObject,
} = require("@saltcorn/data/db/connect");

const print_it = (results, json) => {
  if (json) console.log(results);
  else
    Object.entries(results).forEach(([k, v]) => {
      console.log(`${k}: ${v}`);
    });
};

class InfoCommand extends Command {
  static aliases = ["paths"];
  async run() {
    const { flags } = this.parse(InfoCommand);

    const conn = getConnectObject();
    const res = { configFilePath, fileStore: conn.file_store };
    print_it(res, flags.json);
    this.exit(0);
  }
}

InfoCommand.description = `Show paths
...
Show configuration and file store paths
`;

InfoCommand.flags = {
  json: flags.boolean({ char: "j", description: "json format" }),
};
module.exports = InfoCommand;
