/**
 * @category saltcorn-cli
 * @module commands/install-pack
 */
const { Command, Flags } = require("@oclif/core");
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
    const { flags } = await this.parse(TakeSnapshotCommand);
    const Snapshot = require("@saltcorn/admin-models/models/snapshot");
    await init_some_tenants(flags.tenant);

    await maybe_as_tenant(flags.tenant, async () => {
      if (flags.fresh) await Snapshot.take_if_changed();
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
  tenant: Flags.string({
    char: "t",
    description: "tenant",
  }),
  fresh: Flags.boolean({
    char: "f",
    description: "fresh",
  }),
};

module.exports = TakeSnapshotCommand;
