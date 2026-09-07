const { Command, Flags } = require("@oclif/core");
const path = require("path");
const os = require("os");
const Plugin = require("@saltcorn/data/models/plugin");
const { MobileBuilder } = require("@saltcorn/mobile-builder/mobile-builder");
const { decodeProvisioningProfile } = require("@saltcorn/data/utils");
const { init_multi_tenant, getState } = require("@saltcorn/data/db/state");
const User = require("@saltcorn/data/models/user");

/**
 *
 */
class BuildAppCommand extends Command {
  supportedPlatforms = ["android", "ios", "web"];
  staticPlugins = ["base", "sbadmin2"];

  // checks shared by the local build and the remote --remoteBundleOutput path
  validateCommonParameters(flags) {
    const db = require("@saltcorn/data/db");
    if (!flags.entryPoint && flags.entryPointType !== "byrole") {
      throw new Error(
        "Please specify an entry point for the first view or use -t byrole"
      );
    }
    if (!flags.platforms) {
      throw new Error("Please specify a platform (android or iOS)");
    }
    // Only the native builds need the mobile-app cookie exemptions
    // (WKAppBoundDomains, CapacitorCookies, etc.), which require HTTPS -
    // the "web" platform is a plain webpage with no native WebView involved.
    if (
      flags.platforms.some((p) => p === "android" || p === "ios") &&
      (!flags.serverURL || !flags.serverURL.startsWith("https://"))
    ) {
      throw new Error(
        "Please specify a server URL starting with https:// (-s/--serverURL) - " +
          "session-cookie auth requires HTTPS for android/ios builds"
      );
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

  validateParameters(flags) {
    if (!flags.buildDirectory) {
      throw new Error("Please specify a build directory");
    }
    if (flags.copyAppDirectory) {
      if (!flags.userEmail)
        throw new Error(
          "When 'app target-directory' (-c) is set, a valid 'user email' (-u) is needed"
        );
    }
    this.validateCommonParameters(flags);
    // the API key goes in an Authorization header - don't send it in cleartext
    if (flags.remoteSchemaUrl && !flags.remoteSchemaUrl.startsWith("https://")) {
      throw new Error("--remoteSchemaUrl must start with https://");
    }
    if (flags.platforms.includes("ios") && !flags.noProvisioningProfile) {
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
      if (flags.noProvisioningProfile)
        result = {
          noProvisioningProfile: true,
        };
      else {
        const mainProfileVals = await decodeProvisioningProfile(
          flags.provisioningProfile
        );
        result = {
          appleTeamId: mainProfileVals.teamId,
          isAdHoc: mainProfileVals.isAdHoc,
          mainProvisioningProfile: {
            guuid: mainProfileVals.guuid,
          },
        };
        if (flags.allowShareTo) {
          const shareExtProfileVals = await decodeProvisioningProfile(
            flags.shareExtensionProvisioningProfile
          );
          result.shareExtensionProvisioningProfile = {
            guuid: shareExtProfileVals.guuid,
            specifier: shareExtProfileVals.specifier,
            identifier: shareExtProfileVals.identifier,
            ...(flags.appGroupId ? { appGroupId: flags.appGroupId } : {}),
          };
        }
      }
    }
    return result;
  }

  // MobileBuilder config shared by the remote-bundle and normal build paths
  baseBuilderConfig(flags, mobileAppDir) {
    return {
      appName: flags.appName,
      appId: flags.appId,
      appVersion: flags.appVersion,
      templateDir: mobileAppDir,
      cliDir: path.join(__dirname, "../.."),
      platforms: flags.platforms || [],
      synchedTables: flags.synchedTables,
      includedPlugins: flags.includedPlugins,
      entryPoint: flags.entryPoint,
      entryPointType: flags.entryPointType ? flags.entryPointType : "view",
      serverURL: flags.serverURL,
      splashPage: flags.splashPage,
      autoPublicLogin: flags.autoPublicLogin,
      showContinueAsPublicUser: flags.showContinueAsPublicUser,
      allowOfflineMode: flags.allowOfflineMode,
      syncOnReconnect: flags.syncOnReconnect,
      syncOnAppResume: flags.syncOnAppResume,
      pushSync: flags.pushSync,
      syncInterval: flags.syncInterval,
      pushSyncHeartbeatInterval: flags.pushSyncHeartbeatInterval,
      allowShareTo: flags.allowShareTo,
      tenantAppName: flags.tenantAppName,
      buildType: flags.buildType,
    };
  }

  async run() {
    const { flags } = await this.parse(BuildAppCommand);
    const db = require("@saltcorn/data/db");
    if (db.is_it_multi_tenant() && flags.tenantAppName) {
      await init_multi_tenant(Plugin.loadAllPlugins, true, [
        flags.tenantAppName,
      ]);
    }
    const mobileAppDir = path.join(
      require.resolve("@saltcorn/mobile-app"),
      ".."
    );
    if (flags.remoteBundleOutput) {
      // used by /api/mobile-app/build-bundle - zips www/, skips Capacitor entirely
      this.validateCommonParameters(flags);
      const doZip = async () => {
        const tmpBuildDir = path.join(
          os.tmpdir(),
          `sc-remote-bundle-${Date.now()}`
        );
        const builder = new MobileBuilder({
          ...this.baseBuilderConfig(flags, mobileAppDir),
          buildDir: tmpBuildDir,
          // must run inside the tenant context below, not in baseBuilderConfig
          plugins: await this.uniquePlugins(flags.includedPlugins),
        });
        const result = await builder.prepareRemoteBundle(
          flags.remoteBundleOutput
        );
        if (result !== 0)
          throw new Error(`prepareRemoteBundle failed with code ${result}`);
      };
      if (
        flags.tenantAppName &&
        flags.tenantAppName !== db.connectObj.default_schema
      ) {
        await db.runWithTenant(flags.tenantAppName, doZip);
      } else {
        await doZip();
      }
    } else {
      this.validateParameters(flags);
      const doBuild = async () => {
        const user = flags.userEmail
          ? await User.findOne({ email: flags.userEmail })
          : undefined;
        if (!user && flags.userEmail)
          throw new Error(`The user '${flags.userEmail}' does not exist'`);

        const iosParams = await this.buildIosParams(flags);
        const builder = new MobileBuilder({
          ...this.baseBuilderConfig(flags, mobileAppDir),
          appIcon: flags.appIcon,
          buildDir: flags.buildDirectory,
          useDocker: flags.useDocker,
          plugins: await this.uniquePlugins(flags.includedPlugins),
          copyTargetDir: flags.copyAppDirectory,
          user,
          iosParams: iosParams,
          keyStorePath: flags.androidKeystore,
          keyStoreAlias: flags.androidKeyStoreAlias,
          keyStorePassword: flags.androidKeystorePassword,
          googleServicesFile: flags.googleServicesFile,
          remoteSchemaUrl: flags.remoteSchemaUrl,
          remoteApiKey: flags.remoteApiKey,
          remotePushNotificationsEnabled: flags.remotePushNotificationsEnabled,
        });
        getState().log(5, "Building");
        const result = await builder.build();
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
}

BuildAppCommand.description = "Build mobile app";

BuildAppCommand.flags = {
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
    description: "URL to a saltcorn server, must start with https://",
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
  showContinueAsPublicUser: Flags.boolean({
    name: "show continue as public user",
    string: "showContinueAsPublicUser",
    description:
      "Show a button to continue as public user on the login screen.",
  }),
  allowOfflineMode: Flags.boolean({
    name: "Allow offline mode",
    string: "allowOfflineMode",
    description:
      "Switch to offline mode when there is no internet, sync the data when a connection is available again.",
  }),
  syncOnReconnect: Flags.boolean({
    name: "Sync on connection restored",
    string: "syncOnReconnect",
    description:
      "Run Synchronizations and return into online mode when the network connection is restored. " +
      "When disabled, you still can do this manually.",
  }),
  syncOnAppResume: Flags.boolean({
    name: "Sync on app resume",
    string: "syncOnAppResume",
    description:
      "When offline mode is enabled, synchronize the synchedTables tables when the app is resumed.",
  }),
  pushSync: Flags.boolean({
    name: "Push sync",
    string: "pushSync",
    description:
      "When offline mode is enabled, synchronize the synchedTables tables when a push notification is received.",
  }),
  syncInterval: Flags.string({
    name: "Periodic Sync Interval",
    string: "syncInterval",
    description:
      "Perdiodic interval (in minutes) to run synchronizations in the background. " +
      "This is just a min interval, depending on system conditions, the actual time may be longer.",
  }),
  pushSyncHeartbeatInterval: Flags.string({
    name: "Push Sync Heartbeat Interval",
    string: "pushSyncHeartbeatInterval",
    description:
      "Interval (in minutes) at which the device re-registers its push sync subscription to keep it alive. 0 or unset disables the heartbeat.",
  }),
  noProvisioningProfile: Flags.boolean({
    name: "no provisioning profile",
    string: "noProvisioningProfile",
    description:
      "Do not use a provisioning profile, only for simulator builds (iOS only)",
    default: false,
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
  appGroupId: Flags.string({
    name: "app group id",
    string: "appGroupId",
    description:
      "An app group identifier to share data between the main app and the share extension on iOS, e.g. group.com.saltcorn.myapp",
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
  googleServicesFile: Flags.string({
    name: "google services file",
    string: "googleServicesFile",
    description:
      "Path to the google-services.json file for Firebase Push Notifications (Android only)",
  }),
  remoteSchemaUrl: Flags.string({
    name: "remote schema url",
    string: "remoteSchemaUrl",
    description:
      "Base URL of a saltcorn server (e.g. https://example.com) to fetch the " +
      "schema/config snapshot from - /api/mobile-app/build-bundle is appended " +
      "automatically - instead of reading the local database. Use this when " +
      "building on a machine other than the one the app will connect to at " +
      "runtime (e.g. a Mac used only for the native iOS build), so table/view " +
      "ids always match the live server instead of a separately-restored copy.",
  }),
  remoteApiKey: Flags.string({
    name: "remote api key",
    string: "remoteApiKey",
    description:
      "API key (bearer token) for an admin user on the server given in --remoteSchemaUrl.",
  }),
  remotePushNotificationsEnabled: Flags.boolean({
    name: "remote push notifications enabled",
    string: "remotePushNotificationsEnabled",
    description:
      "Whether the server given in --remoteSchemaUrl has APN push configured - " +
      "used instead of this machine's own local config to decide whether to " +
      "bundle push support.",
    default: false,
  }),
  remoteBundleOutput: Flags.string({
    name: "remote bundle output",
    string: "remoteBundleOutput",
    description:
      "Only prepare buildDir/www (schema, plugin bundles, site assets - " +
      "everything saltcorn-specific) and write it as a zip file at this " +
      "path, and exit - never touches Capacitor/native platforms. Used by " +
      "the /api/mobile-app/build-bundle server route; not intended for " +
      "direct use.",
  }),
};

module.exports = BuildAppCommand;
