/**
 * @category saltcorn-cli
 * @module commands/list-tenants
 */
const { Command, Flags } = require("@oclif/core");
const db = require("@saltcorn/data/db");
const { print_table } = require("../common");

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
    const { flags, args } = await this.parse(ListTenantsCommand);

    const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
    let tenantList = flags.tenant ? [flags.tenant] : await getAllTenants();

    let tenantDetails = new Object();

    let index = 0;
    for (const domain of tenantList) {
      index++;
      await db.runWithTenant(domain, async () => {
        if (!flags.verbose) tenantDetails[index] = { domain: domain };
        else
          tenantDetails[index] = {
            domain: domain,
            users: await db.count("users"),
            roles: await db.count("_sc_roles"),
            tables: await db.count("_sc_tables"),
            views: await db.count("_sc_views"),
            pages: await db.count("_sc_pages"),
            files: await db.count("_sc_files"),
            triggers: await db.count("_sc_triggers"),
            tags: await db.count("_sc_tags"),
          };
      });
    }

    // print
    if (!flags.verbose) print_table(tenantDetails, ["domain"], flags.json);
    else
      print_table(
        tenantDetails,
        [
          "domain",
          "users",
          "roles",
          "tables",
          "views",
          "pages",
          "files",
          "triggers",
          "tags",
        ],
        flags.json
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
  tenant: Flags.string({
    name: "tenant",
    char: "t",
    description: "tenant",
    required: false,
  }),
  verbose: Flags.boolean({
    name: "verbose",
    char: "v",
    description: "verbose output",
    required: false,
  }),
  json: Flags.boolean({ char: "j", description: "json format" }),
};

module.exports = ListTenantsCommand;
