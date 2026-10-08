/**
 * @category saltcorn-cli
 * @module commands/disable-ssl
 */
const { Command, Flags } = require("@oclif/core");

/**
 * DisableSslCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class DisableSslCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags } = await this.parse(DisableSslCommand);
    // Read and written in the database directly, without loading plugins or
    // starting tenants: this is for a server whose web UI will not open, and it
    // should run on a small VPS that cannot afford a full start.
    const { getConfig, setConfig } = require("@saltcorn/data/models/config");
    const changed = [];
    if (await getConfig("letsencrypt", false)) {
      await setConfig("letsencrypt", false);
      changed.push("Let's Encrypt is disabled");
    }
    if (!flags["keep-custom-certificate"]) {
      const cert = await getConfig("custom_ssl_certificate", "");
      const key = await getConfig("custom_ssl_private_key", "");
      if (cert || key) {
        await setConfig("custom_ssl_certificate", "");
        await setConfig("custom_ssl_private_key", "");
        changed.push("the custom SSL certificate and private key are removed");
      }
    }
    if (changed.length === 0)
      console.log("SSL is not enabled, nothing to change");
    else
      console.log(
        `${changed.join(", and ")}. Restart Saltcorn to serve plain HTTP.`
      );
    this.exit(0);
  }
}

/**
 * @type {string}
 */
DisableSslCommand.description = `Disable SSL: turn off Let's Encrypt and remove the custom SSL certificate, so the server starts on plain HTTP. For a server whose SSL configuration keeps the web UI from opening. Restart required.`;

/**
 * @type {object}
 */
DisableSslCommand.flags = {
  "keep-custom-certificate": Flags.boolean({
    description:
      "Only turn off Let's Encrypt; leave a custom certificate in place",
  }),
};

module.exports = DisableSslCommand;
