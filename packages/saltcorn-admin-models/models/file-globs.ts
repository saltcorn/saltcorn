/**
 * Glob matching for file paths, used to exclude files from backups.
 *
 * Globs are compiled by the glob-to-regexp package with extended syntax:
 * `*` (any run of characters within one path segment), `**` (any run of
 * characters, crossing directory separators), `?` (a single character) and
 * `[abc]` character classes. Matching is case-insensitive. Brace alternation
 * is not available here because the comma is the list separator.
 *
 * I/O-free, so it is unit-testable without a database.
 * @category saltcorn-admin-models
 * @module models/file-globs
 */

import globToRegExp from "glob-to-regexp";

/**
 * Compile a comma separated list of globs. Blank entries are ignored, so an
 * empty or unset setting yields an empty list (which matches nothing).
 * @param globs comma separated globs
 * @returns compiled patterns
 */
export const parseGlobList = (globs?: string | null): RegExp[] =>
  (globs || "")
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .map((g) =>
      globToRegExp(g, { extended: true, globstar: true, flags: "i" })
    );

/**
 * Does a file match any of the compiled globs?
 *
 * The path is tested in full and by basename, so `*.mp4` excludes videos in
 * any folder while `movies/*.mp4` excludes only those in `movies`. Directories
 * are also tested with a trailing separator, so `cache/**` excludes the
 * `cache` directory itself as well as everything below it.
 * @param patterns compiled globs, from parseGlobList()
 * @param filePath path of the file relative to the file store
 * @param isDirectory whether the path is a directory
 * @returns true if the path matches any pattern
 */
export const matchesAnyGlob = (
  patterns: RegExp[],
  filePath: string,
  isDirectory: boolean = false
): boolean => {
  if (patterns.length === 0) return false;
  const normalised = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const candidates = [normalised, normalised.split("/").pop() || normalised];
  if (isDirectory) candidates.push(`${normalised}/`);
  return patterns.some((re) => candidates.some((c) => re.test(c)));
};
