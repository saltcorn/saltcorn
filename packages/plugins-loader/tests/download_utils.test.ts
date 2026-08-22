import { mkdtemp, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create } from "tar";
import { describe, it, expect } from "@saltcorn/db-common/test_expect";
import {
  exceedsTarballLimits,
  extractTarball,
  MAX_TARBALL_ENTRIES,
  MAX_TARBALL_BYTES,
} from "../download_utils.js";

// Exercises the decompression-bomb guard's threshold logic directly, so the
// 2GB/100k-entry markers are proven to trip without ever extracting (or
// writing) a real oversized tarball.
describe("extractTarball size/entry guard", () => {
  it("pins the byte cap at 2GB", () => {
    expect(MAX_TARBALL_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });

  it("pins the entry-count cap at 100k", () => {
    expect(MAX_TARBALL_ENTRIES).toBe(100_000);
  });

  it("allows a tarball right at the byte cap", () => {
    expect(exceedsTarballLimits(1, MAX_TARBALL_BYTES)).toBe(false);
  });

  it("rejects a tarball one byte past the 2GB marker", () => {
    expect(exceedsTarballLimits(1, MAX_TARBALL_BYTES + 1)).toBe(true);
  });

  it("allows a tarball right at the entry-count cap", () => {
    expect(exceedsTarballLimits(MAX_TARBALL_ENTRIES, 0)).toBe(false);
  });

  it("rejects a tarball one entry past the count cap", () => {
    expect(exceedsTarballLimits(MAX_TARBALL_ENTRIES + 1, 0)).toBe(true);
  });

  it("rejects well before the byte cap once the entry cap is hit, e.g. a many-tiny-files bomb", () => {
    expect(exceedsTarballLimits(MAX_TARBALL_ENTRIES + 1, 1)).toBe(true);
  });
});

// Runs real tarballs through extractTarball itself, with small test caps
// so no giant fixtures are needed. Fixtures always get cleaned up.
describe("extractTarball end-to-end", () => {
  const TEST_MAX_ENTRIES = 5;
  const TEST_MAX_BYTES = 20;

  it("rejects a real tarball past the entry cap", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "saltcorn-tarball-guard-"));
    try {
      const fileNames = Array.from(
        { length: TEST_MAX_ENTRIES + 1 },
        (_, i) => join("package", `f${i}`)
      );
      await mkdir(join(workDir, "package"), { recursive: true });
      await Promise.all(
        fileNames.map((name) => writeFile(join(workDir, name), ""))
      );
      const bombFile = join(workDir, "bomb.tar");
      // explicit file list, not the "package" dir - avoids an extra dir entry
      await create({ file: bombFile, cwd: workDir }, fileNames);

      const dest = join(workDir, "dest");
      await mkdir(dest);
      await expect(
        extractTarball(bombFile, dest, TEST_MAX_ENTRIES, TEST_MAX_BYTES)
      ).rejects.toThrow("Refusing to extract");
      // bounded, not zero: entries up to the cap are written before it trips
      expect((await readdir(dest)).length).toBe(TEST_MAX_ENTRIES);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it("rejects a real tarball past the byte cap", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "saltcorn-tarball-guard-"));
    try {
      await mkdir(join(workDir, "package"), { recursive: true });
      // one file already bigger than TEST_MAX_BYTES, so it's rejected outright
      await writeFile(
        join(workDir, "package", "big.txt"),
        "x".repeat(TEST_MAX_BYTES + 1)
      );
      const bombFile = join(workDir, "bomb.tar");
      await create({ file: bombFile, cwd: workDir }, ["package/big.txt"]);

      const dest = join(workDir, "dest");
      await mkdir(dest);
      await expect(
        extractTarball(bombFile, dest, TEST_MAX_ENTRIES, TEST_MAX_BYTES)
      ).rejects.toThrow("Refusing to extract");
      expect(await readdir(dest)).toStrictEqual([]);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it("extracts a normal tarball under both caps", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "saltcorn-tarball-guard-"));
    try {
      await mkdir(join(workDir, "package"), { recursive: true });
      await writeFile(join(workDir, "package", "index.js"), "module.exports = {};");
      const goodFile = join(workDir, "good.tar");
      await create({ file: goodFile, cwd: workDir }, ["package"]);

      const dest = join(workDir, "dest");
      await mkdir(dest);
      await extractTarball(goodFile, dest, TEST_MAX_ENTRIES, TEST_MAX_BYTES);
      expect(await readdir(dest)).toStrictEqual(["index.js"]);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
