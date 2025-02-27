/**
 * @category saltcorn-cli
 * @module commands/translate
 */
const { Command, Flags, Args } = require("@oclif/core");
const { maybe_as_tenant, init_some_tenants } = require("../../common");
const { getState, features } = require("@saltcorn/data/db/state");
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
      console.log(getState().functions);
      const dir = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "server",
        "locales",
      );
      const english = JSON.parse(fs.readFileSync(path.join(dir, "en.json")));
      const locale = JSON.parse(
        fs.readFileSync(path.join(dir, args.locale + ".json")),
      );

      let count = 0;
      for (const key of Object.keys(english)) {
        if (skipKeys.includes(key) || (locale[key] && locale[key] !== key)) {
          //console.log("Skipping", locale[key]);
          continue;
        }
        process.stdout.write(`Translating ${key} to: `);
        const answer = await getState().functions.llm_generate.run(
          `Translate this into ${languageNames.of(args.locale)}: ${key}`,
          { systemPrompt: systemPrompt(args.locale), temperature: 0 },
        );
        console.log(answer);
        locale[key] = answer;
        count += 1;
        //if (count > 10) break;
      }
      fs.writeFileSync(
        path.join(dir, args.locale + ".json"),
        JSON.stringify(locale, null, 2),
      );
    });
    this.exit(0);
  }
}

// prompt explain: tables, users, tenants
const languageNames = new Intl.DisplayNames(["en"], {
  type: "language",
});
const skipKeys = ["HTTP", "Plugins"];

const systemPrompt = (
  locale,
) => `You are purely a translation assistant. Translate 
the entered text into ${languageNames.of(locale)} without any additional information.
the translation is in the domain of database user interface/ application development software. the term Table referes to 
the database table, the row is a row in the database table, media is the type of media file,
the user is the user account in the system, with each user having a role that defines permissions, and as the system is 
multi-tenant the term tenant refers an instance of the application for a particular purpose. 
2FA is two factor authentication, building refers to building software applications. A view is a 
representation of the database content on the screen for the user, and actions are user-defined ways of 
manipulating data or files. The system is modular, and an extension is known as a Module`;

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
  module: Flags.string({
    char: "m",
    description: "Module to translate (in development)",
  }),
};

module.exports = TranslateCommand;
