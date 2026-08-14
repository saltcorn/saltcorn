/**
 * A streaming ZIP reader.
 *
 * The central directory is read up front (it is small - a few dozen bytes per
 * entry), then each entry is streamed from the file, through decryption and
 * inflation, to its destination. Nothing larger than a few buffers is ever
 * held in memory, and inflation runs on libuv's thread pool.
 *
 * Understands zip64, entries written with a data descriptor, and the
 * traditional zip password encryption.
 *
 * @category saltcorn-admin-models
 * @module models/zip-reader
 */
import { createInflateRaw } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, open } from "fs/promises";
import type { FileHandle } from "fs/promises";
import { dirname, join, resolve, sep } from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import {
  CENTRAL_HEADER_SIZE,
  CENTRAL_SIG,
  EOCD_SIG,
  EOCD_SIZE,
  FLAG_DESCRIPTOR,
  FLAG_ENCRYPTED,
  FLAG_UTF8,
  LOCAL_HEADER_SIZE,
  METHOD_DEFLATED,
  METHOD_STORED,
  UINT16_MAX,
  UINT32_MAX,
  ZIP64_EOCD_SIG,
  ZIP64_LOCATOR_SIG,
  ZIP64_LOCATOR_SIZE,
  ZipCrypto,
  crc32,
  fromDosDateTime,
  parseZip64Extra,
  readUInt64,
} from "./zip-format.js";

export type ZipEntryInfo = {
  name: string;
  isDirectory: boolean;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
  mode: number;
  mtime: Date;
  /** the raw MS-DOS time field, which encrypted entries check against */
  dosTime: number;
};

/** An error the caller can turn into a "this backup needs a password" prompt */
const passwordError = (message: string): Error => {
  const e: any = new Error(message);
  e.requiresPassword = true;
  return e;
};

/**
 * Strips and checks the 12 byte encryption header, then decrypts the rest of
 * the entry as it flows past.
 */
const decryptStream = (
  password: string,
  checkByte: number,
  name: string
): Transform => {
  const crypto = new ZipCrypto(password);
  let headerLeft = 12;
  let header: Buffer[] = [];
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      let data = crypto.decrypt(chunk);
      if (headerLeft > 0) {
        const take = Math.min(headerLeft, data.length);
        header.push(data.subarray(0, take));
        data = data.subarray(take);
        headerLeft -= take;
        if (headerLeft === 0) {
          const salt = Buffer.concat(header);
          if (salt[11] !== checkByte)
            return callback(
              passwordError(`Wrong password for zip entry ${name}`)
            );
        }
      }
      callback(null, data);
    },
  });
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

export class ZipStreamReader {
  private path: string;
  private password?: string;
  private zipEntries: ZipEntryInfo[] = [];
  /** open for the duration of an extraction, to read local headers */
  private headers?: FileHandle;

  private constructor(path: string, password?: string) {
    this.path = path;
    this.password = password || undefined;
  }

  static async open(path: string, password?: string): Promise<ZipStreamReader> {
    const reader = new ZipStreamReader(path, password);
    await reader.readCentralDirectory();
    return reader;
  }

  entries(): ZipEntryInfo[] {
    return this.zipEntries;
  }

  /**
   * Locate and parse the end of central directory record - it is at the end
   * of the file, behind a comment of unknown length - then the zip64 records
   * it may point at, then the central directory itself.
   */
  private async readCentralDirectory(): Promise<void> {
    const fh = await open(this.path, "r");
    try {
      const size = (await fh.stat()).size;
      // the comment is at most 64k, so the record starts within the last 64k+22
      const tailLength = Math.min(size, UINT16_MAX + EOCD_SIZE);
      const tail = Buffer.alloc(tailLength);
      await fh.read(tail, 0, tailLength, size - tailLength);

      let eocdAt = -1;
      for (let i = tail.length - EOCD_SIZE; i >= 0; i--) {
        if (
          tail.readUInt32LE(i) === EOCD_SIG &&
          i + EOCD_SIZE + tail.readUInt16LE(i + 20) === tail.length
        ) {
          eocdAt = i;
          break;
        }
      }
      if (eocdAt < 0)
        throw new Error("Not a zip file: no end of central directory record");

      let entryCount = tail.readUInt16LE(eocdAt + 10);
      let centralSize = tail.readUInt32LE(eocdAt + 12);
      let centralOffset = tail.readUInt32LE(eocdAt + 16);

      if (
        entryCount === UINT16_MAX ||
        centralSize === UINT32_MAX ||
        centralOffset === UINT32_MAX
      ) {
        const locatorAt = eocdAt - ZIP64_LOCATOR_SIZE;
        if (locatorAt < 0 || tail.readUInt32LE(locatorAt) !== ZIP64_LOCATOR_SIG)
          throw new Error("Zip file needs zip64 but has no zip64 locator");
        const zip64At = readUInt64(tail, locatorAt + 8);
        const zip64 = Buffer.alloc(56);
        await fh.read(zip64, 0, 56, zip64At);
        if (zip64.readUInt32LE(0) !== ZIP64_EOCD_SIG)
          throw new Error(
            "Zip file has a damaged zip64 end of central directory"
          );
        entryCount = readUInt64(zip64, 32);
        centralSize = readUInt64(zip64, 40);
        centralOffset = readUInt64(zip64, 48);
      }

      const central = Buffer.alloc(centralSize);
      await fh.read(central, 0, centralSize, centralOffset);
      this.parseCentralDirectory(central, entryCount);
    } finally {
      await fh.close();
    }
  }

  private parseCentralDirectory(central: Buffer, entryCount: number): void {
    let pos = 0;
    for (let i = 0; i < entryCount; i++) {
      if (pos + CENTRAL_HEADER_SIZE > central.length) break;
      if (central.readUInt32LE(pos) !== CENTRAL_SIG)
        throw new Error("Zip file has a damaged central directory");
      const flags = central.readUInt16LE(pos + 8);
      const nameLength = central.readUInt16LE(pos + 28);
      const extraLength = central.readUInt16LE(pos + 30);
      const commentLength = central.readUInt16LE(pos + 32);
      const nameAt = pos + CENTRAL_HEADER_SIZE;
      const name = central
        .subarray(nameAt, nameAt + nameLength)
        .toString(flags & FLAG_UTF8 ? "utf8" : "latin1");
      const extra = central.subarray(
        nameAt + nameLength,
        nameAt + nameLength + extraLength
      );

      let uncompressedSize = central.readUInt32LE(pos + 24);
      let compressedSize = central.readUInt32LE(pos + 20);
      let offset = central.readUInt32LE(pos + 42);
      const zip64 = parseZip64Extra(extra, {
        uncompressedSize: uncompressedSize === UINT32_MAX,
        compressedSize: compressedSize === UINT32_MAX,
        offset: offset === UINT32_MAX,
      });
      if (zip64.uncompressedSize !== undefined)
        uncompressedSize = zip64.uncompressedSize;
      if (zip64.compressedSize !== undefined)
        compressedSize = zip64.compressedSize;
      if (zip64.offset !== undefined) offset = zip64.offset;

      const externalAttrs = central.readUInt32LE(pos + 38);
      const unixMode = (externalAttrs >>> 16) & 0o7777;
      const isDirectory =
        name.endsWith("/") || (!!(externalAttrs & 0x10) && !compressedSize);

      const dosTime = central.readUInt16LE(pos + 12);
      this.zipEntries.push({
        name,
        isDirectory,
        method: central.readUInt16LE(pos + 10),
        flags,
        crc: central.readUInt32LE(pos + 16),
        compressedSize,
        uncompressedSize,
        offset,
        mode: unixMode || (isDirectory ? 0o755 : 0o644),
        mtime: fromDosDateTime(dosTime, central.readUInt16LE(pos + 14)),
        dosTime,
      });
      pos = nameAt + nameLength + extraLength + commentLength;
    }
  }

  /**
   * Where an entry's data starts: only its own local header knows how long
   * its name and extra field are there.
   */
  private async dataOffset(entry: ZipEntryInfo): Promise<number> {
    const header = Buffer.alloc(LOCAL_HEADER_SIZE);
    await this.headers!.read(header, 0, LOCAL_HEADER_SIZE, entry.offset);
    return (
      entry.offset +
      LOCAL_HEADER_SIZE +
      header.readUInt16LE(26) +
      header.readUInt16LE(28)
    );
  }

  /**
   * Extract every entry into a directory. Entry names are confined to that
   * directory: a name climbing out of it (".." or an absolute path) is an
   * attempt at a zip slip and is refused.
   */
  async extractAllTo(dir: string): Promise<void> {
    const root = resolve(dir);
    await mkdir(root, { recursive: true });

    const safeTarget = (name: string): string => {
      const target = resolve(join(root, name));
      if (target !== root && !target.startsWith(root + sep))
        throw new Error(`Refusing to extract ${name} outside the target`);
      return target;
    };

    // one handle for all the local header reads, rather than one per entry
    this.headers = await open(this.path, "r");
    try {
      for (const entry of this.zipEntries) {
        const target = safeTarget(entry.name);
        if (entry.isDirectory) {
          await mkdir(target, { recursive: true });
          continue;
        }
        await mkdir(dirname(target), { recursive: true });
        await this.extractEntry(entry, target);
      }
    } finally {
      await this.headers.close();
      this.headers = undefined;
    }
  }

  private async extractEntry(
    entry: ZipEntryInfo,
    target: string
  ): Promise<void> {
    const encrypted = !!(entry.flags & FLAG_ENCRYPTED);
    if (encrypted && !this.password)
      throw passwordError(`Zip entry ${entry.name} is encrypted`);
    if (entry.method !== METHOD_STORED && entry.method !== METHOD_DEFLATED)
      throw new Error(
        `Zip entry ${entry.name} uses unsupported compression method ${entry.method}`
      );

    const out = createWriteStream(target, { mode: entry.mode });
    if (entry.compressedSize === 0) {
      out.end();
      await new Promise<void>((res, rej) => {
        out.on("finish", () => res());
        out.on("error", rej);
      });
      return;
    }

    const start = await this.dataOffset(entry);
    const stages: any[] = [
      createReadStream(this.path, {
        start,
        end: start + entry.compressedSize - 1,
      }),
    ];
    if (encrypted)
      stages.push(
        decryptStream(
          this.password!,
          // with a data descriptor the CRC is not in the local header, so
          // the check byte is taken from the modification time instead
          entry.flags & FLAG_DESCRIPTOR
            ? (entry.dosTime >>> 8) & 0xff
            : (entry.crc >>> 24) & 0xff,
          entry.name
        )
      );
    if (entry.method === METHOD_DEFLATED) stages.push(createInflateRaw());
    let crc = 0;
    let size = 0;
    stages.push(
      checksumStream((c, s) => {
        crc = c;
        size = s;
      })
    );
    stages.push(out);

    await pipeline(stages);

    if (size !== entry.uncompressedSize || crc !== entry.crc)
      throw new Error(`Zip entry ${entry.name} is corrupted`);
  }
}
