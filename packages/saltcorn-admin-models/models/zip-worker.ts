/**
 * Worker-thread side of models/zip.ts - see there for why this runs off the
 * main thread. Handles one archive at a time, driven by ZipRequest messages.
 *
 * @category saltcorn-admin-models
 * @module models/zip-worker
 */
import { parentPort } from "worker_threads";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import Zip from "adm-zip";
import { mkdirSync } from "fs";
import { dirname } from "path";
import type { ZipRequest, ZipResponse } from "./zip.js";

// adm-zip can read encrypted archives but has no public API for writing them.
// Its ZipCrypto implementation is complete though, so entry compression is
// wrapped below to encrypt on the way out - producing archives that adm-zip,
// the system `unzip` and every other ZipCrypto reader can open.
const { encrypt } = require("adm-zip/methods/zipcrypto");

let zip: any = null;
let password: string | undefined;

/**
 * Make every (non-directory) entry of the archive encrypt itself with the
 * password when it is compressed. adm-zip asks each entry for its compressed
 * data and only then packs the headers, so updating the flags and the
 * compressed size from in here is picked up correctly.
 */
const encryptEntries = (pwd: string) => {
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const compress = entry.getCompressedData.bind(entry);
    entry.getCompressedData = () => {
      const data = compress();
      entry.header.flags |= 0x1; // general purpose bit 0: encrypted
      const encrypted = encrypt(data, entry.header, pwd);
      entry.header.compressedSize = encrypted.length;
      return encrypted;
    };
  }
};

const handle = async (req: ZipRequest): Promise<any> => {
  switch (req.cmd) {
    case "createZip":
      zip = new Zip();
      password = req.password;
      return;
    case "openZip":
      zip = new Zip(req.path);
      password = req.password;
      return;
    case "addBuffer":
      zip.addFile(req.entryName, Buffer.from(req.data));
      return;
    case "addLocalFile": {
      const slash = req.entryName.lastIndexOf("/");
      zip.addLocalFile(
        req.localPath,
        slash < 0 ? "" : req.entryName.slice(0, slash + 1),
        req.entryName.slice(slash + 1)
      );
      return;
    }
    case "addDirectory":
      zip.addFile(
        req.entryName.endsWith("/") ? req.entryName : `${req.entryName}/`,
        Buffer.alloc(0)
      );
      return;
    case "writeToFile": {
      if (password) encryptEntries(password);
      const dir = dirname(req.path);
      if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
      zip.writeZip(req.path);
      return;
    }
    case "toBuffer": {
      if (password) encryptEntries(password);
      return zip.toBuffer();
    }
    case "extractAllTo":
      if (password) zip.extractAllTo(req.dir, true, false, password);
      else zip.extractAllTo(req.dir, true, false);
      return;
    default:
      throw new Error(`Unknown zip worker command`);
  }
};

parentPort?.on("message", async (req: ZipRequest) => {
  try {
    const result = await handle(req);
    const reply: ZipResponse = { id: req.id, ok: true, result };
    // transfer the finished archive rather than copying it
    parentPort!.postMessage(
      reply,
      Buffer.isBuffer(result) ? [result.buffer as ArrayBuffer] : undefined
    );
  } catch (e: any) {
    const error = e?.message || String(e);
    parentPort!.postMessage({
      id: req.id,
      ok: false,
      error,
      // adm-zip says "Incompatible password parameter" when a password is
      // needed and "Wrong Password" when it does not match
      requiresPassword: /password|encrypted/i.test(error),
    } as ZipResponse);
  }
});
