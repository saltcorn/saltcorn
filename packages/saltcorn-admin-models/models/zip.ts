/**
 * Building a zip file on a worker thread.
 *
 * Zipping is CPU-bound, so doing it on the main thread would block the event
 * loop for the whole duration of a backup, which is why this used to shell
 * out to the system `zip` executable. A worker thread gives the same
 * non-blocking behaviour without depending on anything being installed on the
 * host. (Reading is a different matter - see zip-extract.ts.)
 *
 * The archive is streamed, never assembled in memory: entries are compressed
 * and written out as they are added (see zip-writer.ts), so a backup of a
 * file store far larger than RAM works. Content generated in the main thread
 * (pack.json, table dumps, config) is handed over a buffer at a time, while
 * files already on disk are only named - the worker streams them itself.
 *
 * @category saltcorn-admin-models
 * @module models/zip
 */
import { Worker } from "worker_threads";
import { PassThrough, Readable } from "stream";

/** Request sent from the main thread to the zip worker. */
export type ZipRequest =
  | { id: number; cmd: "beginFile"; path: string; password?: string }
  | { id: number; cmd: "beginStream"; password?: string }
  | { id: number; cmd: "addBuffer"; entryName: string; data: Uint8Array }
  | { id: number; cmd: "addLocalFile"; entryName: string; localPath: string }
  | { id: number; cmd: "addDirectory"; entryName: string }
  | { id: number; cmd: "beginEntry"; entryName: string }
  | { id: number; cmd: "entryChunk"; data: Uint8Array }
  | { id: number; cmd: "endEntry" }
  | { id: number; cmd: "finish" };

/** Reply sent from the zip worker back to the main thread. */
export type ZipResponse =
  | { id: number; ok: true; result?: any }
  | { id: number; ok: false; error: string };

/** Omit that distributes over the members of a union */
type UnionOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

/** A ZipRequest before the connection stamps a message id on it */
type ZipCommand = UnionOmit<ZipRequest, "id">;

const workerURL = new URL("./zip-worker.js", import.meta.url);

/**
 * A worker thread running zip-worker.js, with a promise-per-message
 * request/response protocol on top of it.
 */
class ZipWorker {
  private worker: Worker;
  private seq: number = 0;
  private pending: Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void }
  > = new Map();
  private dead?: Error;
  /** where archive bytes go when the worker is streaming to us */
  private sink?: PassThrough;

  constructor() {
    this.worker = new Worker(workerURL);
    this.worker.on("message", (msg: any) => {
      if (msg?.type === "chunk") return this.takeChunk(msg.data);
      if (msg?.type === "chunkEnd") return this.sink?.end();
      const waiter = this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.ok) waiter.resolve(msg.result);
      else waiter.reject(new Error(msg.error));
    });
    this.worker.on("error", (e: Error) => this.fail(e));
    this.worker.on("exit", (code: number) => {
      if (this.pending.size)
        this.fail(new Error(`zip worker stopped with exit code ${code}`));
    });
  }

  /**
   * Take a chunk of the archive and acknowledge it once the consumer has
   * room for more. The worker sends the next chunk only after the
   * acknowledgement, so a slow upload slows the whole pipeline down rather
   * than filling memory.
   */
  private takeChunk(data: Uint8Array): void {
    const sink = this.sink;
    if (!sink || sink.destroyed)
      return this.abandon(new Error("Zip output stream was closed"));
    const ack = () => this.worker.postMessage({ cmd: "chunkAck" });
    if (sink.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength)))
      ack();
    else sink.once("drain", ack);
  }

  private fail(e: Error) {
    this.dead = e;
    for (const waiter of this.pending.values()) waiter.reject(e);
    this.pending.clear();
    this.sink?.destroy(e);
  }

  /**
   * The output went away - a failed upload, a browser that closed the
   * connection. Stop the worker rather than leaving it blocked forever on an
   * acknowledgement that is never coming.
   */
  private abandon(e: Error): void {
    if (this.dead) return;
    this.fail(e);
    this.worker.terminate();
  }

  /**
   * Send a request and wait for its reply.
   *
   * Content buffers are copied, not transferred. Transferring would save the
   * copy, but the buffer belongs to whoever passed it in: a producer that
   * fills and reuses one buffer - which a Readable is free to do - would find
   * it detached under it, and would go on writing zero-length chunks with no
   * error anywhere. The copy is a memcpy against a deflate; it does not show.
   */
  send(req: ZipCommand): Promise<any> {
    if (this.dead) return Promise.reject(this.dead);
    const id = ++this.seq;
    const message = { ...req, id } as ZipRequest;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(message);
    });
  }

  /** Start collecting the archive bytes the worker sends us */
  openSink(): PassThrough {
    const sink = new PassThrough();
    // a consumer that fails takes the sink down with it; keep a listener of
    // our own so that never becomes an unhandled error event, and stop
    // producing bytes nobody is going to read
    sink.on("error", (e: Error) => this.abandon(e));
    this.sink = sink;
    return sink;
  }

  async close(): Promise<void> {
    await this.worker.terminate();
  }
}

/**
 * Builds a zip file, one entry at a time, on a worker thread.
 *
 * `finish` completes the archive and shuts the worker down; the builder
 * cannot be used afterwards.
 */
export class ZipBuilder {
  private worker: ZipWorker;
  private closed: boolean = false;
  /** set when the archive is streamed to the caller rather than to a file */
  readonly stream?: Readable;

  private constructor(worker: ZipWorker, stream?: Readable) {
    this.worker = worker;
    this.stream = stream;
  }

  private static async begin(
    start: (worker: ZipWorker) => Promise<void>,
    stream?: (worker: ZipWorker) => Readable
  ): Promise<ZipBuilder> {
    const worker = new ZipWorker();
    const readable = stream?.(worker);
    const builder = new ZipBuilder(worker, readable);
    try {
      await start(worker);
    } catch (e) {
      await builder.discard(e);
      throw e;
    }
    return builder;
  }

  /**
   * Build an archive at a path on disk. It is written where it belongs -
   * writing it elsewhere and moving it would fail across filesystems.
   *
   * @param password if non-empty, entries are encrypted with the traditional
   *   zip password scheme, as the system `zip -P` did
   */
  static async toFile(path: string, password?: string): Promise<ZipBuilder> {
    return await ZipBuilder.begin((worker) =>
      worker.send({ cmd: "beginFile", path, password: password || undefined })
    );
  }

  /**
   * Build an archive into a readable stream, for destinations written over
   * the network (S3, SFTP) or straight to a browser, so that no copy is made
   * on the local disk. Read `stream` while adding entries: the archive is
   * produced as it is consumed.
   */
  static async toStream(password?: string): Promise<ZipBuilder> {
    return await ZipBuilder.begin(
      (worker) =>
        worker.send({ cmd: "beginStream", password: password || undefined }),
      (worker) => worker.openSink()
    );
  }

  /** Add an entry from content held in memory */
  async addBuffer(entryName: string, data: Buffer): Promise<void> {
    await this.worker.send({ cmd: "addBuffer", entryName, data });
  }

  /** Add an entry from a file on disk. The worker streams it. */
  async addLocalFile(entryName: string, localPath: string): Promise<void> {
    await this.worker.send({ cmd: "addLocalFile", entryName, localPath });
  }

  /**
   * Add an entry from a stream of content produced in the main thread, for
   * content too large to want as one buffer - a table dump, say. Each chunk
   * is acknowledged before the next is sent, so the producer runs no faster
   * than the archive is written.
   */
  async addStream(entryName: string, source: Readable): Promise<void> {
    await this.worker.send({ cmd: "beginEntry", entryName });
    for await (const chunk of source)
      await this.worker.send({ cmd: "entryChunk", data: chunk as Buffer });
    await this.worker.send({ cmd: "endEntry" });
  }

  /** Add a directory entry. A trailing slash is added if missing. */
  async addDirectory(entryName: string): Promise<void> {
    await this.worker.send({ cmd: "addDirectory", entryName });
  }

  /** Complete the archive and close the worker */
  async finish(): Promise<void> {
    try {
      await this.worker.send({ cmd: "finish" });
    } catch (e) {
      await this.discard(e);
      throw e;
    }
    this.closed = true;
    await this.worker.close();
  }

  /**
   * Abandon a half-built archive and close the worker. Any consumer of
   * `stream` is failed too, so a partial archive is never mistaken for a
   * complete one.
   */
  async discard(cause?: any): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    (this.stream as PassThrough | undefined)?.destroy(
      cause instanceof Error ? cause : new Error("Zip archive abandoned")
    );
    await this.worker.close();
  }
}
