/**
 * @category saltcorn-cli
 * @module commands/install-pack
 */
const { Command, flags } = require("@oclif/command");
const { maybe_as_tenant, init_some_tenants } = require("../common");
const fs = require("fs");

/**
 * TakeSnapshotCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class TakeSnapshotCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags } = this.parse(TakeSnapshotCommand);
    const Snapshot = require("@saltcorn/admin-models/models/snapshot");
    await init_some_tenants(flags.tenant);

    await maybe_as_tenant(flags.tenant, async () => {
      const snps = await Snapshot.latest();
      console.log(JSON.stringify(snps, null, 2));
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
TakeSnapshotCommand.description = `Print a current snapshout to stdout`;

/**
 * @type {object}
 */
TakeSnapshotCommand.flags = {
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = TakeSnapshotCommand;
