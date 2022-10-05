/**
 * File Database Access Layer
 * @category saltcorn-data
 * @module models/file
 * @subcategory models
 */

import db from "../db";
import { v4 as uuidv4 } from "uuid";
import { join } from "path";
const { asyncMap } = require("../utils");
import { mkdir, unlink } from "fs/promises";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import axios from "axios";
import FormData from "form-data";
import { renameSync, statSync, existsSync } from "fs";
import { lookup } from "mime-types";
const path = require("path");
const fs = require("fs").promises;
const xattr = require("fs-xattr");
declare let window: any;

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
  folder?: string;
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
    this.folder = o.folder || "/";
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

    const useS3 = getState().getConfig("storage_s3_enabled");
    if (useS3 || where?.inDB) {
      if (selectopts.cached) {
        const { getState } = require("../db/state");
        // TODO ch migrate State and replace any
        const files = Object.values(getState().files).sort((a: any, b: any) =>
          a.filename > b.filename ? 1 : -1
        );
        return files.map((t: any) => new File(t));
      }
      const db_flds = await db.select("_sc_files", where, selectopts);
      return db_flds.map((dbf: FileCfg) => new File(dbf));
    } else {
      const relativeSearchFolder = where?.folder || "/";

      const safeDir = File.normalise(relativeSearchFolder);
      const absoluteFolder = path.join(db.connectObj.file_store, safeDir);
      const files: File[] = [];
      if (where?.filename) {
        files.push(
          await File.from_file_on_disk(where?.filename, absoluteFolder)
        );
      } else {
        const fileNms = await fs.readdir(absoluteFolder);

        for (const name of fileNms) {
          if (name[0] === "." || name.startsWith("_resized_")) continue;
          files.push(await File.from_file_on_disk(name, absoluteFolder));
        }
      }
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
  static absPathToServePath(absPath: string | number): string {
    if (typeof absPath === "number") return `${absPath}`;
    const s = absPath.replace(db.connectObj.file_store, "");
    return s[0] === "/" ? s.substring(1) : s;
  }

  static async from_file_on_disk(
    name: string,
    absoluteFolder: string
  ): Promise<File> {
    const stat = await fs.stat(path.join(absoluteFolder, name));
    let min_role_read;
    try {
      min_role_read = +(await xattr.get(
        path.join(absoluteFolder, name),
        "user.saltcorn.min_role_read"
      ));
    } catch (e) {
      min_role_read = 10;
    }

    const isDirectory = stat.isDirectory();
    const mimetype = lookup(name);
    const [mime_super, mime_sub] = mimetype ? mimetype.split("/") : ["", ""];
    return new File({
      filename: name,
      location: path.join(absoluteFolder, name),
      size_kb: Math.round(stat.size / 1024),
      uploaded_at: stat.ctime,
      mime_super,
      mime_sub,
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

      const useS3 = getState().getConfig("storage_s3_enabled");
      if (useS3) {
        const files = await File.find({ id: +where });
        return files[0];
      } else {
        const safeDir = path.normalize(where).replace(/^(\.\.(\/|\\|$))+/, "");
        const absoluteFolder = path.join(db.connectObj.file_store, safeDir);
        const name = path.basename(absoluteFolder);
        const dir = path.dirname(absoluteFolder);
        return await File.from_file_on_disk(name, dir);
      }
    }
    const files = await File.find(where);
    return files.length > 0 ? new File(files[0]) : null;
  }

  static async new_folder(
    name: string,
    inFolder: string = ""
  ): Promise<undefined> {
    const safeDir = path.normalize(name).replace(/^(\.\.(\/|\\|$))+/, "");
    const safeInDir = path.normalize(inFolder).replace(/^(\.\.(\/|\\|$))+/, "");
    const absoluteFolder = path.join(
      db.connectObj.file_store,
      safeInDir,
      safeDir
    );
    await mkdir(absoluteFolder, { recursive: true });

    return;
  }

  get path_to_serve(): string | number {
    if (this.s3_store && this.id) return this.id;
    const s = this.location.replace(db.connectObj.file_store, "");
    return s[0] === "/" ? s.substring(1) : s;
  }

  get current_folder() {
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
    await require("../db/state").getState().refresh_files();
  }

  async set_role(min_role_read: number) {
    // const fsx = await import("fs-xattr");
    if (this.id) {
      await File.update(this.id, { min_role_read });
    } else {
      await xattr.set(
        this.location,
        "user.saltcorn.min_role_read",
        `${min_role_read}`
      );
    }
  }

  async rename(filenameIn: string): Promise<void> {
    const filename = File.normalise(filenameIn);
    if (this.id) {
      await File.update(this.id, { filename });
    } else {
      const newPath = path.join(path.dirname(this.location), filename);

      await fs.rename(this.location, newPath);
      this.location = newPath;
      this.filename = filename;
    }
  }
  /**
   * Get absolute path to new file in db.connectObj.file_store.
   *
   * @param suggest - path to file inside file store. If undefined that autogenerated uudv4 is used.
   * @returns {string} - path to file
   */
  static get_new_path(suggest?: string): string {
    const { getState } = require("../db/state");

    // Check if it uses S3, then use a default "saltcorn" folder
    const useS3 = getState().getConfig("storage_s3_enabled");
    const file_store = !useS3 ? db.connectObj.file_store : "saltcorn/";

    const newFnm = suggest || uuidv4();
    const newPath = join(file_store, newFnm);
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
    if (!getState().getConfig("storage_s3_enabled")) {
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
      const newPath = File.get_new_path(path.join(folder, file.name));
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

  /**
   * create a '_sc_files' entry from an existing file.
   * The old file will be moved to a new location.
   *
   * @param directory directory of existing file
   * @param name name of existing file
   * @param userId id of creating user
   * @returns the new File object
   */
  static async from_existing_file(
    directory: string,
    name: string,
    userId: number
  ) {
    const fullPath = join(directory, name);
    if (!existsSync(fullPath)) return null;
    const file: any = {
      mimetype: lookup(fullPath),
      name: name,
      mv: (newPath: string) => {
        renameSync(fullPath, newPath);
      },
      size: statSync(fullPath).size,
    };
    return await File.from_req_files(file, userId);
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
      else if (this.isDirectory) await fs.rmdir(this.location);
      else await unlink(this.location);
      if (db.reset_sequence) await db.reset_sequence("_sc_files");
      // reload file list cache
      await require("../db/state").getState().refresh_files();
    } catch (e: any) {
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
    //await require("../db/state").getState().refresh_files();

    return file;
  }

  /**
   * This is a mobile-app function, it uploads a file to the saltcorn server.
   * @param f file to upload
   * @returns JSON response from POST 'file/upload'
   */
  static async upload(f: any): Promise<any> {
    const { getState } = require("../db/state");
    const base_url = getState().getConfig("base_url") || "http://10.0.2.2:3000";
    const url = `${base_url}/files/upload`;
    const token = window.localStorage.getItem("auth_jwt");
    const formData = new FormData();
    formData.append("file", f);
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
}

namespace File {
  export type FileCfg = {
    filename: string;
    location: string;
    folder?: string;
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
type FileCfg = File.FileCfg;

export = File;
