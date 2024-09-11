const semver = require("semver");

const doCheck = (version, versionInfos, scVersion) => {
  if (!versionInfos[version])
    throw new Error(`Version ${version} not found in available versions`);
  const scEngine = versionInfos[version].engines?.saltcorn;
  if (!scEngine) return true;
  return semver.satisfies(scVersion, scEngine);
};

/**
 *
 * @param {*} wantedVersion
 * @param {*} versionInfos
 * @param {*} scVersion
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
 *
 * @param {*} version
 * @param {*} versionInfos
 * @param {*} scVersion
 * @returns
 */
const isVersionSupported = (version, versionInfos, scVersion) => {
  return doCheck(version, versionInfos, scVersion);
};

/**
 *
 * @param {*} versionInfos
 * @returns
 */
const resolveLatest = (versionInfos) => {
  const keys = Object.keys(versionInfos);
  keys.sort((a, b) => semver.rcompare(a, b));
  return keys[0];
};

module.exports = { isVersionSupported, supportedVersion, resolveLatest };
