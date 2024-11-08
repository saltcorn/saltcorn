/**
 * @category saltcorn-cli
 * @module commands/set-cfg
 */
const { Command, Flags, Args, ux } = require("@oclif/core");
const {
  maybe_as_tenant,
  init_some_tenants,
  parseJSONorString,
} = require("../common");
const fs = require("fs");
/**
 * SetDailyTimeCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class SetDailyTimeCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { args, flags } = await this.parse(SetDailyTimeCommand);
    if (typeof args.mins === "undefined") {
      console.error("Must supply minutes value");
      this.exit(1);
    }

    const minsDelta = +args.mins;
    const theTime = new Date();
    theTime.setMinutes(theTime.getMinutes() + minsDelta);
    if (flags.tenant) await init_some_tenants(flags.tenant);
    await maybe_as_tenant(flags.tenant, async () => {
      const { getState } = require("@saltcorn/data/db/state");
      const { configTypes } = require("@saltcorn/data/models/config");

      await getState().setConfig("next_daily_event", theTime);
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
SetDailyTimeCommand.description = `Set the time the default daily event will run, offset in minutes from the current time. Restart required.`;

/**
 * @type {object[]}
 */
SetDailyTimeCommand.args = {
  mins: Args.string({
    description: "Number of minutes in the futute (negative for past)",
  }),
};

/**
 * @type {object}
 */
SetDailyTimeCommand.flags = {
  tenant: Flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = SetDailyTimeCommand;
