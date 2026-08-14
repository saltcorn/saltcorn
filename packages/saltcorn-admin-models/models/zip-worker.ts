/**
 * Worker-thread side of models/zip.ts - see there for why this runs off the
 * main thread. Handles one archive at a time, driven by ZipRequest messages.
 *
 * @category saltcorn-admin-models
 * @module models/zip-worker
 */
import { parentPort } from "worker_threads";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { PassThrough, Writable } from "stream";
import { once } from "events";
import { ZipStreamWriter } from "./zip-writer.js";
import { ZipStreamReader } from "./zip-reader.js";
import type { ZipRequest, ZipResponse } from "./zip.js";

/** archive bytes are shipped to the main thread in batches of at least this */
const CHUNK_SIZE = 256 * 1024;

let writer: ZipStreamWriter | null = null;
let output: Writable | null = null;
/** the entry currently being fed chunk by chunk from the main thread */
let entrySource: PassThrough | null = null;
let entryDone: Promise<void> | null = null;
/** resolves when the output stream has been fully flushed and closed */
let outputClosed: Promise<void> = Promise.resolve();
/** set while a shipped chunk is waiting to be acknowledged */
let chunkAck: (() => void) | null = null;

/**
 * Transfer a buffer rather than copying it, but only when it owns its whole
 * ArrayBuffer - node pools small allocations, and transferring a pooled
 * buffer would detach the pool out from under everything else in it.
 */
const transferable = (data: Buffer): any =>
  data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
    ? [data.buffer]
    : undefined;

/**
 * An output that ships the archive to the main thread instead of writing it
 * to disk, for destinations that are uploaded rather than stored locally.
 *
 * Chunks are coalesced to keep the message count down, and only one is in
 * flight at a time: the main thread acknowledges each one once it has taken
 * it, which is what applies backpressure all the way back to the file being
 * read.
 */
const messageOutput = (): Writable => {
  let pending: Buffer[] = [];
  let pendingSize = 0;

  const ship = (): Promise<void> => {
    const data = Buffer.concat(pending);
    pending = [];
    pendingSize = 0;
    return new Promise((resolve) => {
      chunkAck = resolve;
      parentPort!.postMessage({ type: "chunk", data }, transferable(data));
    });
  };

  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      pending.push(chunk);
      pendingSize += chunk.length;
      if (pendingSize < CHUNK_SIZE) return callback();
      ship().then(() => callback(), callback);
    },
    final(callback) {
      const done = () => {
        parentPort!.postMessage({ type: "chunkEnd" });
        callback();
      };
      if (pendingSize) ship().then(done, callback);
      else done();
    },
  });
};

/** wait for a stream to finish, or reject with its error */
const finished = (stream: Writable): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

const startWriting = (out: Writable, password?: string) => {
  output = out;
  outputClosed = finished(out);
  writer = new ZipStreamWriter(out, { password });
};

const handle = async (req: ZipRequest): Promise<void> => {
  switch (req.cmd) {
    case "beginFile": {
      const dir = dirname(req.path);
      if (dir && dir !== ".") await mkdir(dir, { recursive: true });
      startWriting(createWriteStream(req.path), req.password);
      return;
    }
    case "beginStream":
      startWriting(messageOutput(), req.password);
      return;
    case "addBuffer":
      await writer!.addBuffer(req.entryName, Buffer.from(req.data));
      return;
    case "addLocalFile":
      await writer!.addFile(req.entryName, req.localPath);
      return;
    case "addDirectory":
      await writer!.addDirectory(req.entryName);
      return;
    case "beginEntry": {
      // the entry is written as its chunks arrive, so this resolves right
      // away and the work goes on in the background until endEntry
      const source = new PassThrough();
      // failures are reported by endEntry; this keeps the destroy below from
      // becoming an unhandled error event
      source.on("error", () => {});
      entrySource = source;
      entryDone = writer!.addStream(req.entryName, source).catch((e) => {
        // stop the main thread waiting for room in a stream that is done
        source.destroy(e);
        throw e;
      });
      entryDone.catch(() => {});
      return;
    }
    case "entryChunk": {
      const chunk = Buffer.from(req.data);
      if (!entrySource!.write(chunk)) await once(entrySource!, "drain");
      return;
    }
    case "endEntry": {
      entrySource!.end();
      const done = entryDone!;
      entrySource = null;
      entryDone = null;
      await done;
      return;
    }
    case "finish": {
      await writer!.finalize();
      // finalize only hands the trailing records to the output; the archive
      // is not complete until the output has taken and flushed them
      output!.end();
      await outputClosed;
      writer = null;
      output = null;
      return;
    }
    case "extractAllTo": {
      const reader = await ZipStreamReader.open(req.path, req.password);
      await reader.extractAllTo(req.dir);
      return;
    }
    default:
      throw new Error(`Unknown zip worker command`);
  }
};

/** requests are handled one at a time, in the order they arrive */
let queue: Promise<void> = Promise.resolve();

parentPort?.on("message", (msg: ZipRequest | { cmd: "chunkAck" }) => {
  if (msg.cmd === "chunkAck") {
    // not a request: the main thread reporting it has room for more output
    const ack = chunkAck;
    chunkAck = null;
    ack?.();
    return;
  }
  const req = msg as ZipRequest;
  queue = queue.then(async () => {
    try {
      await handle(req);
      parentPort!.postMessage({ id: req.id, ok: true } as ZipResponse);
    } catch (e: any) {
      const error = e?.message || String(e);
      parentPort!.postMessage({
        id: req.id,
        ok: false,
        error,
        requiresPassword:
          !!e?.requiresPassword || /password|encrypted/i.test(error),
      } as ZipResponse);
    }
  });
});
