/**
 * @category saltcorn-cli
 * @module commands/list-tenants
 */
const { Command, flags } = require("@oclif/command");
const db = require("@saltcorn/data/db");


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

    const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
    let tenantList = flags.tenant? [flags.tenant] : await getAllTenants();

    let tenantDetails = new Object();

    let index=0;
    for (const domain of tenantList) {
      index++;
      await db.runWithTenant(domain, async () => {
        if (!flags.verbose)
          tenantDetails[index] = { domain : domain };
        else {
          tenantDetails[index] = {
            domain: domain,
            users: await db.count("users"),
            roles: await db.count("_sc_roles"),
            tables: await db.count("_sc_tables"),
            views: await db.count("_sc_views"),
            pages: await db.count("_sc_pages"),
            files: await db.count("_sc_files"),
            triggers: await db.count("_sc_triggers"),
            tags: await  db.count ("_sc_tags"),
          };
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
        ["domain","users","roles","tables","views","pages", "files","triggers", "tags"]
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
