import { parseGlobList, matchesAnyGlob } from "../models/file-globs.js";
import { describe, it, expect } from "@saltcorn/db-common/test_expect";

const matches = (globs: string, path: string) =>
  matchesAnyGlob(parseGlobList(globs), path);

describe("parseGlobList", () => {
  it("ignores empty and blank entries", () => {
    expect(parseGlobList("")).toHaveLength(0);
    expect(parseGlobList(null)).toHaveLength(0);
    expect(parseGlobList(undefined)).toHaveLength(0);
    expect(parseGlobList(" , ,")).toHaveLength(0);
    expect(parseGlobList("*.mp4, *.mov")).toHaveLength(2);
  });
});

describe("matchesAnyGlob", () => {
  it("matches nothing when there are no globs", () => {
    expect(matches("", "foo.png")).toBe(false);
  });

  it("matches by extension in any folder", () => {
    expect(matches("*.mp4", "movie.mp4")).toBe(true);
    expect(matches("*.mp4", "uploads/holiday/movie.mp4")).toBe(true);
    expect(matches("*.mp4", "movie.mp4.txt")).toBe(false);
    expect(matches("*.mp4", "movie.png")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(matches("*.jpg", "IMG_0001.JPG")).toBe(true);
    expect(matches("Cache/**", "cache/thumb.png")).toBe(true);
  });

  it("matches any glob in the list", () => {
    expect(matches("*.mp4, *.mov", "clip.mov")).toBe(true);
    expect(matches(" *.mp4 , *.mov ", "clip.mp4")).toBe(true);
    expect(matches("*.mp4, *.mov", "clip.avi")).toBe(false);
  });

  it("anchors the match", () => {
    expect(matches("report.pdf", "report.pdf")).toBe(true);
    expect(matches("report.pdf", "old_report.pdf")).toBe(false);
    expect(matches("report", "report.pdf")).toBe(false);
  });

  it("does not let * cross directory separators", () => {
    expect(matches("uploads/*.png", "uploads/logo.png")).toBe(true);
    expect(matches("uploads/*.png", "uploads/icons/logo.png")).toBe(false);
    expect(matches("uploads/**/*.png", "uploads/icons/logo.png")).toBe(true);
  });

  it("matches a whole subtree with **", () => {
    expect(matches("cache/**", "cache/a.png")).toBe(true);
    expect(matches("cache/**", "cache/deep/nested/a.png")).toBe(true);
    expect(matches("cache/**", "notcache/a.png")).toBe(false);
  });

  it("matches the directory itself for a subtree glob", () => {
    expect(matchesAnyGlob(parseGlobList("cache/**"), "cache", true)).toBe(true);
    expect(matchesAnyGlob(parseGlobList("cache/**"), "cache", false)).toBe(
      false
    );
    expect(matchesAnyGlob(parseGlobList("cache/**"), "other", true)).toBe(
      false
    );
  });

  it("supports ? and character classes", () => {
    expect(matches("photo?.png", "photo1.png")).toBe(true);
    expect(matches("photo?.png", "photo12.png")).toBe(false);
    expect(matches("photo[0-9].png", "photo7.png")).toBe(true);
    expect(matches("photo[0-9].png", "photox.png")).toBe(false);
  });

  it("treats dots in globs literally", () => {
    expect(matches("a.b", "axb")).toBe(false);
  });

  it("normalises leading slashes and backslashes", () => {
    expect(matches("cache/**", "/cache/a.png")).toBe(true);
    expect(matches("cache/*.png", "cache\\a.png")).toBe(true);
  });
});
