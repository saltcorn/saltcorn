import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  copySync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "fs-extra";
import { join } from "path";
import { readdirSync } from "fs";
import File from "@saltcorn/data/models/file";
const { getState } = require("@saltcorn/data/db/state");
import type User from "@saltcorn/data/models/user";
import { parseStringPromise, Builder } from "xml2js";
import { removeNonWordChars } from "@saltcorn/data/utils";

/**
 * copy saltcorn-mobile-app as a template to buildDir
 * @param buildDir directory where the app will be build
 * @param templateDir directory of the template code that will be copied to 'buildDir'
 */
export function prepareBuildDir(buildDir: string, templateDir: string) {
  if (existsSync(buildDir)) rmSync(buildDir, { force: true, recursive: true });
  copySync(templateDir, buildDir);
  rmSync(`${buildDir}/node_modules`, { recursive: true, force: true });
  const result = spawnSync("npm", ["install", "--legacy-peer-deps"], {
    cwd: buildDir,
  });
  console.log(result.output.toString());
}

/**
 * parse the config.xml file and replace the id and name parameters
 * on error the defaults will be used
 * @param buildDir directory where the app will be build
 * @param appName
 */
export async function setAppName(buildDir: string, appName: string) {
  try {
    const configXml = join(buildDir, "config.xml");
    const content = readFileSync(configXml);
    const parsed = await parseStringPromise(content);
    parsed.widget.$.id = `${removeNonWordChars(appName)}.mobile.app`;
    parsed.widget.name[0] = appName;
    const xmlBuilder = new Builder();
    const newCfg = xmlBuilder.buildObject(parsed);
    writeFileSync(configXml, newCfg);
  } catch (error: any) {
    console.log(
      `Unable to set the appName to '${appName}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * parse the config.xml file and replace the version parameter
 * on error the defaults will be used
 * @param buildDir directory where the app will be build
 * @param appVersion
 */
export async function setAppVersion(buildDir: string, appVersion: string) {
  try {
    const configXml = join(buildDir, "config.xml");
    const content = readFileSync(configXml);
    const parsed = await parseStringPromise(content);
    parsed.widget.$.version = appVersion;
    const xmlBuilder = new Builder();
    const newCfg = xmlBuilder.buildObject(parsed);
    writeFileSync(configXml, newCfg);
  } catch (error: any) {
    console.log(
      `Unable to set the appVersion to '${appVersion}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * copy a png file into the build dir and use it as launcher icon
 * @param buildDir
 * @param appIcon path to appIcon file
 */
export async function prepareAppIcon(buildDir: string, appIcon: string) {
  try {
    copySync(appIcon, join(buildDir, "res", "icon", "android", "icon.png"), {
      overwrite: true,
    });
  } catch (error: any) {
    console.log(
      `Unable to set the app icon '${appIcon}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 *
 * @param buildDir directory where the app will be build
 * @returns
 */
export function buildApkInContainer(buildDir: string) {
  const result = spawnSync(
    "docker",
    [
      "run",
      "--network",
      "host",
      "-v",
      `${buildDir}:/saltcorn-mobile-app`,
      "saltcorn/cordova-builder",
    ],
    { cwd: "." }
  );
  if (result.output) console.log(result.output.toString());
  else if (result.error) console.log(result.error.toString());
  else console.log("docker finished without output");
  return result.status;
}

/**
 * build '.apk / .ipa' files with cordova (only android is tested)
 * @param flags
 * @returns
 */
export function buildApp(
  buildDir: string,
  platforms: string[],
  useDocker?: boolean,
  buildForEmulator?: boolean
) {
  if (!useDocker) {
    addPlugins(buildDir);
    return callBuild(buildDir, platforms, buildForEmulator);
  } else {
    let code = buildApkInContainer(buildDir);
    if (code === 0 && platforms.indexOf("ios") > -1)
      code = callBuild(buildDir, ["ios"]);
    return code;
  }
}

/**
 * call cordova plugin add ...
 * it loads the dependencies from npm, docker usese cached folders
 * @param buildDir
 */
function addPlugins(buildDir: string) {
  let result = spawnSync(
    "npm",
    ["run", "add-plugin", "--", "cordova-sqlite-ext"],
    {
      cwd: buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    }
  );
  console.log(result.output.toString());
  result = spawnSync(
    "npm",
    ["run", "add-plugin", "--", "cordova-plugin-file"],
    {
      cwd: buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    }
  );
  console.log(result.output.toString());
  result = spawnSync(
    "npm",
    ["run", "add-plugin", "--", "cordova-plugin-inappbrowser"],
    {
      cwd: buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    }
  );
  console.log(result.output.toString());
  result = spawnSync(
    "npm",
    ["run", "add-plugin", "--", "cordova-plugin-network-information"],
    {
      cwd: buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    }
  );
  console.log(result.output.toString());
  result = spawnSync(
    "npm",
    ["run", "add-plugin", "--", "cordova-plugin-geolocation"],
    {
      cwd: buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    }
  );
  console.log(result.output.toString());
  result = spawnSync(
    "npm",
    ["run", "add-plugin", "--", "cordova-plugin-camera"],
    {
      cwd: buildDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    }
  );
  console.log(result.output.toString());
}

/**
 *
 * @param buildDir directory where the app will be build
 * @param platforms
 */
export function addPlatforms(buildDir: string, platforms: string[]) {
  const result = spawnSync("npm", ["run", "add-platform", "--", ...platforms], {
    cwd: buildDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
    },
  });
  console.log(result.output.toString());
}

/**
 *
 * @param buildDir directory where the app will be build
 * @param platforms
 * @returns
 */
export function callBuild(
  buildDir: string,
  platforms: string[],
  buildForEmulator?: boolean
) {
  addPlatforms(buildDir, platforms);
  let buildParams = [...platforms];
  if (!buildForEmulator) {
    buildParams.push(
      "--device",
      `--developmentTeam="${getState().getConfig("apple_team_id")}"`
    );
  }
  const result = spawnSync("npm", ["run", "build-app", "--", ...buildParams], {
    cwd: buildDir,
  });
  console.log(result.output.toString());
  return result.status;
}

/**
 * find first file with specific ending
 * @param directory directory to search
 * @param ending wantet ending
 */
function fileWithEnding(directory: string, ending: string): string | null {
  if (!existsSync(directory)) return null;
  for (const file of readdirSync(directory)) {
    if (file.endsWith(ending)) return file;
  }
  return null;
}

function safeEnding(file: string, ending: string): string {
  if (!file.endsWith(ending)) return `${file}${ending}`;
  return file;
}

/**
 * copy .apk / .ipa files to 'copyDir' if they exist
 * @param buildDir directory where the app was build
 * @param copyDir directory where the resulting app file will be copied to
 * @param user the user specified by the userEmail (-c) parameter
 * @param appName
 */
export async function tryCopyAppFiles(
  buildDir: string,
  copyDir: string,
  user: User,
  appName?: string
) {
  if (!existsSync(copyDir)) {
    mkdirSync(copyDir);
  }
  // android .apk file
  const apkBuildDir = join(
    buildDir,
    "platforms",
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "debug"
  );
  const apkFile = fileWithEnding(apkBuildDir, ".apk");
  if (apkFile) {
    const dstFile = appName ? safeEnding(appName, ".apk") : "app-debug.apk";
    copySync(join(apkBuildDir, apkFile), join(copyDir, dstFile));
    await File.set_xattr_of_existing_file(dstFile, copyDir, user);
  }
  // iOS .ipa file
  const ipaBuildDir = join(buildDir, "platforms", "ios", "build", "device");
  const ipaFile = fileWithEnding(ipaBuildDir, ".ipa");
  if (ipaFile) {
    const dstFile = appName ? safeEnding(appName, ".ipa") : "app-debug.ipa";
    copySync(join(ipaBuildDir, ipaFile), join(copyDir, dstFile));
    await File.set_xattr_of_existing_file(dstFile, copyDir, user);
  }
}
