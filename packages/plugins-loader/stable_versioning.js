const semver = require("semver");
const { getState } = require("@saltcorn/data/db/state");

/*
 internal helper
*/
const doCheck = (pluginVersion, versionInfos, scVersion) => {
  if (!versionInfos[pluginVersion])
    throw new Error(`Version ${pluginVersion} not found in available versions`);
  const scEngine = versionInfos[pluginVersion].engines?.saltcorn;
  if (!scEngine) return true;
  if (semver.validRange(scEngine) === null) {
    getState().log(4, `invalid engine property: ${scEngine}`);
    return true;
  }
  if (semver.valid(scVersion) === null) {
    getState().log(4, `invalid saltcorn version: ${scVersion}`);
    return true;
  }
  return semver.satisfies(scVersion, scEngine);
};

/**
 * check if 'pluginVersion' is supported or find the latest supported version
 * @param pluginVersion - wanted version
 * @param versionInfos - version infos from the npm registry (resembles the package.json version).
 *                            Here you'll find the engines.saltcorn property.
 * @param scVersion - optional saltcorn version (if not set it will be taken from the state)
 * @returns
 */
const supportedVersion = (
  pluginVersion = "latest",
  versionInfos,
  scVersion
) => {
  const resolved =
    pluginVersion === "latest" ? resolveLatest(versionInfos) : pluginVersion;
  const safeScVersion = scVersion || getState().scVersion;
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
const isVersionSupported = (pluginVersion, scEngine, scVersion) => {
  const safeInfos =
    typeof scEngine === "string"
      ? { [pluginVersion]: { engines: scEngine } }
      : scEngine;
  const safeScVersion = scVersion || getState().scVersion;
  return doCheck(pluginVersion, safeInfos, safeScVersion);
};

/**
 * check if 'scVersion' fullfilles 'scEngine'
 * @param scEngine fixed version or range of saltcorn versions (e.g. ">=1.0.0")
 * @param scVersion optional saltcorn version (if not set it will be taken from the state)
 * @returns true if the saltcorn version fullfilles scEngine
 */
const isEngineSatisfied = (scEngine, scVersion) => {
  if (!scEngine) return true;
  if (semver.validRange(scEngine) === null) {
    getState().log(4, `invalid engine property: ${scEngine}`);
    return true;
  }
  const safeScVersion = scVersion || getState().scVersion;
  if (semver.valid(safeScVersion) === null) {
    getState().log(4, `invalid saltcorn version: ${scVersion}`);
    return true;
  }
  return semver.satisfies(safeScVersion, scEngine);
};

/**
 * change latest to the actual version
 * @param versionInfos - version infos from the npm registry
 */
const resolveLatest = (versionInfos) => {
  const keys = Object.keys(versionInfos);
  keys.sort((a, b) => semver.rcompare(a, b));
  return keys[0];
};

module.exports = {
  isVersionSupported,
  isEngineSatisfied,
  supportedVersion,
  resolveLatest,
};
