/**
 * @category saltcorn-cli
 * @module commands/list-tenants
 */
const { Command, flags } = require("@oclif/command");


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
    const db = require("@saltcorn/data/db");
    const tenantList = await getAllTenants();

     if(!flags.verbose)
      console.log('name');
    else
      console.log(
          "domain                  ,    files,    users,   tables,    views,    pages"
      );
    console.log('-------------------');

    if(flags.tenant) {
      const domain = flags.tenant;
      await db.runWithTenant(domain, async () => {
        if (!flags.verbose)
          console.log(domain);
        else
          console.log(
              "%s, %s, %s, %s, %s, %s",
              domain.padEnd(24),
              (await db.count("_sc_files")).toString().padStart(8),
              (await db.count("users")).toString().padStart(8),
              (await db.count("_sc_tables")).toString().padStart(8),
              (await db.count("_sc_views")).toString().padStart(8),
              (await db.count("_sc_pages")).toString().padStart(8),
          );
      });
    }
    else
      for (const domain of tenantList)
        await db.runWithTenant(domain, async () => {
          if (!flags.verbose)
            console.log(domain);
          else
            console.log(
                "%s, %s, %s, %s, %s, %s",
                domain.padEnd(24),
                (await db.count("_sc_files")).toString().padStart(8),
                (await db.count("users")).toString().padStart(8),
                (await db.count("_sc_tables")).toString().padStart(8),
                (await db.count("_sc_views")).toString().padStart(8),
                (await db.count("_sc_pages")).toString().padStart(8),
            );
        });


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
