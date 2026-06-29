import semver from "semver";
import { getState } from "@saltcorn/data/db/state";

/**
 * version info as found in the npm registry (resembles a package.json version)
 */
export type VersionInfo = {
  engines?: { saltcorn?: string } | string;
  [key: string]: any;
};

export type VersionInfos = { [version: string]: VersionInfo };

/*
 internal helper
*/
const doCheck = (
  pluginVersion: string,
  versionInfos: VersionInfos,
  scVersion?: string
): boolean => {
  if (!versionInfos[pluginVersion])
    throw new Error(`Version ${pluginVersion} not found in available versions`);
  const engines = versionInfos[pluginVersion].engines;
  const scEngine = typeof engines === "string" ? engines : engines?.saltcorn;
  if (!scEngine) return true;
  if (semver.validRange(scEngine) === null) {
    getState()!.log(4, `invalid engine property: ${scEngine}`);
    return true;
  }
  if (!scVersion || semver.valid(scVersion) === null) {
    getState()!.log(4, `invalid saltcorn version: ${scVersion}`);
    return true;
  }
  return semver.satisfies(scVersion, scEngine, { includePrerelease: true });
};

/**
 * check if 'pluginVersion' is supported or find the latest supported version
 * @param pluginVersion - wanted version
 * @param versionInfos - version infos from the npm registry (resembles the package.json version).
 *                            Here you'll find the engines.saltcorn property.
 * @param scVersion - optional saltcorn version (if not set it will be taken from the state)
 * @returns
 */
export const supportedVersion = (
  pluginVersion: string = "latest",
  versionInfos: VersionInfos,
  scVersion?: string
): string | null => {
  const resolved =
    pluginVersion === "latest" ? resolveLatest(versionInfos) : pluginVersion;
  const safeScVersion = scVersion || getState()!.scVersion;
  if (doCheck(resolved, versionInfos, safeScVersion)) return resolved;
  else {
    const keys = Object.keys(versionInfos);
    keys.sort((a, b) => semver.rcompare(b, a));
    // iterate in reverse order to get the latest version
    for (let i = keys.length - 1; i >= 0; i--) {
      const version = keys[i];
      if (doCheck(version, versionInfos, safeScVersion)) return version;
    }
    return null;
  }
};

/**
 * check if 'pluginVersion' is supported
 * @param pluginVersion - wanted version
 * @param scEngine - version infos from the npm registry (resembles the package.json version)
 *                        Here you'll find the engines.saltcorn property.
 *                        If versionInfos is a string, it will be treated as the engines.saltcorn property.
 * @param scVersion - optional saltcorn version (if not set it will be taken from the state)
 */
export const isVersionSupported = (
  pluginVersion: string,
  scEngine: string | VersionInfos,
  scVersion?: string
): boolean => {
  const safeInfos: VersionInfos =
    typeof scEngine === "string"
      ? { [pluginVersion]: { engines: scEngine } }
      : scEngine;
  const safeScVersion = scVersion || getState()!.scVersion;
  return doCheck(pluginVersion, safeInfos, safeScVersion);
};

/**
 * check if 'scVersion' fullfilles 'scEngine'
 * @param scEngine fixed version or range of saltcorn versions (e.g. ">=1.0.0")
 * @param scVersion optional saltcorn version (if not set it will be taken from the state)
 * @returns true if the saltcorn version fullfilles scEngine
 */
export const isEngineSatisfied = (
  scEngine?: string,
  scVersion?: string
): boolean => {
  if (!scEngine) return true;
  if (semver.validRange(scEngine) === null) {
    getState()!.log(4, `invalid engine property: ${scEngine}`);
    return true;
  }
  const safeScVersion = scVersion || getState()!.scVersion;
  if (!safeScVersion || semver.valid(safeScVersion) === null) {
    getState()!.log(4, `invalid saltcorn version: ${scVersion}`);
    return true;
  }
  return semver.satisfies(safeScVersion, scEngine, { includePrerelease: true });
};

/**
 * change latest to the actual version
 * @param versionInfos - version infos from the npm registry
 */
export const resolveLatest = (versionInfos: VersionInfos): string => {
  const keys = Object.keys(versionInfos);
  keys.sort((a, b) => semver.rcompare(a, b));
  return keys[0];
};
