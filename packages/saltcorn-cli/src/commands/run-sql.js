/**
 * @category saltcorn-cli
 * @module commands/run-sql
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const {
  maybe_as_tenant,
  init_some_tenants,
  readFileSync,
} = require("../common");
const db = require("@saltcorn/data/db");

/**
 * RunSQLCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class RunSQLCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags, args } = this.parse(RunSQLCommand);

    if (!flags.sql && !flags.file) {
      console.log(
        "One of arguments is required: --sql or --file.\nRun with --help to get more info"
      );
      this.exit(1);
    }

    await init_some_tenants(flags.tenant);

    //const { mockReqRes } = require("@saltcorn/data/tests/mocks");

    const that = this;
    await maybe_as_tenant(flags.tenant, async () => {
      const schema = db.getTenantSchema();
      if (flags.tenant)
        if (db.isSQLite) {
          console.warn("SQLite is used as datasource. Tenants are unsupported");
        } else {
          // https://www.commandprompt.com/education/how-do-i-setchange-the-default-schema-in-postgresql/
          // life hack to set default schema for tables in PG
          await db.query("SET SEARCH_PATH='" + schema + "'");
        }

      console.log("current tenant:", schema);
      //if(flags.sql){
      const sql_str = flags.sql ? flags.sql : readFileSync(flags.file);
      // check that file not find (not directly)
      if (sql_str === null) {
        this.exit(1);
      }
      try {
        const query = await db.query(sql_str);

        if (!query) {
          console.error(`Cannot execute Query ${flags.sql}`);
          this.exit(1);
        }
        // print sql statement
        console.log(sql_str);
        console.table(query.rows);
      } catch (e) {
        console.error(e);
      }
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
RunSQLCommand.description = `Run sql expression`;
/**
 * @type {object}
 */
RunSQLCommand.flags = {
  tenant: flags.string({
    name: "tenant",
    char: "t",
    description: "tenant name",
  }),
  sql: flags.string({
    name: "sql",
    char: "s",
    description: "sql statement",
  }),
  file: flags.string({
    name: "file",
    char: "f",
    description: "path to sql file name",
  }),
};

module.exports = RunSQLCommand;
