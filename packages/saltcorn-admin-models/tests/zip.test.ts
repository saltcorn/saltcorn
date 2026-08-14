import { mkdtemp, mkdir, rm, readFile, writeFile, stat } from "fs/promises";
import { createWriteStream } from "fs";
import { randomFillSync } from "crypto";
import { Readable } from "stream";
import { join } from "path";
import { tmpdir } from "os";
import Zip from "adm-zip";
import { ZipBuilder, extractZip } from "../models/zip.js";
import { ZipStreamWriter } from "../models/zip-writer.js";
import { ZipStreamReader } from "../models/zip-reader.js";
import {
  afterAll,
  beforeAll,
  describe,
  it,
  expect,
  jest,
} from "@saltcorn/db-common/test_expect";

jest.setTimeout(60000);

let dir: string;
let sourceDir: string;
/**
 * Big enough to pass through the writer, the worker and the reader in
 * several chunks, so the streaming paths are actually exercised, and random
 * so that it does not compress away to nothing on the way.
 */
const bigContent = Buffer.alloc(6 * 1024 * 1024);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "sc-zip-test-"));
  sourceDir = join(dir, "source");
  await mkdir(sourceDir, { recursive: true });
  randomFillSync(bigContent);
  await writeFile(join(sourceDir, "big.bin"), bigContent);
  await writeFile(join(sourceDir, "small.txt"), "hello world");
  await writeFile(join(sourceDir, "empty.txt"), "");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** an archive with one of everything: buffer, file, empty file, directory */
const buildArchive = async (path: string, password?: string) => {
  const zip = await ZipBuilder.toFile(path, password);
  await zip.addBuffer("pack.json", Buffer.from(JSON.stringify({ a: 1 })));
  await zip.addDirectory("files");
  await zip.addLocalFile("files/big.bin", join(sourceDir, "big.bin"));
  await zip.addLocalFile("files/small.txt", join(sourceDir, "small.txt"));
  await zip.addLocalFile("files/empty.txt", join(sourceDir, "empty.txt"));
  await zip.finish();
};

describe("zip round trip", () => {
  it("writes and reads back every kind of entry", async () => {
    const zipPath = join(dir, "roundtrip.zip");
    await buildArchive(zipPath);

    const out = join(dir, "roundtrip-out");
    await extractZip(zipPath, out);

    expect((await readFile(join(out, "pack.json"))).toString()).toBe('{"a":1}');
    expect((await readFile(join(out, "files/small.txt"))).toString()).toBe(
      "hello world"
    );
    expect((await stat(join(out, "files/empty.txt"))).size).toBe(0);
    expect((await stat(join(out, "files"))).isDirectory()).toBe(true);
    const big = await readFile(join(out, "files/big.bin"));
    expect(Buffer.compare(big, bigContent)).toBe(0);
  });

  it("produces an archive other zip readers understand", async () => {
    // adm-zip is an independent implementation: if it agrees, the archive is
    // a real zip file and not just something our own reader happens to read
    const zipPath = join(dir, "compat.zip");
    await buildArchive(zipPath);

    const zip = new Zip(zipPath);
    expect(zip.getEntries().map((e: any) => e.entryName)).toEqual([
      "pack.json",
      "files/",
      "files/big.bin",
      "files/small.txt",
      "files/empty.txt",
    ]);
    expect(zip.readAsText("files/small.txt")).toBe("hello world");
    expect(Buffer.compare(zip.readFile("files/big.bin")!, bigContent)).toBe(0);
  });

  it("reads an archive written by another zip writer", async () => {
    const zipPath = join(dir, "foreign.zip");
    const zip = new Zip();
    zip.addFile("a/b.txt", Buffer.from("written by adm-zip"));
    zip.addFile("big.bin", bigContent);
    zip.writeZip(zipPath);

    const out = join(dir, "foreign-out");
    await extractZip(zipPath, out);
    expect((await readFile(join(out, "a/b.txt"))).toString()).toBe(
      "written by adm-zip"
    );
    expect(
      Buffer.compare(await readFile(join(out, "big.bin")), bigContent)
    ).toBe(0);
  });

  it("rejects a corrupted archive rather than writing out bad data", async () => {
    const zipPath = join(dir, "corrupt.zip");
    await buildArchive(zipPath);
    // flip a byte in the middle of the compressed data
    const bytes = await readFile(zipPath);
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    await writeFile(zipPath, bytes);

    let error: any;
    await extractZip(zipPath, join(dir, "corrupt-out")).catch((e) => {
      error = e;
    });
    expect(!!error).toBe(true);
  });

  it("refuses to extract outside the target directory", async () => {
    const zipPath = join(dir, "slip.zip");
    const out = createWriteStream(zipPath);
    const closed = new Promise<void>((resolve, reject) => {
      out.on("finish", () => resolve());
      out.on("error", reject);
    });
    const writer = new ZipStreamWriter(out);
    // ZipStreamWriter strips leading slashes, so climb out with ..
    await writer.addBuffer("../escaped.txt", Buffer.from("nope"));
    await writer.finalize();
    out.end();
    await closed;

    let error: any;
    await extractZip(zipPath, join(dir, "slip-out")).catch((e) => {
      error = e;
    });
    expect(error?.message).toContain("outside the target");
  });
});

describe("zip streaming", () => {
  it("emits the archive while it is still being built", async () => {
    // the point of the streaming writer: bytes come out as entries go in,
    // so an archive larger than memory can be produced
    const zip = await ZipBuilder.toStream();
    const chunks: Buffer[] = [];
    let bytesBeforeFinish = 0;
    const consumed = (async () => {
      for await (const chunk of zip.stream!) chunks.push(chunk as Buffer);
    })();

    await zip.addLocalFile("big.bin", join(sourceDir, "big.bin"));
    await zip.addLocalFile("big2.bin", join(sourceDir, "big.bin"));
    bytesBeforeFinish = chunks.reduce((n, c) => n + c.length, 0);
    await zip.finish();
    await consumed;

    expect(bytesBeforeFinish).toBeGreaterThan(0);
    expect(chunks.length).toBeGreaterThan(1);

    // and what came out is a complete archive
    const zipPath = join(dir, "streamed.zip");
    await writeFile(zipPath, Buffer.concat(chunks));
    const out = join(dir, "streamed-out");
    await extractZip(zipPath, out);
    expect(
      Buffer.compare(await readFile(join(out, "big.bin")), bigContent)
    ).toBe(0);
    expect(
      Buffer.compare(await readFile(join(out, "big2.bin")), bigContent)
    ).toBe(0);
  });

  it("adds an entry from a stream of unknown length", async () => {
    // content produced in the main thread - a table dump - goes in chunk by
    // chunk, so it is never assembled into one buffer anywhere
    const zipPath = join(dir, "fromstream.zip");
    const zip = await ZipBuilder.toFile(zipPath);
    const parts = [
      Buffer.from("["),
      ...Array.from({ length: 200 }, (_, i) =>
        Buffer.from(JSON.stringify({ id: i, pad: "x".repeat(1000) }) + ",")
      ),
      Buffer.from("]"),
    ];
    await zip.addStream("tables/rows.json", Readable.from(parts));
    await zip.addBuffer("pack.json", Buffer.from("{}"));
    await zip.finish();

    const out = join(dir, "fromstream-out");
    await extractZip(zipPath, out);
    expect(
      Buffer.compare(
        await readFile(join(out, "tables/rows.json")),
        Buffer.concat(parts)
      )
    ).toBe(0);
    // it fit within the probe, so it is a plain entry any reader can read
    expect(new Zip(zipPath).readFile("tables/rows.json")!.length).toBe(
      Buffer.concat(parts).length
    );
  });

  it("stops building when the consumer gives up", async () => {
    const zip = await ZipBuilder.toStream();
    zip.stream!.destroy(new Error("consumer went away"));

    let error: any;
    try {
      // eventually the worker is torn down and adding entries fails, rather
      // than blocking forever on a reader that is never coming back
      for (let i = 0; i < 200; i++)
        await zip.addLocalFile(`big${i}.bin`, join(sourceDir, "big.bin"));
      await zip.finish();
    } catch (e) {
      error = e;
    }
    await zip.discard();
    expect(!!error).toBe(true);
  });
});

describe("zip encryption", () => {
  const password = "hunter2!";

  it("encrypts entries with the password", async () => {
    const zipPath = join(dir, "encrypted.zip");
    await buildArchive(zipPath, password);

    // entry names stay readable, contents do not
    const zip = new Zip(zipPath);
    expect(zip.getEntries().map((e: any) => e.entryName)).toContain(
      "files/small.txt"
    );
    expect(() => zip.readFile("files/small.txt")).toThrow();
    expect(zip.readFile("files/small.txt", password)!.toString()).toBe(
      "hello world"
    );

    const out = join(dir, "encrypted-out");
    await extractZip(zipPath, out, password);
    expect(
      Buffer.compare(await readFile(join(out, "files/big.bin")), bigContent)
    ).toBe(0);
  });

  it("reports that a password is needed when it is missing or wrong", async () => {
    const zipPath = join(dir, "encrypted2.zip");
    await buildArchive(zipPath, password);

    let missing: any;
    await extractZip(zipPath, join(dir, "enc-missing")).catch((e) => {
      missing = e;
    });
    expect(missing?.requiresPassword).toBe(true);

    let wrong: any;
    await extractZip(zipPath, join(dir, "enc-wrong"), "not it").catch((e) => {
      wrong = e;
    });
    expect(wrong?.requiresPassword).toBe(true);
  });
});

describe("zip64", () => {
  /** write an archive with the writer directly, so options can be set */
  const writeWith = async (
    path: string,
    options: any,
    add: (w: ZipStreamWriter) => Promise<void>
  ) => {
    const out = createWriteStream(path);
    const closed = new Promise<void>((resolve, reject) => {
      out.on("finish", () => resolve());
      out.on("error", reject);
    });
    const writer = new ZipStreamWriter(out, options);
    await add(writer);
    await writer.finalize();
    out.end();
    await closed;
  };

  it("writes entries over the size limit in zip64 format", async () => {
    // the real threshold is 3.75GB; lower it so the format can be tested
    // without writing four gigabytes
    const zipPath = join(dir, "zip64entry.zip");
    await writeWith(zipPath, { zip64Threshold: 1024 }, async (w) => {
      await w.addBuffer("big.bin", bigContent);
      await w.addBuffer("tiny.txt", Buffer.from("small enough"));
    });

    const reader = await ZipStreamReader.open(zipPath);
    const out = join(dir, "zip64entry-out");
    await reader.extractAllTo(out);
    expect(
      Buffer.compare(await readFile(join(out, "big.bin")), bigContent)
    ).toBe(0);
    expect((await readFile(join(out, "tiny.txt"))).toString()).toBe(
      "small enough"
    );
    // an independent reader agrees it is a valid zip64 archive
    expect(new Zip(zipPath).readAsText("tiny.txt")).toBe("small enough");
  });

  it("falls back to zip64 for a stream that outgrows the probe", async () => {
    // an entry of unknown length that does not end within probeLimit has to
    // be written in zip64 format: there is no way back once the local header
    // has gone out
    const zipPath = join(dir, "zip64stream.zip");
    await writeWith(zipPath, { probeLimit: 1024 }, async (w) => {
      await w.addStream("long.bin", Readable.from([bigContent]));
      await w.addStream("short.bin", Readable.from([Buffer.from("brief")]));
    });

    const reader = await ZipStreamReader.open(zipPath);
    const out = join(dir, "zip64stream-out");
    await reader.extractAllTo(out);
    expect(
      Buffer.compare(await readFile(join(out, "long.bin")), bigContent)
    ).toBe(0);
    expect((await readFile(join(out, "short.bin"))).toString()).toBe("brief");
  });

  it("writes a zip64 end of central directory past 65535 entries", async () => {
    const count = 70000;
    const zipPath = join(dir, "manyentries.zip");
    await writeWith(zipPath, { level: 1 }, async (w) => {
      for (let i = 0; i < count; i++)
        await w.addBuffer(`e/${i}.txt`, Buffer.from(`entry ${i}`));
    });

    const reader = await ZipStreamReader.open(zipPath);
    const entries = reader.entries();
    expect(entries.length).toBe(count);
    expect(entries[count - 1].name).toBe(`e/${count - 1}.txt`);
  });
});
