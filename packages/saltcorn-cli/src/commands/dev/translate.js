/**
 * @category saltcorn-cli
 * @module commands/translate
 */
const { Command, Flags, Args } = require("@oclif/core");
const { maybe_as_tenant, init_some_tenants } = require("../../common");
const { getState, features } = require("@saltcorn/data/db/state");
const { translate } = require("@saltcorn/data/translate");
const path = require("path");
const fs = require("fs");

/**
 * TranslateCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class TranslateCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const db = require("@saltcorn/data/db");
    const Plugin = require("@saltcorn/data/models/plugin");
    const { args, flags } = await this.parse(TranslateCommand);
    await init_some_tenants();
    await maybe_as_tenant(null, async () => {
      let dir = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "server",
        "locales",
      );
      if (flags.plugin) {
        const location = getState().plugin_locations[flags.plugin];
        if (!location) throw new Error("Plugin not found");
        dir = path.join(location, "locales");
      }
      const english = JSON.parse(fs.readFileSync(path.join(dir, "en.json")));
      const filePath = path.join(dir, args.locale + ".json");

      const locale = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath))
        : {};

      let count = 0;
      for (const key of Object.keys(english)) {
        if (skipKeys.includes(key) || (locale[key] && locale[key] !== key)) {
          //console.log("Skipping", locale[key]);
          continue;
        }
        process.stdout.write(`Translating ${key} to: `);
        const answer = await translate(key, args.locale);
        console.log(answer);
        locale[key] = answer;
        count += 1;
        fs.writeFileSync(
          path.join(dir, args.locale + ".json"),
          JSON.stringify(locale, null, 2),
        );
        //if (count > 10) break;
      }
      if (flags.plugin) {
        //console.log(getState().plugins[flags.plugin]);
        const plugin = await Plugin.findOne({
          name: { or: [flags.plugin, `@saltcorn/${flags.plugin}`] },
        });
        if (plugin?.source === "local") {
          fs.writeFileSync(
            path.join(plugin.location, "locales", args.locale + ".json"),
            JSON.stringify(locale, null, 2),
          );
        }
      }
    });
    this.exit(0);
  }
}

// prompt explain: tables, users, tenants

const skipKeys = ["HTTP", "Plugins"];

TranslateCommand.args = {
  locale: Args.string({
    required: true,
    description: "locale to translate",
  }),
};

/**
 * @type {string}
 */
TranslateCommand.description = `Produce translation files with LLM`;

/**
 * @type {object}
 */
TranslateCommand.flags = {
  plugin: Flags.string({
    char: "p",
    description: "Plugin to translate",
  }),
};

module.exports = TranslateCommand;
