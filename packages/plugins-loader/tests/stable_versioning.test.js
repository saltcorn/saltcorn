const npmFetch = require("npm-registry-fetch");
const semver = require("semver");

const { supportedVersion } = require("../stable_versioning");

jest.setTimeout(30000);

const getSortedKeys = (pkgInfo) => {
  const keys = [...Object.keys(pkgInfo.versions)];
  keys.sort((a, b) => semver.rcompare(a, b));
  return keys;
};

describe("Stable versioning", () => {
  it("resolves latest to a previous supported version", async () => {
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
  });

  it("resolves latest to the current version (all engine properties are missing)", async () => {
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
  });

  it("resolves latest to a version without the engines property", async () => {
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
