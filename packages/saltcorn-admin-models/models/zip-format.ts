/**
 * Constants and primitives of the ZIP file format, shared by the streaming
 * writer (zip-writer.ts) and reader (zip-reader.ts).
 *
 * @category saltcorn-admin-models
 * @module models/zip-format
 */
import zlib from "zlib";

export const LOCAL_SIG = 0x04034b50;
export const CENTRAL_SIG = 0x02014b50;
export const DESCRIPTOR_SIG = 0x08074b50;
export const EOCD_SIG = 0x06054b50;
export const ZIP64_EOCD_SIG = 0x06064b50;
export const ZIP64_LOCATOR_SIG = 0x07064b50;

export const LOCAL_HEADER_SIZE = 30;
export const CENTRAL_HEADER_SIZE = 46;
export const EOCD_SIZE = 22;
export const ZIP64_EOCD_SIZE = 56;
export const ZIP64_LOCATOR_SIZE = 20;

/** general purpose bit flags */
export const FLAG_ENCRYPTED = 0x1;
export const FLAG_DESCRIPTOR = 0x8;
export const FLAG_UTF8 = 0x800;

export const METHOD_STORED = 0;
export const METHOD_DEFLATED = 8;

export const UINT16_MAX = 0xffff;
export const UINT32_MAX = 0xffffffff;

/** extra field header id of the zip64 extended information field */
export const ZIP64_EXTRA_ID = 0x0001;

/**
 * Entries at least this large are written in zip64 format. The threshold is
 * below the 4 GiB limit of the 32-bit size fields because the writer has to
 * commit to a format before it knows the exact sizes: it only knows how big
 * the source was when it started, and deflate can add a little.
 */
export const ZIP64_THRESHOLD = 0xf0000000; // 3.75 GiB

/** the CRC-32 lookup table, also used to derive the ZipCrypto keys */
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const jsCrc32 = (data: Buffer, previous: number = 0): number => {
  let c = ~previous >>> 0;
  for (let i = 0; i < data.length; i++)
    c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * CRC-32 of a chunk, continuing from the value of the previous chunk.
 * zlib's native implementation is used where available (node 20.15+).
 */
export const crc32: (data: Buffer, previous?: number) => number =
  typeof (zlib as any).crc32 === "function" ? (zlib as any).crc32 : jsCrc32;

/** single-byte CRC-32 update, as ZipCrypto's key schedule uses it */
const crc32update = (crc: number, byte: number): number =>
  crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);

/**
 * The traditional PKWARE ("ZipCrypto") stream cipher, as produced by
 * `zip -P` and understood by every zip reader. It is weak by modern
 * standards, but it is what the zip format offers without going outside the
 * standard, and what Saltcorn backups have always used.
 *
 * The cipher is stateful across the whole entry, so one instance encrypts or
 * decrypts one entry, chunk by chunk.
 */
export class ZipCrypto {
  private keys: Uint32Array;

  constructor(password: string) {
    this.keys = new Uint32Array([0x12345678, 0x23456789, 0x34567890]);
    for (const byte of Buffer.from(password)) this.updateKeys(byte);
  }

  private updateKeys(byte: number): void {
    const keys = this.keys;
    keys[0] = crc32update(keys[0], byte);
    keys[1] += keys[0] & 0xff;
    keys[1] = Math.imul(keys[1], 134775813) + 1;
    keys[2] = crc32update(keys[2], keys[1] >>> 24);
  }

  private nextKeyByte(): number {
    const k = (this.keys[2] | 2) >>> 0;
    return ((Math.imul(k, k ^ 1) >>> 0) >> 8) & 0xff;
  }

  encrypt(data: Buffer): Buffer {
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      out[i] = data[i] ^ this.nextKeyByte();
      this.updateKeys(data[i]);
    }
    return out;
  }

  decrypt(data: Buffer): Buffer {
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      const plain = data[i] ^ this.nextKeyByte();
      out[i] = plain;
      this.updateKeys(plain);
    }
    return out;
  }
}

/** MS-DOS date and time fields for a timestamp */
export const dosDateTime = (d: Date): { time: number; date: number } => {
  // MS-DOS timestamps start in 1980 and have two second resolution
  const year = Math.max(d.getFullYear(), 1980);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
};

/** the timestamp of an MS-DOS date and time field pair */
export const fromDosDateTime = (time: number, date: number): Date =>
  new Date(
    ((date >> 9) & 0x7f) + 1980,
    ((date >> 5) & 0x0f) - 1,
    date & 0x1f,
    (time >> 11) & 0x1f,
    (time >> 5) & 0x3f,
    (time & 0x1f) * 2
  );

/**
 * Read a possibly 64-bit unsigned integer as a number. Values above
 * Number.MAX_SAFE_INTEGER cannot occur in a file we could store anyway.
 */
export const readUInt64 = (buf: Buffer, offset: number): number => {
  const value = buf.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Zip entry is too large to read");
  return Number(value);
};

/** Write a 64-bit unsigned integer */
export const writeUInt64 = (
  buf: Buffer,
  value: number,
  offset: number
): void => {
  buf.writeBigUInt64LE(BigInt(value), offset);
};

/**
 * The fields of the zip64 extended information extra field, in the order the
 * format defines: only the fields whose base value is the "look in zip64"
 * marker are present.
 */
export const parseZip64Extra = (
  extra: Buffer,
  wanted: {
    uncompressedSize?: boolean;
    compressedSize?: boolean;
    offset?: boolean;
  }
): { uncompressedSize?: number; compressedSize?: number; offset?: number } => {
  const out: any = {};
  let pos = 0;
  while (pos + 4 <= extra.length) {
    const id = extra.readUInt16LE(pos);
    const size = extra.readUInt16LE(pos + 2);
    if (id === ZIP64_EXTRA_ID) {
      const field = extra.subarray(pos + 4, pos + 4 + size);
      let fpos = 0;
      const take = () => {
        if (fpos + 8 > field.length) return undefined;
        const v = readUInt64(field, fpos);
        fpos += 8;
        return v;
      };
      if (wanted.uncompressedSize) out.uncompressedSize = take();
      if (wanted.compressedSize) out.compressedSize = take();
      if (wanted.offset) out.offset = take();
      return out;
    }
    pos += 4 + size;
  }
  return out;
};
