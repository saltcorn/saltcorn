/**
 * Extracting a zip archive.
 *
 * The reading side is unzipper's: it reads the central directory up front and
 * then streams each entry from the file, through decryption and inflation, to
 * its destination, so nothing larger than a few buffers is ever held in
 * memory and inflation runs on libuv's thread pool. That is why this does not
 * need the worker thread the writing side uses - the CPU work is already off
 * the event loop.
 *
 * What is added here is what unzipper leaves to its caller: entries are
 * checked against the CRC and length the archive claims for them, names that
 * would escape the target directory are refused rather than quietly skipped,
 * and the password errors are turned into something the admin UI can prompt
 * on.
 *
 * @category saltcorn-admin-models
 * @module models/zip-extract
 */
import { Open } from "unzipper";
import type { File as ZipEntry } from "unzipper";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { dirname, join, resolve, sep } from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { crc32 } from "./zip-format.js";

/** An error the caller can turn into a "this backup needs a password" prompt */
const passwordError = (message: string): Error => {
  const e: any = new Error(message);
  e.requiresPassword = true;
  return e;
};

/**
 * unzipper reports a missing or wrong password by throwing these; everything
 * else it throws is a genuinely broken archive.
 */
const asPasswordError = (e: any, name: string): Error | undefined => {
  if (e?.message === "MISSING_PASSWORD")
    return passwordError(`Zip entry ${name} is encrypted`);
  if (e?.message === "BAD_PASSWORD")
    return passwordError(`Wrong password for zip entry ${name}`);
  return undefined;
};

/** Runs the CRC and length of the data flowing through it */
const checksumStream = (report: (crc: number, size: number) => void) => {
  let crc = 0;
  let size = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      crc = crc32(chunk, crc);
      size += chunk.length;
      callback(null, chunk);
    },
    flush(callback) {
      report(crc, size);
      callback();
    },
  });
};

/** The mode to create an entry with, from its unix permissions if it has any */
const entryMode = (entry: ZipEntry): number =>
  (entry.externalFileAttributes >>> 16) & 0o7777 ||
  (entry.type === "Directory" ? 0o755 : 0o644);

const extractEntry = async (
  entry: ZipEntry,
  target: string,
  password?: string
): Promise<void> => {
  let crc = 0;
  let size = 0;
  try {
    await pipeline(
      entry.stream(password),
      checksumStream((c, s) => {
        crc = c;
        size = s;
      }),
      createWriteStream(target, { mode: entryMode(entry) })
    );
  } catch (e: any) {
    throw asPasswordError(e, entry.path) || e;
  }
  if (size !== entry.uncompressedSize || crc !== entry.crc32)
    throw new Error(`Zip entry ${entry.path} is corrupted`);
};

/**
 * Extract a zip file to a directory.
 *
 * Entry names are confined to that directory: a name climbing out of it
 * (".." or an absolute path) is an attempt at a zip slip and is refused.
 *
 * @param fnm path of the zip file
 * @param dir directory to extract into
 * @param password password for encrypted archives. If the archive is
 *   encrypted and this is missing or wrong, the thrown error carries
 *   `requiresPassword: true`.
 */
export const extractZip = async (
  fnm: string,
  dir: string,
  password?: string
): Promise<void> => {
  const root = resolve(dir);
  await mkdir(root, { recursive: true });

  const safeTarget = (name: string): string => {
    const target = resolve(join(root, name));
    if (target !== root && !target.startsWith(root + sep))
      throw new Error(`Refusing to extract ${name} outside the target`);
    return target;
  };

  const archive = await Open.file(fnm);
  for (const entry of archive.files) {
    const target = safeTarget(entry.path);
    if (entry.type === "Directory") {
      await mkdir(target, { recursive: true });
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await extractEntry(entry, target, password || undefined);
  }
};
