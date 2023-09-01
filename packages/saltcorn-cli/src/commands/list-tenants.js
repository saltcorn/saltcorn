/**
 * @category saltcorn-cli
 * @module commands/list-tenants
 */
const { Command, flags } = require("@oclif/command");
const db = require("@saltcorn/data/dist/db");


/**
 * ListTenantsCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ListTenantsCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const {flags, args} = this.parse(ListTenantsCommand);

    const db = require("@saltcorn/data/db");
    console.log(db);

    const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
    let tenantList = flags.tenant? [flags.tenant]:await getAllTenants();

    let tenantDetails = new Object();

    for (const domain of tenantList) {
      await db.runWithTenant(domain, async () => {
        if (!flags.verbose)
          tenantDetails[domain] = [domain];
        else {
          tenantDetails[domain] =
            [domain,
              await db.count("_sc_files"),
              await db.count("users"),
              await db.count("_sc_tables"),
              await db.count("_sc_views"),
              await db.count("_sc_pages")
            ];
        };
      });
    };

    // print
    if(!flags.verbose)
      console.table(
        tenantDetails,
        ["domain"]
      );
    else
      console.table(
        tenantDetails,
        ["domain","files","users","tables","views","pages"]
      );


    this.exit(0);
  }
}

/**
 * @type {string}
 */
ListTenantsCommand.description = `List tenants in CSV format`;

// TODO Extra help here
/**
 * @type {string}
 */
ListTenantsCommand.help = "Extra help here";


/**
 * @type {object}
 */
ListTenantsCommand.flags = {
  tenant: flags.string({
    name: "tenant",
    char: "t",
    description: "tenant",
    required: false,
  }),
  verbose: flags.boolean({
    name: "verbose",
    char: "v",
    description: "verbose output",
    required: false,
  }),
};

module.exports = ListTenantsCommand;
