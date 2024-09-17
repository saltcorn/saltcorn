const npmFetch = require("npm-registry-fetch");
const semver = require("semver");

const {
  supportedVersion,
  isVersionSupported,
} = require("../stable_versioning");

jest.setTimeout(30000);

const getSortedKeys = (pkgInfo) => {
  const keys = [...Object.keys(pkgInfo.versions)];
  keys.sort((a, b) => semver.rcompare(a, b));
  return keys;
};

describe("Stable versioning", () => {
  it("stays compatible to version 1.0.0", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    pkgInfo.versions[sortedKeys[0]].engines = { saltcorn: ">=1.0.1" };
    pkgInfo.versions[sortedKeys[1]].engines = { saltcorn: ">=1.0.1-beta.1" };
    pkgInfo.versions[sortedKeys[2]].engines = { saltcorn: "<=1.0.0" };
    pkgInfo.versions[sortedKeys[3]].engines = { saltcorn: ">=1.0.0-beta.1" };
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[2]);
    expect(isVersionSupported(sortedKeys[0], pkgInfo.versions, scVersion)).toBe(
      false
    );
    expect(isVersionSupported(sortedKeys[1], pkgInfo.versions, scVersion)).toBe(
      false
    );
    expect(isVersionSupported(sortedKeys[2], pkgInfo.versions, scVersion)).toBe(
      true
    );
    expect(isVersionSupported(sortedKeys[3], pkgInfo.versions, scVersion)).toBe(
      true
    );
  });

  it("picks one fixed version instead of a range", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    pkgInfo.versions[sortedKeys[0]].engines = { saltcorn: ">=1.0.1" };
    pkgInfo.versions[sortedKeys[1]].engines = { saltcorn: ">=1.0.1-beta.1" };
    pkgInfo.versions[sortedKeys[2]].engines = { saltcorn: "1.0.0" };
    pkgInfo.versions[sortedKeys[3]].engines = { saltcorn: ">=1.0.0-beta.1" };
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[2]);
    expect(isVersionSupported(sortedKeys[0], pkgInfo.versions, scVersion)).toBe(
      false
    );
    expect(isVersionSupported(sortedKeys[1], pkgInfo.versions, scVersion)).toBe(
      false
    );
    expect(isVersionSupported(sortedKeys[2], pkgInfo.versions, scVersion)).toBe(
      true
    );
    expect(isVersionSupported(sortedKeys[3], pkgInfo.versions, scVersion)).toBe(
      true
    );
  });

  it("warns and takes invalid engine properties", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    pkgInfo.versions[sortedKeys[0]].engines = { saltcorn: ">=1.0.1" };
    // invalid: >=1.0.1.beta.1 should be >=1.0.1-beta.1
    pkgInfo.versions[sortedKeys[1]].engines = { saltcorn: ">=1.0.1.beta.1" };
    pkgInfo.versions[sortedKeys[2]].engines = { saltcorn: "<=1.0.0" };
    pkgInfo.versions[sortedKeys[3]].engines = { saltcorn: ">=1.0.0-beta.1" };
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[1]);
  });

  it("downgrades latest with greater equal", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0-beta.6";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    pkgInfo.versions[sortedKeys[0]].engines = { saltcorn: ">=1.0.0-beta.7" };
    pkgInfo.versions[sortedKeys[1]].engines = { saltcorn: ">=1.0.0-beta.6" };
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[1]);
    expect(isVersionSupported(result, pkgInfo.versions, scVersion)).toBe(true);
    expect(isVersionSupported(sortedKeys[0], pkgInfo.versions, scVersion)).toBe(
      false
    );
  });

  it("takes latest with smaller equal", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0-beta.6";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    pkgInfo.versions[sortedKeys[0]].engines = { saltcorn: "<=1.0.0-beta.7" };
    pkgInfo.versions[sortedKeys[1]].engines = { saltcorn: "<=1.0.0-beta.6" };
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[0]);
    expect(isVersionSupported(result, pkgInfo.versions, scVersion)).toBe(true);
    expect(isVersionSupported(sortedKeys[0], pkgInfo.versions, scVersion)).toBe(
      true
    );
  });

  it("resolves latest to the current version", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0-beta.6";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    pkgInfo.versions[sortedKeys[0]].engines = { saltcorn: ">=1.0.0-beta.6" };
    pkgInfo.versions[sortedKeys[1]].engines = { saltcorn: ">=1.0.0-beta.6" };
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[0]);
    expect(isVersionSupported(result, pkgInfo.versions, scVersion)).toBe(true);
    expect(isVersionSupported(sortedKeys[1], pkgInfo.versions, scVersion)).toBe(
      true
    );
  });

  it("it takes the latest version, all engine properties are missing", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0-beta.6";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    for (const key of sortedKeys) pkgInfo.versions[key].engines = undefined;
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[0]);
    expect(isVersionSupported(result, pkgInfo.versions, scVersion)).toBe(true);
    expect(isVersionSupported(sortedKeys[1], pkgInfo.versions, scVersion)).toBe(
      true
    );
  });

  it("takes a version without the engines property", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0-beta.6";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    pkgInfo.versions[sortedKeys[0]].engines = { saltcorn: ">=1.0.0-beta.7" };
    pkgInfo.versions[sortedKeys[1]].engines = { saltcorn: ">=1.0.0-beta.7" };
    pkgInfo.versions[sortedKeys[2]].engines = undefined;
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBe(sortedKeys[2]);
    expect(isVersionSupported(result, pkgInfo.versions, scVersion)).toBe(true);
    expect(isVersionSupported(sortedKeys[0], pkgInfo.versions, scVersion)).toBe(
      false
    );
    expect(isVersionSupported(sortedKeys[1], pkgInfo.versions, scVersion)).toBe(
      false
    );
    expect(isVersionSupported(sortedKeys[2], pkgInfo.versions, scVersion)).toBe(
      true
    );
  });

  it("finds no supported version", async () => {
    const wantedVersion = "latest";
    const scVersion = "1.0.0-beta.6";
    const plugin = {
      location: "@saltcorn/html",
      version: wantedVersion,
    };
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`
    );
    const sortedKeys = getSortedKeys(pkgInfo);
    for (const key of sortedKeys)
      pkgInfo.versions[key].engines = { saltcorn: ">=1.0.0-beta.7" };
    const result = supportedVersion(
      plugin.version,
      pkgInfo.versions,
      scVersion
    );
    expect(result).toBeNull();
  });
});
