/**
 * File Database Access Layer
 * @category saltcorn-data
 * @module models/file
 * @subcategory models
 */

import db from "../db";
import { v4 as uuidv4 } from "uuid";
import { join, parse } from "path";
const { asyncMap } = require("../utils");
import { mkdir, unlink } from "fs/promises";
import type {
  Where,
  SelectOptions,
  Row,
  PartialSome,
} from "@saltcorn/db-common/internal";
import axios from "axios";
import FormData from "form-data";
import { renameSync, statSync, existsSync } from "fs";
import { lookup } from "mime-types";
import type User from "./user";
const path = require("path");
const fsp = require("fs").promises;
const fs = require("fs");
const fsx = require("fs-extended-attributes");
declare let window: any;

function xattr_set(fp: string, attrName: string, value: string): Promise<void> {
  return new Promise((resolve) => fsx.set(fp, attrName, value, resolve));
}
function xattr_get(fp: string, attrName: string): Promise<string> {
  return new Promise((resolve, reject) =>
    fsx.get(fp, attrName, (err: string, attrBuf: Buffer) => {
      if (err) reject(err);
      else resolve(attrBuf?.toString?.("utf8"));
    })
  );
}

const dirCache: Record<string, File[] | null | "building"> = {};
const enableDirCache: Record<string, boolean> = {};

/**
 * File Descriptor class
 *
 * Architecture tips:
 * 1. Physically Saltcorn stores files on local filesystem of the server, where Saltcorn runs.
 * 2. The path to file store is defined in db.connectObj.file_store.
 * 3. List of files stored in _sc_files table in Saltcorn database.
 * 4. Each tenant has own file list and file storage.
 * 5. This class provides file descriptor and basic functions to manipulate with files.
 * @category saltcorn-data
 */
class File {
  filename: string;
  location: string;
  mime_super: string;
  mime_sub: string;
  uploaded_at: Date;
  size_kb: number;
  id?: number;
  user_id?: number;
  min_role_read: number;
  s3_store: boolean;
  isDirectory: boolean;

  /**
   * Constructor
   * @param o {object}
   */
  constructor(o: FileCfg) {
    this.filename = o.filename;
    this.location = o.location;
    this.uploaded_at =
      typeof o.uploaded_at === "string" || typeof o.uploaded_at === "number"
        ? new Date(o.uploaded_at)
        : o.uploaded_at;
    this.size_kb = o.size_kb;
    this.id = o.id;
    this.user_id = o.user_id;
    this.mime_super = o.mime_super;
    this.mime_sub = o.mime_sub;
    this.min_role_read = o.min_role_read;
    this.s3_store = !!o.s3_store;
    this.isDirectory = !!o.isDirectory;
    // TBD add checksum this.checksum = o.checksum;
  }

  /**
   * Select list of file descriptors
   * @param where
   * @param selectopts
   * @returns {Promise<*>}
   */
  static async find(
    where?: Where,
    selectopts: SelectOptions = {}
  ): Promise<Array<File>> {
    const { getState } = require("../db/state");
    const state = getState();

    const useS3 = state?.getConfig("storage_s3_enabled");
    if (useS3 || where?.inDB) {
      if (where?.inDB) delete where.inDB;
      const db_flds = await db.select("_sc_files", where, selectopts);
      return db_flds.map((dbf: FileCfg) => new File(dbf));
    } else {
      const relativeSearchFolder = where?.folder || "/";
      const tenant = db.getTenantSchema();
      const absoluteFolder = File.normalise_in_base(
        db.connectObj.file_store,
        tenant,
        relativeSearchFolder
      );
      if (absoluteFolder === null) return [];
      const files: File[] = [];
      const searcher = async (folder: string, recursive?: boolean) => {
        let fileNms;
        try {
          fileNms = await fsp.readdir(folder);
        } catch (e) {
          fileNms = [];
        }

        for (const name of fileNms) {
          if (
            (name[0] === "." && !where?.hiddenFiles) ||
            name.startsWith("_resized_")
          )
            continue;
          const f = await File.from_file_on_disk(name, folder);
          if (recursive && f.isDirectory) await searcher(f.location, recursive);
          if (where?.search && name.indexOf(where.search) < 0) continue;
          files.push(f);
        }
      };

      if (where?.filename) {
        files.push(
          await File.from_file_on_disk(where?.filename, absoluteFolder)
        );
      } else
        await searcher(absoluteFolder, !!where?.search || selectopts.recursive);

      let pred = (f: File) => true;
      const addPred = (p: Function) => {
        const oldPred = pred;
        pred = (f: File) => oldPred(f) && p(f);
      };
      if (where?.mime_super)
        addPred((f: File) => f.mime_super === where?.mime_super);
      if (where?.mime_sub) addPred((f: File) => f.mime_sub === where?.mime_sub);
      if (where?.isDirectory)
        addPred((f: File) => !!f.isDirectory === !!where?.isDirectory);
      return files.filter(pred);
    }
  }
  static normalise(fpath: string): string {
    return path.normalize(fpath).replace(/^(\.\.(\/|\\|$))+/, "");
  }

  static normalise_in_base(
    trusted_base: string,
    ...unsafe_paths: string[]
  ): string | null {
    //normalise paths: legacy support for ../files/ paths
    const norm_paths = unsafe_paths.map((p) => File.normalise(p));
    // combine the paths via path.join() which also normalizes
    // traversal sequences
    const joined_path = path.join(trusted_base, ...norm_paths);
    // validate that the resulting path is still within the trusted
    // base
    if (joined_path.startsWith(trusted_base)) return joined_path;
    else return null;
  }
  static async rootFolder(): Promise<File> {
    const tenant = db.getTenantSchema();

    return await File.from_file_on_disk(
      "/",
      path.join(db.connectObj.file_store, tenant)
    );
  }
  static absPathToServePath(absPath: string | number): string {
    if (typeof absPath === "number") return `${absPath}`;
    const tenant = db.getTenantSchema();
    const s = absPath.replace(path.join(db.connectObj.file_store, tenant), "");
    return s[0] === "/" ? s.substring(1) : s;
  }

  get absolutePath(): string {
    const tenant = db.getTenantSchema();
    const safeDir = File.absPathToServePath(File.normalise(this.location));
    return path.join(db.connectObj.file_store, tenant, safeDir);
  }

  /**
   * get all directories in the root folder (tenant root dir for multi-tenant)
   * @param ignoreCache if a cache exists, ignore it
   * @returns
   */
  static async allDirectories(ignoreCache?: boolean): Promise<Array<File>> {
    const tenant = db.getTenantSchema();
    if (!ignoreCache) {
      const cache = File.getDirCache();
      if (cache === "building") {
        return new Promise((resolve, reject) => {
          function go(waitms: number) {
            const cache = File.getDirCache();
            if (!cache)
              reject(new Error("Timeout in File.allDirectories cache"));
            else if (cache === "building") {
              if (waitms > 120 * 1000)
                reject(new Error("Timeout in File.allDirectories cache"));
              else
                setTimeout(() => {
                  go(waitms * 1.5);
                }, waitms);
            } else resolve(cache);
          }
          go(50);
        });
      } else if (cache) {
        return cache;
      } else if (enableDirCache[tenant]) {
        await File.reallyBuildDirCache();
        const cache = File.getDirCache();
        if (cache && cache !== "building") {
          return cache;
        }
      }
    }
    const root = path.join(db.connectObj.file_store, tenant);
    const allPaths: string[] = [];
    const iterFolder = async (folder: string) => {
      allPaths.push(folder);
      const files = await fsp.readdir(folder, { withFileTypes: true });
      for (const f of files) {
        if (f.isDirectory()) await iterFolder(path.join(folder, f.name));
      }
    };
    await iterFolder(root);

    return await asyncMap(allPaths, async (p: string) => {
      let relnm = p.replace(root, "");
      if (relnm[0] === "/") relnm = relnm.slice(1);
      const fs = await File.find({ filename: relnm || "/" });
      return fs[0];
    });
  }

  static async buildDirCache() {
    enableDirCache[db.getTenantSchema()] = true;
  }
  static async reallyBuildDirCache() {
    dirCache[db.getTenantSchema()] = "building";
    dirCache[db.getTenantSchema()] = await File.allDirectories(true);
  }

  static getDirCache() {
    return dirCache[db.getTenantSchema()];
  }

  static destroyDirCache() {
    enableDirCache[db.getTenantSchema()] = false;
    dirCache[db.getTenantSchema()] = null;
  }

  async is_symlink(): Promise<boolean> {
    try {
      let stat = await fsp.lstat(this.location);
      return stat.isSymbolicLink();
    } catch (e) {
      throw new Error("File.is_symlink: File not found: " + this.location);
    }
  }

  static nameToMimeType(filepath: string): string | false {
    const filename = path.basename(filepath);
    if (filename && filename.endsWith(".py")) return "text/x-python";
    return lookup(filename);
  }

  static async from_file_on_disk(
    name: string,
    absoluteFolder: string
  ): Promise<File> {
    let stat;
    try {
      stat = await fsp.stat(path.join(absoluteFolder, name));
    } catch (e) {
      throw new Error("File.from_file_on_disk: File not found: " + name);
    }
    let min_role_read, user_id;
    try {
      min_role_read = +(await xattr_get(
        path.join(absoluteFolder, name),
        "user.saltcorn.min_role_read"
      ));
      if (isNaN(min_role_read)) min_role_read = 100;
    } catch (e) {
      min_role_read = 100;
    }
    try {
      const uid = await xattr_get(
        path.join(absoluteFolder, name),
        "user.saltcorn.user_id"
      );
      //console.log({ name, uid });

      user_id = +uid;
    } catch (e) {}

    const isDirectory = stat.isDirectory();
    const mimetype = File.nameToMimeType(name);
    const [mime_super, mime_sub] = mimetype ? mimetype.split("/") : ["", ""];
    return new File({
      filename: name,
      location: path.join(absoluteFolder, name),
      size_kb: Math.round(stat.size / 1024),
      uploaded_at: stat.birthtime,
      mime_super,
      mime_sub,
      user_id,
      isDirectory,
      min_role_read,
    });
  }

  /**
   * Select one file descriptor
   *
   * @param where
   * @returns {Promise<File|null>}
   */
  static async findOne(where: Where | string): Promise<File | null> {
    if (typeof where === "string") {
      const { getState } = require("../db/state");
      const state = getState();
      const useS3 = state?.getConfig("storage_s3_enabled");
      //legacy serving ids
      if (/^\d+$/.test(where)) {
        const legacy_file_id_locations = state?.getConfig(
          "legacy_file_id_locations"
        );
        //console.log("lfil", legacy_file_id_locations);

        if (legacy_file_id_locations?.[where]) {
          const legacy_file = await File.findOne(
            legacy_file_id_locations?.[where]
          );
          return legacy_file;
        }
      }

      if (useS3) {
        const files = await File.find({ id: +where });
        return files[0];
      } else {
        const tenant = db.getTenantSchema();

        const safeDir = path.normalize(where).replace(/^(\.\.(\/|\\|$))+/, "");
        const absoluteFolder = path.join(
          db.connectObj.file_store,
          tenant,
          safeDir
        );
        const name = path.basename(absoluteFolder);
        const dir = path.dirname(absoluteFolder);
        try {
          return await File.from_file_on_disk(name, dir);
        } catch (e: any) {
          state?.log(2, e?.toString ? e.toString() : e);
          return null;
        }
      }
    }
    const files = await File.find(where);
    return files.length > 0 ? new File(files[0]) : null;
  }

  /**
   * Create new folder
   * @param name
   * @param inFolder
   */
  static async new_folder(name: string, inFolder: string = ""): Promise<void> {
    const tenant = db.getTenantSchema();

    const safeDir = path.normalize(name).replace(/^(\.\.(\/|\\|$))+/, "");
    const safeInDir = path.normalize(inFolder).replace(/^(\.\.(\/|\\|$))+/, "");
    const absoluteFolder = path.join(
      db.connectObj.file_store,
      tenant,
      safeInDir,
      safeDir
    );
    await mkdir(absoluteFolder, { recursive: true });

    return;
  }

  /**
   * Get path to serve
   */
  get path_to_serve(): string | number {
    if (this.s3_store && this.id) return this.id;
    const tenant = db.getTenantSchema();
    const s = this.location.replace(
      path.join(db.connectObj.file_store, tenant),
      ""
    );
    return s[0] === "/" ? s.substring(1) : s;
  }

  /**
   * Get current folder
   */
  get current_folder(): string {
    return path.dirname(this.path_to_serve);
  }
  /**
   * Update File descriptor
   *
   * @param id - primary key
   * @param row - row data
   * @returns {Promise<void>} no returns
   */
  static async update(id: number, row: Row): Promise<void> {
    await db.update("_sc_files", row, id);
  }

  /**
   * Set Min Role to read for file
   * @param min_role_read target Role for file to read
   */
  async set_role(min_role_read: number) {
    if (this.id) {
      await File.update(this.id, { min_role_read });
    } else {
      await xattr_set(
        this.location,
        "user.saltcorn.min_role_read",
        `${min_role_read}`
      );
    }
    this.min_role_read = min_role_read;
  }

  /**
   * Set user for file
   * @param user_id target user_id
   */
  async set_user(user_id: number) {
    if (this.id) {
      await File.update(this.id, { user_id });
    } else {
      await xattr_set(this.location, "user.saltcorn.user_id", `${user_id}`);
    }
    this.user_id = user_id;
  }

  /**
   * Rename file
   * @param filenameIn target file name
   */
  async rename(filenameIn: string): Promise<void> {
    const filename = File.normalise(filenameIn);
    if (this.id) {
      await File.update(this.id, { filename });
    } else {
      const newPath = path.join(path.dirname(this.location), filename);

      await fsp.rename(this.location, newPath);
      await File.update_table_references(
        this.path_to_serve as string,
        path.join(path.dirname(this.path_to_serve), filename)
      );
      this.location = newPath;
      this.filename = filename;
    }
  }

  /**
   *
   * @param from
   * @param to
   */
  static async update_table_references(from: string, to: string) {
    const Field = require("./field");
    const Table = require("./table");
    const fileFields = await Field.find({ type: "File" }, { cached: true });
    const schema = db.getTenantSchemaPrefix();
    for (const field of fileFields) {
      const table = Table.findOne({ id: field.table_id });
      if (table.external || table.provider_name) continue;
      await db.query(
        `update ${schema}"${db.sqlsanitize(table.name)}" set "${
          field.name
        }" = $1 where "${field.name}" = $2`,
        [to, from]
      );
    }
  }

  /**
   * Move file to other folder
   * @param newFolder target folder for file
   */
  async move_to_dir(newFolder: string): Promise<void> {
    const newFolderNormd = File.normalise(newFolder);
    const tenant = db.getTenantSchema();

    const file_store = db.connectObj.file_store;
    const newPath = path.join(
      file_store,
      tenant,
      newFolderNormd,
      this.filename
    );

    await fsp.rename(this.location, newPath);
    await File.update_table_references(
      this.path_to_serve as string,
      path.join(newFolderNormd, this.filename)
    );
    this.location = newPath;
  }
  /**
   * Get absolute path to new file in db.connectObj.file_store.
   *
   * @param suggest - path to file inside file store. If undefined that autogenerated uudv4 is used.
   * @param renameIfExisting
   * @returns {string} - path to file
   */
  static get_new_path(suggest?: string, renameIfExisting?: boolean): string {
    const { getState } = require("../db/state");
    const state = getState();

    // Check if it uses S3, then use a default "saltcorn" folder
    const useS3 = state?.getConfig("storage_s3_enabled");
    const tenant = db.getTenantSchema();

    const file_store = !useS3 ? db.connectObj.file_store : "saltcorn/";

    const newFnm = suggest || uuidv4();
    let newPath = join(file_store, tenant, newFnm);
    if (renameIfExisting && fs.existsSync(newPath)) {
      const dir = path.dirname(newPath);

      const files_in_dir = new Set(fs.readdirSync(dir));
      for (let i = 1; i < 999999999; i++) {
        let newbase = newFnm;

        const ext = path.extname(newFnm);
        const filenoext = path.basename(newFnm, ext);
        const newFileName = `${filenoext}_${i}${ext}`;
        newbase = path.join(path.dirname(newFnm), newFileName);

        newPath = join(file_store, tenant, newbase);
        if (!files_in_dir.has(newFileName)) {
          break;
        }
      }
    }

    return newPath;
  }

  /**
   * Ensure that file_store path is physically exists in file system.
   * In reality just recursively creates full absolute path to db.connectObj.file_store.
   *
   * @returns {Promise<void>}
   */
  // TBD fs errors handling
  static async ensure_file_store(tenant_name?: string): Promise<void> {
    const { getState, getAllTenants } = require("../db/state");
    const file_store = db.connectObj.file_store;
    if (tenant_name) {
      await mkdir(path.join(file_store, tenant_name), { recursive: true });
      return;
    }
    if (!getState()?.getConfig("storage_s3_enabled")) {
      await mkdir(file_store, { recursive: true });
      const tenants = getAllTenants();
      for (const tenant of Object.keys(tenants)) {
        await mkdir(path.join(file_store, tenant), { recursive: true });
      }
    }
  }

  /**
   * Create new file
   * @param file
   * @param user_id
   * @param min_role_read
   * @param folder
   * @returns
   */
  static async from_req_files(
    file: {
      mimetype: string;
      name: string;
      mv: Function;
      size: number;
      s3object?: boolean;
    },
    user_id: number,
    min_role_read: number = 1,
    folder: string = "/"
  ): Promise<File> {
    if (Array.isArray(file)) {
      return await asyncMap(file, (f: any) =>
        File.from_req_files(f, user_id, min_role_read, folder)
      );
    } else {
      // get path to file
      const newPath = File.get_new_path(path.join(folder, file.name), true);
      // set mime type
      const [mime_super, mime_sub] = file.mimetype.split("/");
      // move file in file system to newPath
      await file.mv(newPath);
      // create file
      return await File.create({
        filename: file.name,
        location: newPath,
        uploaded_at: new Date(),
        size_kb: Math.round(file.size / 1024),
        user_id,
        mime_super,
        mime_sub,
        min_role_read,
        s3_store: !!file.s3object,
      });
    }
  }

  async get_contents(
    encoding?: "utf8" | "base64" | "base64url" | "hex" | "ascii"
  ): Promise<Buffer> {
    return await fsp.readFile(this.location, encoding);
  }
  /**
   * Create new file
   * @param name
   * @param mimetype
   * @param contents
   * @param user_id
   * @param min_role_read
   * @param folder
   * @returns
   */
  static async from_contents(
    name: string,
    mimetype: string,
    contents: string | Buffer | ArrayBuffer,
    user_id: number,
    min_role_read: number = 1,
    folder: string = "/"
  ): Promise<File> {
    // get path to file
    const newPath = File.get_new_path(path.join(folder, name), true);
    // set mime type
    const [mime_super, mime_sub] = mimetype.split("/");
    // move file in file system to newPath
    const contents1 =
      contents instanceof ArrayBuffer ? Buffer.from(contents) : contents;
    await fsp.writeFile(newPath, contents1);
    // create file
    const file = await File.create({
      filename: path.basename(newPath),
      location: newPath,
      uploaded_at: new Date(),
      size_kb: contents1.length,
      user_id,
      mime_super,
      mime_sub,
      min_role_read,
    });
    //file.location = File.absPathToServePath(file.location);
    return file;
  }

  async overwrite_contents(
    contents: string | Buffer | ArrayBuffer
  ): Promise<void> {
    await fsp.writeFile(this.location, contents);
  }

  /**
   * Delete file
   * @returns {Promise<{error}>}
   */

  async delete(
    unlinker?: (arg0: File) => Promise<void>
  ): Promise<{ error: string } | void> {
    try {
      // delete file from database
      if (this.id) await db.deleteWhere("_sc_files", { id: this.id });
      // delete name and possible file from file system
      if (unlinker) await unlinker(this);
      else if (this.isDirectory) {
        //delete all resized before attempting to delete dir

        const fileNms = await fsp.readdir(this.location);

        for (const name of fileNms) {
          if (name.startsWith("_resized_"))
            await unlink(path.join(this.location, name));
        }

        await fsp.rm(this.location, { recursive: true });
      } else await unlink(this.location);
      if (db.reset_sequence) await db.reset_sequence("_sc_files");
      // reload file list cache
    } catch (e: any) {
      console.error(e);
      return { error: e.message };
    }
  }

  /**
   * MIME type of the file
   * @type {string}
   */
  get mimetype(): string {
    if (this.mime_super && this.mime_sub)
      return `${this.mime_super}/${this.mime_sub}`;
    else return "";
  }

  /**
   * Create file
   * @param f
   * @returns {Promise<File>}
   */
  static async create(f: FileCfg): Promise<File> {
    const file = new File(f);
    //const { id, ...rest } = file;
    // insert file descriptor row to database
    //file.id = await db.insert("_sc_files", rest);
    // refresh file list cache
    await file.set_role(file.min_role_read);
    if (file.user_id) await file.set_user(file.user_id);
    return file;
  }

  /**
   * This is a mobile-app function, it uploads a file to the saltcorn server.
   * @param file file to upload
   * @returns JSON response from POST 'file/upload'
   */
  static async upload(file: { blob: Blob; fileObj: any }): Promise<any> {
    const { getState } = require("../db/state");
    const state = getState();
    const base_url = state.getConfig("base_url") || "http://10.0.2.2:3000";
    const url = `${base_url}/files/upload`;
    const token = state.mobileConfig.jwt;
    const formData = new FormData();
    formData.append("file", file.blob, file.fileObj.name);
    const response = await axios.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `jwt ${token}`,
        "X-Requested-With": "XMLHttpRequest",
        "X-Saltcorn-Client": "mobile-app",
      },
    });
    return response.data.success;
  }

  static async set_xattr_of_existing_file(
    name: string,
    absoluteFolder: string,
    user: User
  ): Promise<void> {
    if (!user.id)
      throw new Error("Unable to set the attributes, the user has no id");
    const file = await File.from_file_on_disk(name, absoluteFolder);
    await file.set_user(user.id);
    await file.set_role(user.role_id);
  }
}

namespace File {
  export type FileCfg = {
    filename: string;
    location: string;
    uploaded_at: string | number | Date;
    size_kb: number;
    id?: number;
    user_id?: number;
    mime_super: string;
    mime_sub: string;
    min_role_read: number;
    s3_store?: boolean;
    isDirectory?: boolean;
  };
}
type FileCfg = PartialSome<
  File,
  | "filename"
  | "location"
  | "uploaded_at"
  | "size_kb"
  | "mime_super"
  | "mime_sub"
  | "min_role_read"
>;

export = File;
