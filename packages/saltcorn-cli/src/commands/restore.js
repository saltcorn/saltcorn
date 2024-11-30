/**
 * @category saltcorn-cli
 * @module commands/restore
 */
const { Command, Flags, Args } = require("@oclif/core");
const { spawnSync } = require("child_process");
const path = require("path");
const { maybe_as_tenant } = require("../common");
const fs = require("fs");

/**
 * RestoreCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class RestoreCommand extends Command {
  /**
   *
   * @param {string} fnm
   * @returns {Promise<void>}
   */
  async pg_restore(fnm) {
    const { getConnectObject } = require("@saltcorn/data/db/connect");
    const connobj = getConnectObject();

    const pgdb = connobj.database;
    const pguser = connobj.user;
    const pghost = connobj.host || "localhost";
    const env = { ...process.env, PGPASSWORD: connobj.password };
    const res = spawnSync(
      "pg_restore",
      ["-d", pgdb, "-U", pguser, "-h", pghost, fnm],
      { stdio: "inherit", env }
    );
    this.exit(res.status);
  }

  /**
   *
   * @param {string} fnm
   * @param {object} tenant
   * @returns {Promise<void>}
   */
  async zip_restore(fnm, tenant) {
    const { restore } = require("@saltcorn/admin-models/models/backup");
    const User = require("@saltcorn/data/models/user");
    const load_plugins = require("@saltcorn/server/load_plugins");
    await maybe_as_tenant(tenant, async () => {
      await load_plugins.loadAllPlugins();
      const hasUsers = await User.nonEmpty();
      const savePlugin = (p) => load_plugins.loadAndSaveNewPlugin(p);
      const err = await restore(fnm, savePlugin, !hasUsers);
      if (err) {
        console.error(err);
        this.exit(1);
      }
    });
  }

  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { args, flags } = await this.parse(RestoreCommand);
    switch (path.extname(args.file)) {
      case ".sqlc":
        if (flags.tenant) {
          console.error("sqlc restore not supported in tenants");
          this.exit(1);
        }
        this.pg_restore(args.file);
        break;
      case ".zip":
        this.zip_restore(args.file, flags.tenant);
        break;
      case ".json":
        if (!args.file.includes("domain_files.json")) {
          console.error("unknown filetype: " + path.extname(args.file));
          this.exit(1);
        }
        const fileConts = fs.readFileSync(args.file);
        const domain_files = JSON.parse(fileConts);
        const {
          insertTenant,
          getAllTenants,
          switchToTenant,
        } = require("@saltcorn/admin-models/models/tenant");
        const { add_tenant } = require("@saltcorn/data/db/state");

        let existing_tenants = new Set(await getAllTenants());
        for (const [tenant, fnm] of Object.entries(domain_files)) {
          console.log("restore", tenant, "from", fnm);
          if (!existing_tenants.has(tenant)) {
            const tenrow = await insertTenant(tenant);
            add_tenant(tenant);
            await switchToTenant(tenrow);
          }
          await this.zip_restore(fnm, tenant);
        }
        break;
      default:
        console.error("unknown filetype: " + path.extname(args.file));
        this.exit(1);
    }
  }
}

/**
 * @type {object}
 */
RestoreCommand.args = {
  file: Args.string({ required: true, description: "backup file to restore" }),
};

/**
 * @type {string}
 */
RestoreCommand.description = `Restore a previously backed up database (zip or sqlc format)`;

/**
 * @type {string}
 */
RestoreCommand.help = `Restore a previously backed up database (zip or sqlc format)`;

/**
 * @type {object}
 */
RestoreCommand.flags = {
  tenant: Flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = RestoreCommand;
