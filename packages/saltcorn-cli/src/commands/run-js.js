/**
 * @category saltcorn-cli
 * @module commands/run-js
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const {
  maybe_as_tenant,
  init_some_tenants,
  readFileSync,
} = require("../common");
const vm = require("vm");
const db = require("@saltcorn/data/db");
const Table = require("@saltcorn/data/models/table");
const { getState, features } = require("@saltcorn/data/db/state");

/**
 * RunTriggerCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class RunJSCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags, args } = this.parse(RunJSCommand);
    await init_some_tenants(flags.tenant);

    const that = this;
    await maybe_as_tenant(flags.tenant, async () => {
      const code = flags.code ? flags.code : readFileSync(flags.file);
      // run script as here https://github.com/saltcorn/js-code-view/blob/main/js-code-view.js
      const f = vm.runInNewContext(`async () => {${code}\n}`, {
        Table,
        // user,
        console,
        // Actions,
        // emitEvent,
        // markupTags,
        db,
        // req: extraArgs.req,
        //  state,
        ...getState().eval_context,
      });
      return await f();
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
RunJSCommand.description = `Run javascript code`;

/**
 * @type {object}
 */
RunJSCommand.flags = {
  tenant: flags.string({
    name: "tenant",
    char: "t",
    description: "tenant name",
  }),
  code: flags.string({
    name: "code",
    char: "c",
    description: "js code",
  }),
  file: flags.string({
    name: "file",
    char: "f",
    description: "path to script file",
  }),
};

module.exports = RunJSCommand;
