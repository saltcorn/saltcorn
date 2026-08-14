/**
 * A streaming ZIP writer.
 *
 * Entries are compressed and written out as they are added, so the archive is
 * never held in memory: a backup of a 50 GB file store needs no more memory
 * than a few buffers, whatever its size. Deflation runs on libuv's thread
 * pool (zlib's streaming API), and the whole writer is driven from the zip
 * worker thread, so nothing here competes with the server's event loop.
 *
 * Sizes and CRCs are not known until an entry has been written, so entries
 * carry a data descriptor (general purpose bit 3) instead. Entries larger
 * than ZIP64_THRESHOLD are written in zip64 format, which lifts the 4 GiB
 * limit on entry and archive size.
 *
 * @category saltcorn-admin-models
 * @module models/zip-writer
 */
import { createDeflateRaw } from "zlib";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { randomBytes } from "crypto";
import { Readable, Writable } from "stream";
import { once } from "events";
import {
  CENTRAL_HEADER_SIZE,
  CENTRAL_SIG,
  DESCRIPTOR_SIG,
  EOCD_SIG,
  EOCD_SIZE,
  FLAG_DESCRIPTOR,
  FLAG_ENCRYPTED,
  FLAG_UTF8,
  LOCAL_HEADER_SIZE,
  LOCAL_SIG,
  METHOD_DEFLATED,
  METHOD_STORED,
  UINT16_MAX,
  UINT32_MAX,
  ZIP64_EOCD_SIG,
  ZIP64_EOCD_SIZE,
  ZIP64_EXTRA_ID,
  ZIP64_LOCATOR_SIG,
  ZIP64_LOCATOR_SIZE,
  ZIP64_THRESHOLD,
  ZipCrypto,
  crc32,
  dosDateTime,
  writeUInt64,
} from "./zip-format.js";

type WrittenEntry = {
  name: Buffer;
  flags: number;
  method: number;
  time: number;
  date: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
  mode: number;
  isDirectory: boolean;
  zip64: boolean;
};

export type ZipWriterOptions = {
  /** encrypt entries with the traditional zip password scheme */
  password?: string;
  /** deflate level, 0-9. 5 trades a little size for a lot of speed */
  level?: number;
  /** size at which an entry is written in zip64 format. Tests lower it */
  zip64Threshold?: number;
  /**
   * How much of an entry of unknown size is read before committing to a
   * format. Entries that end within this are written in the classic format,
   * which every reader understands; longer ones get zip64.
   */
  probeLimit?: number;
};

export class ZipStreamWriter {
  private out: Writable;
  private password?: string;
  private level: number;
  private zip64Threshold: number;
  private probeLimit: number;
  private offset: number = 0;
  private entries: WrittenEntry[] = [];
  private names: Set<string> = new Set();

  constructor(out: Writable, options: ZipWriterOptions = {}) {
    this.out = out;
    this.password = options.password || undefined;
    this.level = options.level ?? 5;
    this.zip64Threshold = options.zip64Threshold ?? ZIP64_THRESHOLD;
    this.probeLimit = options.probeLimit ?? 32 * 1024 * 1024;
  }

  /** Write to the output, respecting its backpressure */
  private async put(buf: Buffer): Promise<void> {
    if (!this.out.write(buf)) await once(this.out, "drain");
    this.offset += buf.length;
  }

  /**
   * Zip entry names are always forward-slash separated and never absolute.
   * A duplicate name would make the archive ambiguous, so it is an error.
   */
  private entryName(name: string, isDirectory: boolean): Buffer {
    let clean = name.replace(/\\/g, "/").replace(/^\/+/, "");
    if (isDirectory && !clean.endsWith("/")) clean += "/";
    if (this.names.has(clean)) throw new Error(`Duplicate zip entry: ${clean}`);
    this.names.add(clean);
    return Buffer.from(clean, "utf8");
  }

  /**
   * The local file header. When an entry is zip64 the header carries a
   * zip64 extra field with placeholder sizes, which is what tells a reader
   * that the trailing data descriptor has 8-byte sizes.
   */
  private localHeader(entry: WrittenEntry): Buffer {
    const extraSize = entry.zip64 ? 20 : 0;
    const buf = Buffer.alloc(LOCAL_HEADER_SIZE + entry.name.length + extraSize);
    buf.writeUInt32LE(LOCAL_SIG, 0);
    buf.writeUInt16LE(entry.zip64 ? 45 : 20, 4);
    buf.writeUInt16LE(entry.flags, 6);
    buf.writeUInt16LE(entry.method, 8);
    buf.writeUInt16LE(entry.time, 10);
    buf.writeUInt16LE(entry.date, 12);
    // crc and sizes follow in the data descriptor, except for entries
    // written whole (directories), which have nothing to describe
    buf.writeUInt32LE(entry.crc, 14);
    buf.writeUInt32LE(entry.zip64 ? UINT32_MAX : entry.compressedSize, 18);
    buf.writeUInt32LE(entry.zip64 ? UINT32_MAX : entry.uncompressedSize, 22);
    buf.writeUInt16LE(entry.name.length, 26);
    buf.writeUInt16LE(extraSize, 28);
    entry.name.copy(buf, LOCAL_HEADER_SIZE);
    if (entry.zip64) {
      const at = LOCAL_HEADER_SIZE + entry.name.length;
      buf.writeUInt16LE(ZIP64_EXTRA_ID, at);
      buf.writeUInt16LE(16, at + 2);
      writeUInt64(buf, entry.uncompressedSize, at + 4);
      writeUInt64(buf, entry.compressedSize, at + 12);
    }
    return buf;
  }

  /** The data descriptor written after an entry's data */
  private dataDescriptor(entry: WrittenEntry): Buffer {
    const buf = Buffer.alloc(entry.zip64 ? 24 : 16);
    buf.writeUInt32LE(DESCRIPTOR_SIG, 0);
    buf.writeUInt32LE(entry.crc, 4);
    if (entry.zip64) {
      writeUInt64(buf, entry.compressedSize, 8);
      writeUInt64(buf, entry.uncompressedSize, 16);
    } else {
      buf.writeUInt32LE(entry.compressedSize, 8);
      buf.writeUInt32LE(entry.uncompressedSize, 12);
    }
    return buf;
  }

  /**
   * Add an entry whose contents come from a stream.
   *
   * Whether an entry is zip64 has to be settled before any of its data is
   * written, so a source of unknown length is read ahead of up to
   * `probeLimit` bytes to find out which it is.
   *
   * @param options.sizeHint how large the source is known to be, if it is
   */
  async addStream(
    name: string,
    source: Readable,
    options: { sizeHint?: number; mode?: number; mtime?: Date } = {}
  ): Promise<void> {
    const iterator = source[Symbol.asyncIterator]();
    const probed: Buffer[] = [];
    let zip64: boolean;
    if (options.sizeHint !== undefined)
      zip64 = options.sizeHint >= this.zip64Threshold;
    else {
      let seen = 0;
      let ended = false;
      while (seen <= this.probeLimit) {
        const next = await iterator.next();
        if (next.done) {
          ended = true;
          break;
        }
        probed.push(next.value as Buffer);
        seen += (next.value as Buffer).length;
      }
      zip64 = !ended || seen >= this.zip64Threshold;
    }

    const { time, date } = dosDateTime(options.mtime ?? new Date());
    const entry: WrittenEntry = {
      name: this.entryName(name, false),
      flags: FLAG_DESCRIPTOR | FLAG_UTF8 | (this.password ? FLAG_ENCRYPTED : 0),
      method: METHOD_DEFLATED,
      time,
      date,
      crc: 0,
      compressedSize: 0,
      uncompressedSize: 0,
      offset: this.offset,
      mode: options.mode ?? 0o644,
      isDirectory: false,
      zip64,
    };
    await this.put(this.localHeader(entry));

    const crypto = this.password ? new ZipCrypto(this.password) : null;
    if (crypto) {
      // the 12 byte encryption header. Its last byte is a check byte the
      // reader compares against - the high byte of the modification time,
      // because with a data descriptor the CRC is not known yet
      const salt = randomBytes(12);
      salt[11] = (time >>> 8) & 0xff;
      await this.put(crypto.encrypt(salt));
      entry.compressedSize += 12;
    }

    const deflate = createDeflateRaw({ level: this.level });
    let feedError: any;
    const feed = (async () => {
      const consume = async (buf: Buffer) => {
        entry.crc = crc32(buf, entry.crc);
        entry.uncompressedSize += buf.length;
        if (!deflate.write(buf)) await once(deflate, "drain");
      };
      // whatever the format probe already read, then the rest of the source
      for (const buf of probed) await consume(buf);
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        await consume(next.value as Buffer);
      }
      deflate.end();
    })().catch((e) => {
      feedError = e;
      // unblock the consumer below, which would otherwise wait for an end
      // that is never coming
      deflate.destroy(e);
    });

    try {
      for await (const chunk of deflate) {
        const data = crypto
          ? crypto.encrypt(chunk as Buffer)
          : (chunk as Buffer);
        entry.compressedSize += data.length;
        await this.put(data);
      }
    } finally {
      await feed;
    }
    if (feedError) throw feedError;

    if (
      !entry.zip64 &&
      (entry.compressedSize > UINT32_MAX || entry.uncompressedSize > UINT32_MAX)
    )
      throw new Error(
        `Zip entry ${name} grew past 4GB while it was being written`
      );

    await this.put(this.dataDescriptor(entry));
    this.entries.push(entry);
  }

  /** Add an entry from content held in memory */
  async addBuffer(
    name: string,
    data: Buffer,
    options: { mode?: number; mtime?: Date } = {}
  ): Promise<void> {
    await this.addStream(name, Readable.from([data]), {
      ...options,
      sizeHint: data.length,
    });
  }

  /** Add an entry read from a file on disk. The file is streamed. */
  async addFile(name: string, localPath: string): Promise<void> {
    const stats = await stat(localPath);
    await this.addStream(name, createReadStream(localPath), {
      sizeHint: stats.size,
      mode: stats.mode & 0o7777,
      mtime: stats.mtime,
    });
  }

  /** Add a directory entry */
  async addDirectory(
    name: string,
    options: { mode?: number; mtime?: Date } = {}
  ): Promise<void> {
    const { time, date } = dosDateTime(options.mtime ?? new Date());
    const entry: WrittenEntry = {
      name: this.entryName(name, true),
      flags: FLAG_UTF8,
      method: METHOD_STORED,
      time,
      date,
      crc: 0,
      compressedSize: 0,
      uncompressedSize: 0,
      offset: this.offset,
      mode: options.mode ?? 0o755,
      isDirectory: true,
      zip64: false,
    };
    await this.put(this.localHeader(entry));
    this.entries.push(entry);
  }

  /** The central directory record of one entry */
  private centralHeader(entry: WrittenEntry): Buffer {
    // only the values that do not fit go into the zip64 extra field, in the
    // order the format prescribes
    const zip64Fields: number[] = [];
    if (entry.uncompressedSize > UINT32_MAX)
      zip64Fields.push(entry.uncompressedSize);
    if (entry.compressedSize > UINT32_MAX)
      zip64Fields.push(entry.compressedSize);
    if (entry.offset > UINT32_MAX) zip64Fields.push(entry.offset);
    const extraSize = zip64Fields.length ? 4 + zip64Fields.length * 8 : 0;

    const buf = Buffer.alloc(
      CENTRAL_HEADER_SIZE + entry.name.length + extraSize
    );
    buf.writeUInt32LE(CENTRAL_SIG, 0);
    buf.writeUInt16LE((3 << 8) | 45, 4); // made by unix
    buf.writeUInt16LE(extraSize ? 45 : 20, 6);
    buf.writeUInt16LE(entry.flags, 8);
    buf.writeUInt16LE(entry.method, 10);
    buf.writeUInt16LE(entry.time, 12);
    buf.writeUInt16LE(entry.date, 14);
    buf.writeUInt32LE(entry.crc, 16);
    buf.writeUInt32LE(Math.min(entry.compressedSize, UINT32_MAX), 20);
    buf.writeUInt32LE(Math.min(entry.uncompressedSize, UINT32_MAX), 24);
    buf.writeUInt16LE(entry.name.length, 28);
    buf.writeUInt16LE(extraSize, 30);
    buf.writeUInt16LE(0, 32); // comment length
    buf.writeUInt16LE(0, 34); // disk number
    buf.writeUInt16LE(0, 36); // internal attributes
    buf.writeUInt32LE(
      ((entry.mode & 0xffff) << 16) | (entry.isDirectory ? 0x10 : 0),
      38
    );
    buf.writeUInt32LE(Math.min(entry.offset, UINT32_MAX), 42);
    entry.name.copy(buf, CENTRAL_HEADER_SIZE);
    if (extraSize) {
      const at = CENTRAL_HEADER_SIZE + entry.name.length;
      buf.writeUInt16LE(ZIP64_EXTRA_ID, at);
      buf.writeUInt16LE(extraSize - 4, at + 2);
      zip64Fields.forEach((v, i) => writeUInt64(buf, v, at + 4 + i * 8));
    }
    return buf;
  }

  /**
   * Write the central directory and the end of central directory records.
   * The writer cannot be used afterwards.
   */
  async finalize(): Promise<void> {
    const centralStart = this.offset;
    for (const entry of this.entries) await this.put(this.centralHeader(entry));
    const centralSize = this.offset - centralStart;

    const needsZip64 =
      this.entries.length > UINT16_MAX ||
      centralStart > UINT32_MAX ||
      centralSize > UINT32_MAX;

    if (needsZip64) {
      const zip64Eocd = Buffer.alloc(ZIP64_EOCD_SIZE);
      zip64Eocd.writeUInt32LE(ZIP64_EOCD_SIG, 0);
      writeUInt64(zip64Eocd, ZIP64_EOCD_SIZE - 12, 4);
      zip64Eocd.writeUInt16LE((3 << 8) | 45, 12);
      zip64Eocd.writeUInt16LE(45, 14);
      zip64Eocd.writeUInt32LE(0, 16); // this disk
      zip64Eocd.writeUInt32LE(0, 20); // disk with central directory
      writeUInt64(zip64Eocd, this.entries.length, 24);
      writeUInt64(zip64Eocd, this.entries.length, 32);
      writeUInt64(zip64Eocd, centralSize, 40);
      writeUInt64(zip64Eocd, centralStart, 48);
      const eocdOffset = this.offset;
      await this.put(zip64Eocd);

      const locator = Buffer.alloc(ZIP64_LOCATOR_SIZE);
      locator.writeUInt32LE(ZIP64_LOCATOR_SIG, 0);
      locator.writeUInt32LE(0, 4);
      writeUInt64(locator, eocdOffset, 8);
      locator.writeUInt32LE(1, 16);
      await this.put(locator);
    }

    const eocd = Buffer.alloc(EOCD_SIZE);
    eocd.writeUInt32LE(EOCD_SIG, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(Math.min(this.entries.length, UINT16_MAX), 8);
    eocd.writeUInt16LE(Math.min(this.entries.length, UINT16_MAX), 10);
    eocd.writeUInt32LE(Math.min(centralSize, UINT32_MAX), 12);
    eocd.writeUInt32LE(Math.min(centralStart, UINT32_MAX), 16);
    eocd.writeUInt16LE(0, 20); // comment length
    await this.put(eocd);
  }
}
