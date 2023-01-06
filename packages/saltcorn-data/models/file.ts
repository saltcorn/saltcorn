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
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import axios from "axios";
import FormData from "form-data";
import { renameSync, statSync, existsSync } from "fs";
import { lookup } from "mime-types";
const path = require("path");
const fsp = require("fs").promises;
const fs = require("fs");
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
      if (selectopts.cached) {
        // TODO ch migrate State and replace any
        const files = Object.values(getState().files).sort((a: any, b: any) =>
          a.filename > b.filename ? 1 : -1
        );
        return files.map((t: any) => new File(t));
      }
      if (where?.inDB) delete where.inDB;
      const db_flds = await db.select("_sc_files", where, selectopts);
      return db_flds.map((dbf: FileCfg) => new File(dbf));
    } else {
      const relativeSearchFolder = where?.folder || "/";
      const tenant = db.getTenantSchema();
      const safeDir = File.normalise(relativeSearchFolder);
      const absoluteFolder = path.join(
        db.connectObj.file_store,
        tenant,
        safeDir
      );
      const files: File[] = [];
      if (where?.filename) {
        files.push(
          await File.from_file_on_disk(where?.filename, absoluteFolder)
        );
      } else {
        let fileNms;
        try {
          fileNms = await fsp.readdir(absoluteFolder);
        } catch (e) {
          fileNms = [];
        }

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
  static async allDirectories(): Promise<Array<File>> {
    const allDirs: File[] = [await File.rootFolder()];
    const iterFolder = async (folder?: string) => {
      const files = await File.find(folder ? { folder } : {});
      for (const f of files) {
        if (f.isDirectory) {
          allDirs.push(f);
          await iterFolder(f.path_to_serve as string);
        }
      }
    };
    await iterFolder();

    return allDirs;
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
      min_role_read = +(await xattr.get(
        path.join(absoluteFolder, name),
        "user.saltcorn.min_role_read"
      ));
    } catch (e) {
      min_role_read = 10;
    }
    try {
      user_id = +(await xattr.get(
        path.join(absoluteFolder, name),
        "user.saltcorn.user_id"
      ));
    } catch (e) {}

    const isDirectory = stat.isDirectory();
    const mimetype = lookup(name);
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

  static async new_folder(
    name: string,
    inFolder: string = ""
  ): Promise<undefined> {
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

  get path_to_serve(): string | number {
    if (this.s3_store && this.id) return this.id;
    const tenant = db.getTenantSchema();
    const s = this.location.replace(
      path.join(db.connectObj.file_store, tenant),
      ""
    );
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

  async set_user(user_id: number) {
    // const fsx = await import("fs-xattr");
    if (this.id) {
      await File.update(this.id, { user_id });
    } else {
      await xattr.set(this.location, "user.saltcorn.user_id", `${user_id}`);
    }
  }

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

  static async update_table_references(from: string, to: string) {
    const Field = require("./field");
    const Table = require("./table");
    const fileFields = await Field.find({ type: "File" });
    const schema = db.getTenantSchemaPrefix();
    for (const field of fileFields) {
      const table = Table.findOne({ id: field.table_id });
      await db.query(
        `update ${schema}"${db.sqlsanitize(table.name)}" set "${
          field.name
        }" = $1 where "${field.name}" = $2`,
        [to, from]
      );
    }
  }

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
    if (renameIfExisting) {
      for (let i = 0; i < 5000; i++) {
        let newbase = newFnm;
        if (i) {
          const ext = path.extname(newFnm);
          const filenoext = path.basename(newFnm, ext);
          newbase = path.join(path.dirname(newFnm), `${filenoext}_${i}${ext}`);
        }
        newPath = File.get_new_path(newbase, false);
        if (!fs.existsSync(newPath)) {
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
  /**
   * Create new file
   * @param file
   * @param user_id
   * @param min_role_read
   * @param folder
   * @returns
   */
  static async from_contents(
    name: string,
    mimetype: string,
    contents: string | Buffer,
    user_id: number,
    min_role_read: number = 1,
    folder: string = "/"
  ): Promise<File> {
    // get path to file
    const newPath = File.get_new_path(path.join(folder, name), true);
    // set mime type
    const [mime_super, mime_sub] = mimetype.split("/");
    // move file in file system to newPath
    await fsp.writeFile(newPath, contents);
    // create file
    const file = await File.create({
      filename: name,
      location: newPath,
      uploaded_at: new Date(),
      size_kb: contents.length,
      user_id,
      mime_super,
      mime_sub,
      min_role_read,
    });
    file.location = File.absPathToServePath(file.location);
    return file;
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

        await fsp.rmdir(this.location);
      } else await unlink(this.location);
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
    await file.set_role(file.min_role_read);
    if (file.user_id) await file.set_user(file.user_id);
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
