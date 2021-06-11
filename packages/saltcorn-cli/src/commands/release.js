const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");

class ReleaseCommand extends Command {
  async run() {
    const {
      args: { version },
    } = this.parse(ReleaseCommand);
    const pkgDirs = [
      "e2e",
      "saltcorn-builder",
      "saltcorn-data",
      "saltcorn-random-tests",
      "server",
      "saltcorn-base-plugin",
      "saltcorn-cli",
      "saltcorn-markup",
      "saltcorn-sbadmin2",
    ];

    this.exit(0);
  }
}

ReleaseCommand.description = `Release a new saltcorn version`;

ReleaseCommand.args = [
  { name: "version", required: true, description: "New version number" },
];

module.exports = ReleaseCommand;
