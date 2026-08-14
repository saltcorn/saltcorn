/**
 * Zip helpers running on a worker thread.
 *
 * Zipping and unzipping are synchronous, CPU-bound operations: doing them on
 * the main thread blocks the event loop for the whole duration of a backup or
 * a restore, which is why this used to shell out to the system `zip`/`unzip`
 * executables instead. A worker thread gives us the same non-blocking
 * behaviour without depending on anything being installed on the host, so
 * adm-zip is now the only implementation.
 *
 * The builder is fed one entry at a time so that neither the caller nor the
 * main thread ever has to hold the whole archive: content generated in the
 * main thread (pack.json, table dumps, config) is handed over as a buffer,
 * while files already on disk are only named - the worker reads them itself.
 *
 * @category saltcorn-admin-models
 * @module models/zip
 */
import { Worker } from "worker_threads";

/** Request sent from the main thread to the zip worker. */
export type ZipRequest =
  | { id: number; cmd: "createZip"; password?: string }
  | { id: number; cmd: "openZip"; path: string; password?: string }
  | { id: number; cmd: "addBuffer"; entryName: string; data: Uint8Array }
  | { id: number; cmd: "addLocalFile"; entryName: string; localPath: string }
  | { id: number; cmd: "addDirectory"; entryName: string }
  | { id: number; cmd: "writeToFile"; path: string }
  | { id: number; cmd: "toBuffer" }
  | { id: number; cmd: "extractAllTo"; dir: string };

/** Reply sent from the zip worker back to the main thread. */
export type ZipResponse =
  | { id: number; ok: true; result?: any }
  | { id: number; ok: false; error: string; requiresPassword?: boolean };

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

  constructor() {
    this.worker = new Worker(workerURL);
    this.worker.on("message", (msg: ZipResponse) => {
      const waiter = this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.ok) waiter.resolve(msg.result);
      else {
        const e: any = new Error(msg.error);
        if (msg.requiresPassword) e.requiresPassword = true;
        waiter.reject(e);
      }
    });
    this.worker.on("error", (e: Error) => this.fail(e));
    this.worker.on("exit", (code: number) => {
      if (this.pending.size)
        this.fail(new Error(`zip worker stopped with exit code ${code}`));
    });
  }

  private fail(e: Error) {
    this.dead = e;
    for (const waiter of this.pending.values()) waiter.reject(e);
    this.pending.clear();
  }

  /**
   * Send a request and wait for its reply. Buffers are transferred rather
   * than copied when they own their whole ArrayBuffer - Node pools small
   * allocations, and transferring a pooled buffer would detach the pool.
   */
  send(req: ZipCommand): Promise<any> {
    if (this.dead) return Promise.reject(this.dead);
    const id = ++this.seq;
    const message = { ...req, id } as ZipRequest;
    const transfer: Array<ArrayBufferLike> = [];
    if (message.cmd === "addBuffer") {
      const { data } = message;
      if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength)
        transfer.push(data.buffer);
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(message, transfer as any);
    });
  }

  async close(): Promise<void> {
    await this.worker.terminate();
  }
}

/**
 * Builds a zip file, one entry at a time, on a worker thread.
 *
 * Terminal operations (writeToFile, toBuffer, discard) shut the worker down;
 * the builder cannot be used afterwards.
 */
export class ZipBuilder {
  private worker: ZipWorker;
  private closed: boolean = false;

  private constructor(worker: ZipWorker) {
    this.worker = worker;
  }

  /**
   * @param password if non-empty, entries are encrypted with the (ZipCrypto)
   *   zip password scheme, as the system `zip -P` did
   */
  static async create(password?: string): Promise<ZipBuilder> {
    const worker = new ZipWorker();
    const builder = new ZipBuilder(worker);
    try {
      await worker.send({ cmd: "createZip", password: password || undefined });
    } catch (e) {
      await builder.discard();
      throw e;
    }
    return builder;
  }

  /** Add an entry from content held in memory */
  async addBuffer(entryName: string, data: Buffer): Promise<void> {
    await this.worker.send({ cmd: "addBuffer", entryName, data });
  }

  /** Add an entry from a file on disk. The worker does the reading. */
  async addLocalFile(entryName: string, localPath: string): Promise<void> {
    await this.worker.send({ cmd: "addLocalFile", entryName, localPath });
  }

  /** Add a directory entry. A trailing slash is added if missing. */
  async addDirectory(entryName: string): Promise<void> {
    await this.worker.send({ cmd: "addDirectory", entryName });
  }

  /** Write the archive to its final location and close the worker */
  async writeToFile(path: string): Promise<void> {
    try {
      await this.worker.send({ cmd: "writeToFile", path });
    } finally {
      await this.discard();
    }
  }

  /**
   * Return the archive as a buffer and close the worker. For destinations
   * that are written over the network (S3, SFTP), so that no intermediate
   * file is ever created on disk.
   */
  async toBuffer(): Promise<Buffer> {
    try {
      const data = await this.worker.send({ cmd: "toBuffer" });
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    } finally {
      await this.discard();
    }
  }

  /** Throw the half-built archive away and close the worker */
  async discard(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.worker.close();
  }
}

/**
 * Extract a zip file to a directory on a worker thread.
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
  const worker = new ZipWorker();
  try {
    await worker.send({ cmd: "openZip", path: fnm, password });
    await worker.send({ cmd: "extractAllTo", dir });
  } finally {
    await worker.close();
  }
};
