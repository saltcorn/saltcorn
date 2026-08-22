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

// Builds a too-large tarball and runs it through the real extractTarball,
// unlike the pure checks above. Fixture files live under a temp dir that's
// always removed afterwards, pass or fail.
describe("extractTarball end-to-end", () => {
  it("rejects a real tarball past the entry cap and extracts a normal one fine", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "saltcorn-tarball-guard-"));
    try {
      const srcDir = join(workDir, "package");
      await mkdir(srcDir, { recursive: true });
      const fileNames = Array.from({ length: MAX_TARBALL_ENTRIES + 1 }, (_, i) =>
        join("package", `f${i}`)
      );
      const BATCH = 1000;
      for (let i = 0; i < fileNames.length; i += BATCH) {
        await Promise.all(
          fileNames
            .slice(i, i + BATCH)
            .map((name) => writeFile(join(workDir, name), ""))
        );
      }
      const bombFile = join(workDir, "bomb.tar");
      // pass the explicit file list, not the "package" directory itself -
      // create() emits a "package/" directory entry for the latter, which
      // would throw off the exact entry count this test pins below
      await create({ file: bombFile, cwd: workDir }, fileNames);

      const bombDest = join(workDir, "bomb-dest");
      await mkdir(bombDest);
      await expect(extractTarball(bombFile, bombDest)).rejects.toThrow(
        "Refusing to extract"
      );
      // bounded, not zero: the guard trips once the count crosses the cap,
      // so exactly MAX_TARBALL_ENTRIES legit-looking entries land first
      expect((await readdir(bombDest)).length).toBe(MAX_TARBALL_ENTRIES);

      const goodSrcDir = join(workDir, "good-package");
      await mkdir(goodSrcDir, { recursive: true });
      await writeFile(join(goodSrcDir, "index.js"), "module.exports = {};");
      const goodFile = join(workDir, "good.tar");
      await create({ file: goodFile, cwd: workDir }, ["good-package"]);

      const goodDest = join(workDir, "good-dest");
      await mkdir(goodDest);
      await extractTarball(goodFile, goodDest);
      expect(await readdir(goodDest)).toStrictEqual(["index.js"]);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
