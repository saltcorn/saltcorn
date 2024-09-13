const semver = require("semver");
const { getState } = require("@saltcorn/data/db/state");

/*
 internal helper
*/
const doCheck = (version, versionInfos, scVersion) => {
  if (!versionInfos[version])
    throw new Error(`Version ${version} not found in available versions`);
  const scEngine = versionInfos[version].engines?.saltcorn;
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
 * check if 'wantedVersion' is supported or find the latest supported version
 * @param {*} wantedVersion - wanted version
 * @param {*} versionInfos - version infos from the npm registry (resembles the package.json version)
 * @param {*} scVersion - saltcorn version
 * @returns
 */
const supportedVersion = (
  wantedVersion = "latest",
  versionInfos,
  scVersion
) => {
  const resolved =
    wantedVersion === "latest" ? resolveLatest(versionInfos) : wantedVersion;
  if (doCheck(resolved, versionInfos, scVersion)) return resolved;
  else {
    const keys = Object.keys(versionInfos);
    keys.sort((a, b) => semver.rcompare(b, a));
    // iterate in reverse order to get the latest version
    for (let i = keys.length - 1; i >= 0; i--) {
      const version = keys[i];
      if (doCheck(version, versionInfos, scVersion)) return version;
    }
    return null;
  }
};

/**
 * Check if the version is supported
 * @param version - wanted version
 * @param versionInfos - version infos from the npm registry (resembles the package.json version)
 * @param scVersion - saltcorn version
 */
const isVersionSupported = (version, versionInfos, scVersion) => {
  return doCheck(version, versionInfos, scVersion);
};

/**
 * change latest to the actual version
 * @param versionInfos - version infos from the npm registry (resembles the package.json version)
 */
const resolveLatest = (versionInfos) => {
  const keys = Object.keys(versionInfos);
  keys.sort((a, b) => semver.rcompare(a, b));
  return keys[0];
};

module.exports = { isVersionSupported, supportedVersion, resolveLatest };
