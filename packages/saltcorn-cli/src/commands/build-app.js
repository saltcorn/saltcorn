const { Command, Flags } = require("@oclif/core");
const path = require("path");
const Plugin = require("@saltcorn/data/models/plugin");
const { MobileBuilder } = require("@saltcorn/mobile-builder/mobile-builder");
const {
  decodeProvisioningProfile,
} = require("@saltcorn/mobile-builder/utils/common-build-utils");
const { init_multi_tenant, getState } = require("@saltcorn/data/db/state");
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
      throw new Error("Please specify a platform (android or iOS)");
    }
    for (const platform of flags.platforms)
      if (!this.supportedPlatforms.includes(platform))
        throw new Error(`The platform '${platform}' is not supported`);
    if (!db.is_it_multi_tenant() && flags.tenantAppName) {
      throw new Error(
        `To build for tenant '${flags.tenantAppName}' please activate multi-tenancy`
      );
    }

    if (flags.platforms.includes("ios")) {
      if (!flags.provisioningProfile)
        throw new Error("Please specify a provisioning profile");
      if (flags.allowShareTo && !flags.shareExtensionProvisioningProfile)
        throw new Error(
          "Please specify a share extension provisioning profile"
        );
    }
  }

  async uniquePlugins(toInclude) {
    const dynamicPlugins = (await Plugin.find()).filter(
      (plugin) =>
        !this.staticPlugins.includes(plugin.name) &&
        toInclude?.includes(plugin.name)
    );
    const pluginsMap = new Map();
    for (const plugin of dynamicPlugins) {
      const existing = pluginsMap.get(plugin.name);
      if (existing) {
        if (!existing.configuration) pluginsMap.set(plugin.name, plugin);
      } else pluginsMap.set(plugin.name, plugin);
    }
    return Array.from(pluginsMap.values());
  }

  async buildIosParams(flags) {
    let result = undefined;
    if (flags.platforms.includes("ios")) {
      const mainProfileVals = await decodeProvisioningProfile(
        flags.buildDirectory,
        flags.provisioningProfile
      );
      result = {
        appleTeamId: mainProfileVals.teamId,
        mainProvisioningProfile: {
          guuid: mainProfileVals.guuid,
        },
      };
      if (flags.allowShareTo) {
        const shareExtProfileVals = await decodeProvisioningProfile(
          flags.buildDirectory,
          flags.shareExtensionProvisioningProfile
        );
        result.shareExtensionProvisioningProfile = {
          guuid: shareExtProfileVals.guuid,
          specifier: shareExtProfileVals.specifier,
          identifier: shareExtProfileVals.identifier,
        };
      }
    }
    return result;
  }

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    this.validateParameters(flags);
    const mobileAppDir = path.join(
      require.resolve("@saltcorn/mobile-app"),
      ".."
    );
    const db = require("@saltcorn/data/db");
    if (db.is_it_multi_tenant() && flags.tenantAppName) {
      await init_multi_tenant(loadAllPlugins, true, [flags.tenantAppName]);
    }
    const doBuild = async () => {
      const user = flags.userEmail
        ? await User.findOne({ email: flags.userEmail })
        : undefined;
      if (!user && flags.userEmail)
        throw new Error(`The user '${flags.userEmail}' does not exist'`);

      const iosParams = await this.buildIosParams(flags);
      const builder = new MobileBuilder({
        appName: flags.appName,
        appId: flags.appId,
        appVersion: flags.appVersion,
        appIcon: flags.appIcon,
        templateDir: mobileAppDir,
        buildDir: flags.buildDirectory,
        cliDir: path.join(__dirname, "../.."),
        useDocker: flags.useDocker,
        platforms: flags.platforms,
        localUserTables: flags.localUserTables,
        synchedTables: flags.synchedTables,
        includedPlugins: flags.includedPlugins,
        entryPoint: flags.entryPoint,
        entryPointType: flags.entryPointType ? flags.entryPointType : "view",
        serverURL: flags.serverURL,
        splashPage: flags.splashPage,
        autoPublicLogin: flags.autoPublicLogin,
        allowOfflineMode: flags.allowOfflineMode,
        allowShareTo: flags.allowShareTo,
        plugins: await this.uniquePlugins(flags.includedPlugins),
        copyTargetDir: flags.copyAppDirectory,
        user,
        iosParams: iosParams,
        tenantAppName: flags.tenantAppName,
        buildType: flags.buildType,
        keyStorePath: flags.androidKeystore,
        keyStoreAlias: flags.androidKeyStoreAlias,
        keyStorePassword: flags.androidKeystorePassword,
      });
      let result;
      switch (flags.mode) {
        case "full":
          getState().log(5, "Building completely");
          result = await builder.fullBuild();
          break;
        case "prepare":
          getState().log(5, "Preparing the ios build directory");
          result = await builder.prepareStep();
          break;
        case "finish":
          getState().log(
            5,
            "Finishing the ios build in the prepared ios folder"
          );
          result = await builder.finishStep();
          break;
        default:
          throw new Error(`Unknown mode '${flags.mode}'`);
      }
      process.exit(result);
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

BuildAppCommand.description = "Build mobile app";

BuildAppCommand.flags = {
  mode: Flags.string({
    name: "mode",
    char: "m",
    description:
      "Build the app completely (full), " +
      "prepare the ios build directory (prepare) or finish the ios build in the prepared ios folder (finish)",
    options: ["full", "prepare", "finish"],
    default: "full",
  }),
  allowShareTo: Flags.boolean({
    name: "allow share to",
    string: "allowShareTo",
    description: "Allow sharing from other apps to this app",
    default: false,
  }),
  tenantAppName: Flags.string({
    name: "tenant",
    string: "tenant",
    description:
      "Optional name of a tenant application, if set, the app will be build for this tenant",
  }),
  platforms: Flags.string({
    name: "platforms",
    char: "p",
    description: "Platforms to build for, space separated list",
    multiple: true,
  }),
  entryPoint: Flags.string({
    name: "entry point",
    char: "e",
    description: "This is the first view or page (see -t) after the login.",
  }),
  entryPointType: Flags.string({
    name: "entry point type",
    char: "t",
    description:
      "Type of the entry point ('view' or 'page'). The default is 'view'.",
  }),
  localUserTables: Flags.string({
    name: "local user tables",
    char: "l",
    description: "user defined tables that should be replicated into the app",
    multiple: true,
  }),
  synchedTables: Flags.string({
    name: "synched tables",
    string: "synchedTables",
    description:
      "Table names for which the offline should be synchronized with the saltcorn server",
    multiple: true,
  }),
  includedPlugins: Flags.string({
    name: "included plugins",
    string: "includedPlugins",
    description:
      "Names of plugins that should be bundled into the app." +
      "If empty, no modules are used.",
    multiple: true,
  }),
  useDocker: Flags.boolean({
    name: "use docker build container",
    char: "d",
    description: "Use a docker container to build the app.",
  }),
  buildDirectory: Flags.string({
    name: "build directory",
    char: "b",
    description: "A directory where the app should be build",
  }),
  copyAppDirectory: Flags.string({
    name: "app target-directory",
    char: "c",
    description:
      "If set, the app file will be copied here, please set 'user email', too",
  }),
  userEmail: Flags.string({
    name: "user email",
    char: "u",
    description: "Email of the user building the app",
  }),
  appName: Flags.string({
    name: "app name",
    string: "appName",
    description: "Name of the mobile app (default SaltcornMobileApp)",
  }),
  appId: Flags.string({
    name: "app id",
    string: "appId",
    description: "Id of the mobile app (default com.saltcorn.mobileapp)",
  }),
  appVersion: Flags.string({
    name: "app version",
    string: "appVersion",
    description: "Version of the mobile app (default 0.0.1)",
  }),
  appIcon: Flags.string({
    name: "app icon",
    string: "appIcon",
    description:
      "A png that will be used as launcher icon. The default is a png of a saltcorn symbol.",
  }),
  serverURL: Flags.string({
    name: "server URL",
    char: "s",
    description: "URL to a saltcorn server",
  }),
  splashPage: Flags.string({
    name: "splash page",
    string: "splashPage",
    description:
      "Name of a page that should be shown while the app is loading.",
  }),
  autoPublicLogin: Flags.boolean({
    name: "auto public login",
    string: "autoPublicLogin",
    description: "Show public entry points before the login as a public user.",
  }),
  allowOfflineMode: Flags.boolean({
    name: "Allow offline mode",
    string: "allowOfflineMode",
    description:
      "Switch to offline mode when there is no internet, sync the data when a connection is available again.",
  }),
  provisioningProfile: Flags.string({
    name: "provisioning profile",
    string: "provisioningProfile",
    description: "This profile will be used to sign your app",
  }),
  shareExtensionProvisioningProfile: Flags.string({
    name: "share extension provisioning profile",
    string: "shareExtensionProvisioningProfile",
    description:
      "This profile will be used to sign your share extension on iOS",
  }),
  buildType: Flags.string({
    name: "build type",
    string: "buildType",
    description: "debug or release build",
  }),
  androidKeystore: Flags.string({
    name: "android key store",
    string: "androidKeyStore",
    description:
      "A self-signed certificate that includes the private key used to sign your app.",
  }),
  androidKeyStoreAlias: Flags.string({
    name: "android key store alias",
    string: "keyStoreAlias",
    description: "A unique name to identify the key within the keystore file.",
  }),
  androidKeystorePassword: Flags.string({
    name: "android key store password",
    string: "keyStorePassword",
    description: "he password to access the keystore file.",
  }),
};

module.exports = BuildAppCommand;
