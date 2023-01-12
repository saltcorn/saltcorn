const { Command, flags } = require("@oclif/command");
const path = require("path");
const Plugin = require("@saltcorn/data/models/plugin");
const { MobileBuilder } = require("@saltcorn/mobile-builder/mobile-builder");
const { init_multi_tenant } = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
const User = require("@saltcorn/data/models/user");

/**
 *
 */
class BuildAppCommand extends Command {
  supportedPlatforms = ["android", "ios"];
  staticPlugins = ["base", "sbadmin2"];

  validateParameters(flags) {
    const db = require("@saltcorn/data/db");
    if (!flags.buildDirectory) {
      throw new Error("Please specify a build directory");
    }
    if (flags.copyAppDirectory) {
      if (!flags.userEmail)
        throw new Error(
          "When 'app target-directory' (-c) is set, a valid 'user email' (-u) is needed"
        );
    }
    if (!flags.entryPoint) {
      throw new Error("Please specify an entry point for the first view");
    }
    if (!flags.platforms) {
      throw new Error("Please specify cordova platforms (android or iOS)");
    }
    for (const platform of flags.platforms)
      if (!this.supportedPlatforms.includes(platform))
        throw new Error(`The platform '${platform}' is not supported`);
    if (!db.is_it_multi_tenant() && flags.tenantAppName) {
      throw new Error(
        `To build for tenant '${flags.tenantAppName}' please activate multi-tenancy`
      );
    }
  }

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    this.validateParameters(flags);
    const user = flags.userEmail
      ? await User.findOne({ email: flags.userEmail })
      : undefined;
    if (!user && flags.userEmail)
      throw new Error(`The user '${flags.userEmail}' does not exist'`);
    const mobileAppDir = path.join(
      require.resolve("@saltcorn/mobile-app"),
      ".."
    );
    const db = require("@saltcorn/data/db");
    if (db.is_it_multi_tenant() && flags.tenantAppName) {
      await init_multi_tenant(loadAllPlugins, true, [flags.tenantAppName]);
    }
    const doBuild = async () => {
      const dynamicPlugins = (await Plugin.find()).filter(
        (plugin) => !this.staticPlugins.includes(plugin.name)
      );
      const builder = new MobileBuilder({
        templateDir: mobileAppDir,
        buildDir: flags.buildDirectory,
        cliDir: path.join(__dirname, "../.."),
        useDocker: flags.useDocker,
        platforms: flags.platforms,
        localUserTables: flags.localUserTables,
        entryPoint: flags.entryPoint,
        entryPointType: flags.entryPointType ? flags.entryPointType : "view",
        serverURL: flags.serverURL,
        plugins: dynamicPlugins,
        copyTargetDir: flags.copyAppDirectory,
        user,
        copyFileName: flags.appFileName,
        buildForEmulator: flags.buildForEmulator,
        tenantAppName: flags.tenantAppName,
      });
      process.exit(await builder.build());
    };
    if (
      flags.tenantAppName &&
      flags.tenantAppName !== db.connectObj.default_schema
    ) {
      await db.runWithTenant(flags.tenantAppName, doBuild);
    } else {
      await doBuild();
    }
  }
}

BuildAppCommand.description = "build mobile app";

BuildAppCommand.flags = {
  tenantAppName: flags.string({
    name: "tenant",
    string: "tenant",
    description:
      "Optional name of a tenant application, if set, the app will be build for this tenant",
  }),
  platforms: flags.string({
    name: "platforms",
    char: "p",
    description: "Platforms to build for, space separated list",
    multiple: true,
  }),
  entryPoint: flags.string({
    name: "entry point",
    char: "e",
    description: "This is the first view or page (see -t) after the login.",
  }),
  entryPointType: flags.string({
    name: "entry point type",
    char: "t",
    description:
      "Type of the entry point ('view' or 'page'). The default is 'view'.",
  }),
  localUserTables: flags.string({
    name: "local user tables",
    char: "l",
    description: "user defined tables that should be replicated into the app",
    multiple: true,
  }),
  useDocker: flags.boolean({
    name: "use docker build container",
    char: "d",
    description: "Use a docker container to build the app.",
  }),
  buildDirectory: flags.string({
    name: "build directory",
    char: "b",
    description: "A directory where the app should be build",
  }),
  copyAppDirectory: flags.string({
    name: "app target-directory",
    char: "c",
    description:
      "If set, the app file will be copied here, please set 'user email', too",
  }),
  userEmail: flags.string({
    name: "user email",
    char: "u",
    description: "Email of the user building the app",
  }),
  appFileName: flags.string({
    name: "app file name",
    char: "a",
    description: "If set, the copied app will get this name",
  }),
  serverURL: flags.string({
    name: "server URL",
    char: "s",
    description: "URL to a saltcorn server",
  }),
  buildForEmulator: flags.boolean({
    name: "build for emulator",
    description:
      "build without '--device', generates no .ipa file so that iOS apps can be build without developer accounts",
  }),
};

module.exports = BuildAppCommand;
