import { spawnSync, SpawnSyncReturns } from "child_process";
import { existsSync, mkdirSync, copySync, rmSync } from "fs-extra";
import { join } from "path";
import { userInfo } from "os";

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
 *
 * @param buildDir directory where the app will be build
 * @returns
 */
export function buildApkInContainer(buildDir: string) {
  const info = userInfo();
  const result = spawnSync(
    "docker",
    [
      "run",
      "-v",
      `${buildDir}:/saltcorn-mobile-app`,
      "saltcorn/cordova-builder",
    ],
    { cwd: "." }
  );
  console.log(result.output.toString());
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
  useDocker?: boolean
) {
  if (!useDocker) {
    return callBuild(buildDir, platforms);
  } else {
    let code = buildApkInContainer(buildDir);
    if (code === 0 && platforms.indexOf("ios") > -1)
      code = callBuild(buildDir, ["ios"]);
    return code;
  }
}

/**
 *
 * @param buildDir directory where the app will be build
 * @param platforms
 */
export function addPlatforms(buildDir: string, platforms: string[]) {
  const result = spawnSync("npm", ["run", "add-platform", "--", ...platforms], {
    cwd: buildDir,
  });
  console.log(result.output.toString());
}

/**
 *
 * @param buildDir directory where the app will be build
 * @param platforms
 * @returns
 */
export function callBuild(buildDir: string, platforms: string[]) {
  addPlatforms(buildDir, platforms);
  const result = spawnSync("npm", ["run", "build-app", "--", ...platforms], {
    cwd: buildDir,
  });
  console.log(result.output.toString());
  return result.status;
}

/**
 *
 * @param buildDir directory where the app was build
 * @param copyDir directory where the resulting app file will be copied to
 * @param appFileName name of the copied app file
 */
export async function copyApp(
  buildDir: string,
  copyDir: string,
  appFileName?: string
) {
  if (!existsSync(copyDir)) {
    mkdirSync(copyDir);
  }
  const apkName = "app-debug.apk";
  const apkFile = join(
    buildDir,
    "platforms",
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "debug",
    apkName
  );
  const targetFile = appFileName ? appFileName : apkName;
  copySync(apkFile, join(copyDir, targetFile));
}
