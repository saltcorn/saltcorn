const { Command } = require("@oclif/command");
const {
  configFilePath,
  getConnectObject
} = require("@saltcorn/data/db/connect");

class PathsCommand extends Command {
  async run() {
    const conn = getConnectObject();
    console.log({ configFilePath, fileStore: conn.file_store });
    this.exit(0);
  }
}

PathsCommand.description = `Show paths
...
Show configuration and file store paths
`;

module.exports = PathsCommand;
