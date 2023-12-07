const { getState } = require("@saltcorn/data/db/state");
import db from "@saltcorn/data/db/index";
import Table from "@saltcorn/data/models/table";
import { instanceOfErrorMsg } from "@saltcorn/types/common_types";
import View from "@saltcorn/data/models/view";
import File from "@saltcorn/data/models/file";
import Field from "@saltcorn/data/models/field";
import Role from "@saltcorn/data/models/role";
import Page from "@saltcorn/data/models/page";
import Plugin from "@saltcorn/data/models/plugin";
import Zip from "adm-zip";
import { dir } from "tmp-promise";
import {
  writeFile,
  mkdir,
  copyFile,
  readFile,
  unlink,
  readdir,
  stat,
} from "fs/promises";
import { existsSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import dateFormat from "dateformat";
import stringify from "csv-stringify/lib/sync";
import csvtojson from "csvtojson";
import pack from "./pack";
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  tag_pack,
  model_instance_pack,
  event_log_pack,
  install_pack,
  can_install_pack,
} = pack;

const { asyncMap } = require("@saltcorn/data/utils");
import Trigger from "@saltcorn/data/models/trigger";
import Library from "@saltcorn/data/models/library";
import Tag from "@saltcorn/data/models/tag";
import Model from "@saltcorn/data/models/model";
import ModelInstance from "@saltcorn/data/models/model_instance";
import EventLog from "@saltcorn/data/models/eventlog";
import path from "path";

/**
 * @param [withEventLog] - include event log
 */
const create_pack_json = async (
  withEventLog: boolean = false
): Promise<object> => {
  // tables
  const tables = await asyncMap(
    await Table.find({}),
    async (t: Table) => await table_pack(t) // find already done before
  );
  // views
  const views = await asyncMap(
    await View.find({}),
    async (v: View) => await view_pack(v.name)
  );
  // plugins
  const plugins = await asyncMap(
    await Plugin.find({}),
    async (v: Plugin) => await plugin_pack(v.name)
  );
  // pages
  const pages = await asyncMap(
    await Page.find({}),
    async (v: Page) => await page_pack(v.name)
  );

  // triggers
  const triggers = Trigger.find({}).map((tr: Trigger) => tr.toJson);
  // roles
  const roles = await Role.find({});
  // library
  const library = (await Library.find({})).map((l: Library) => l.toJson);
  // tags
  const tags = await asyncMap(
    await Tag.find({}),
    async (v: Tag) => await tag_pack(v.name)
  );
  // models
  const models = (await Model.find({})).map((m: Model) => m.toJson);
  // model instances
  const model_instances = await asyncMap(
    await ModelInstance.find({}),
    async (modelinst: ModelInstance) => {
      const model = await Model.findOne({ id: modelinst.model_id });
      if (!model)
        throw new Error(`Model of instance '${modelinst.name}' not found`);
      const table = await Table.findOne({ id: model.table_id });
      if (!table) throw new Error(`Table of model '${model.name}' not found`);
      return await model_instance_pack(modelinst.name, model.name, table.name);
    }
  );
  // optional event log
  const event_logs = withEventLog
    ? await asyncMap(
        await EventLog.find({}),
        async (e: EventLog) => await event_log_pack(e)
      )
    : [];

  return {
    tables,
    views,
    plugins,
    pages,
    triggers,
    roles,
    library,
    tags,
    models,
    model_instances,
    event_logs,
  };
};

/**
 * @param dirpath
 */
const create_pack = async (dirpath: string): Promise<void> => {
  const pack = await create_pack_json(
    getState().getConfig("backup_with_event_log", false)
  );

  await writeFile(join(dirpath, "pack.json"), JSON.stringify(pack));
};

/**
 *
 * @param rows
 * @param fnm
 */
const create_csv_from_rows = async (
  rows: any[],
  fnm: string
): Promise<void> => {
  if (rows.length === 0) return;

  const s = stringify(rows, {
    header: true,
    cast: {
      date: (value: Date) => value.toISOString(),
    },
  });

  await writeFile(fnm, s);
};

/**
 * @function
 * @param {Table} table
 * @param {string} dirpath
 * @returns {Promise<void>}
 */
const create_table_json = async (
  table: Table,
  dirpath: string
): Promise<void> => {
  const rows = await table.getRows({}, { ignore_errors: true });
  await writeFile(join(dirpath, table.name + ".json"), JSON.stringify(rows));
};

/**
 * @function
 * @param {string} root_dirpath
 * @return {Promise<void>}
 */
const create_table_jsons = async (root_dirpath: string): Promise<void> => {
  const dirpath = join(root_dirpath, "tables");
  await mkdir(dirpath, { recursive: true });
  const tables = await Table.find({});
  for (const t of tables) {
    if (!t.external && !t.provider_name) await create_table_json(t, dirpath);
  }
};

/**
 * @function
 * @param {string} root_dirpath
 * @returns {Promise<void>}
 */
const backup_files = async (root_dirpath: string): Promise<void> => {
  const backup_file_prefix = getState().getConfig("backup_file_prefix");

  const dirpath = join(root_dirpath, "files");
  await mkdir(dirpath);

  const allFiles: File[] = [];
  const iterFolder = async (folder?: string) => {
    const files = await File.find(folder ? { folder } : {});
    for (const f of files) {
      const base = basename(f.location);
      if (f.isDirectory && (await f.is_symlink())) continue;
      else if (f.isDirectory && !(await f.is_symlink())) {
        await mkdir(join(dirpath, f.path_to_serve as string));
        await iterFolder(f.path_to_serve as string);
      } else {
        //exclude auto backups
        if (
          base.startsWith(
            `${backup_file_prefix}${getState().getConfig(
              "site_name",
              "Saltcorn"
            )}`
          ) &&
          f.mime_sub === "zip" &&
          !f.user_id
        )
          continue;
        await copyFile(f.location, join(dirpath, folder || "", base));
      }
      f.location = path.join(folder || "", base);
      allFiles.push(f);
    }
  };
  await iterFolder();

  await create_csv_from_rows(allFiles, join(root_dirpath, "files.csv"));
};

/**
 * @function
 * @param {string} root_dirpath
 * @returns {Promise<void>}
 */
const backup_config = async (root_dirpath: string): Promise<void> => {
  const dirpath = join(root_dirpath, "config");
  await mkdir(dirpath);

  const cfgs = await db.select("_sc_config");

  for (const cfg of cfgs) {
    await writeFile(
      join(dirpath, cfg.key),
      JSON.stringify(db.isSQLite ? JSON.parse(cfg.value) : cfg.value)
    );
  }
};

/**
 * Create backup
 * @param fnm
 */
const create_backup = async (fnm?: string): Promise<string> => {
  const tmpDir = await dir({ unsafeCleanup: true });

  await create_pack(tmpDir.path);
  await create_table_jsons(tmpDir.path);
  await backup_files(tmpDir.path);
  await backup_config(tmpDir.path);

  const day = dateFormat(new Date(), "yyyy-mm-dd-HH-MM");

  const ten = db.getTenantSchema();
  const tens =
    ten === db.connectObj.default_schema
      ? getState().getConfig("site_name", "Saltcorn")
      : ten;
  const backup_file_prefix = getState().getConfig("backup_file_prefix");
  const zipFileName = fnm || `${backup_file_prefix}${tens}-${day}.zip`;

  const zip = new Zip();
  zip.addLocalFolder(tmpDir.path);
  zip.writeZip(zipFileName);
  await tmpDir.cleanup();
  return zipFileName;
};

/**
 * @function
 * @param {string} fnm
 * @param {string} dir
 * @returns {Promise<void>}
 */
const extract = async (fnm: string, dir: string): Promise<void> => {
  return new Promise(function (resolve, reject) {
    const zip = new Zip(fnm);
    zip.extractAllToAsync(dir, true, function (err) {
      if (err) reject(new Error("Error opening zip file: " + err));
      else resolve();
    });
  });
};

/**
 * @function
 * @param {string} dirpath
 * @returns {Promise<object>}
 */
const restore_files = async (dirpath: string): Promise<any> => {
  const fnm = join(dirpath, "files.csv");
  const file_users: any = {};
  const newLocations: any = {};
  if (existsSync(fnm)) {
    const file_rows = await csvtojson().fromFile(fnm);
    for (const file of file_rows) {
      if (file.isDirectory)
        await mkdir(File.get_new_path(file.location), { recursive: true });
    }
    for (const file of file_rows) {
      const newPath = File.get_new_path(
        file.id ? file.filename : file.location
      );
      //copy file
      if (!file.isDirectory)
        await copyFile(join(dirpath, "files", file.location), newPath);
      file_users[file.location] = file.user_id;
      //set location
      if (file.id)
        newLocations[file.id] = file.id ? file.filename : file.location;
      file.location = newPath;
      //insert in db

      await File.create(file);
      //const id = await db.insert("_sc_files", file_row);
    }
    if (db.reset_sequence) await db.reset_sequence("_sc_files");
  }
  return { file_users, newLocations };
};
/**
 * Correct fileid references to location
 * @param newLocations
 */
const correct_fileid_references_to_location = async (newLocations: any) => {
  const fileFields = await Field.find({ type: "File" });
  for (const field of fileFields) {
    const table = Table.findOne({ id: field.table_id });

    const rows = await table!.getRows({});
    for (const row of rows) {
      if (row[field.name] && newLocations[row[field.name]]) {
        await table!.updateRow(
          { [field.name]: newLocations[row[field.name]] },
          row[table!.pk_name]
        );
      }
    }
  }
};
/**
 * @function Restore file users
 * @param {object} file_users
 * @returns {Promise<void>}
 */
const restore_file_users = async (file_users: any): Promise<void> => {
  for (const [id, user_id] of Object.entries(file_users)) {
    if (user_id) {
      const file = await File.findOne(id);
      if (file) await file.set_user(user_id as number);
      //await db.update("_sc_files", { user_id }, id);
    }
  }
};

/**
 * @function Restore Tables
 * @param {string} dirpath
 * @param {boolean} [restore_first_user]
 * @returns {Promise<string|undefined>}
 */
const restore_tables = async (
  dirpath: string,
  restore_first_user?: boolean
): Promise<string | void> => {
  let err;
  const tables = await Table.find();
  for (const table of tables) {
    const fnm_csv =
      table.name === "users"
        ? join(dirpath, "users.csv")
        : join(dirpath, "tables", table.name + ".csv");
    const fnm_json = join(dirpath, "tables", table.name + ".json");
    if (existsSync(fnm_json)) {
      const res = await table.import_json_file(
        fnm_json,
        table.name === "users" && !restore_first_user
      );
      if (res.error) err = (err || "") + res.error;
    } else if (existsSync(fnm_csv)) {
      const res = await table.import_csv_file(fnm_csv, {
        skip_first_data_row: table.name === "users" && !restore_first_user,
      });
      if (instanceOfErrorMsg(res)) err = (err || "") + res.error;
    }
  }
  for (const table of tables) {
    try {
      await table.enable_fkey_constraints();
    } catch (e: any) {
      err = (err || "") + e.message;
    }
  }
  return err;
};

/**
 * @function Restore config
 * @param {string} dirpath
 * @returns {Promise<void>}
 */
const restore_config = async (dirpath: string): Promise<void> => {
  const cfgs = readdirSync(join(dirpath, "config"));
  const state = getState();

  for (const cfg of cfgs) {
    const s = await readFile(join(dirpath, "config", cfg));
    await state.setConfig(cfg, JSON.parse(s.toString()).v);
  }
};

/**
 * Restore from backup
 * @param fnm
 * @param loadAndSaveNewPlugin
 * @param restore_first_user
 */
const restore = async (
  fnm: string,
  loadAndSaveNewPlugin: (plugin: Plugin) => void,
  restore_first_user?: boolean
): Promise<string | void> => {
  const tmpDir = await dir({ unsafeCleanup: true });
  //unzip
  await extract(fnm, tmpDir.path);
  let err;
  //install pack
  const pack = JSON.parse(
    (await readFile(join(tmpDir.path, "pack.json"))).toString()
  );

  const can_restore = await can_install_pack(pack);
  if (typeof can_restore !== "boolean" && can_restore.error) {
    return `Cannot restore backup, clashing entities: 
    ${can_restore.error || ""}
    Delete these entities or restore to a pristine instance.
    `;
  }
  //config
  await restore_config(tmpDir.path);
  await install_pack(pack, undefined, loadAndSaveNewPlugin, true);

  // files
  const { file_users, newLocations } = await restore_files(tmpDir.path);

  //table csvs
  const tabres = await restore_tables(tmpDir.path, restore_first_user);
  if (tabres) err = (err || "") + tabres;

  if (Object.keys(newLocations).length > 0)
    await correct_fileid_references_to_location(newLocations);
  await restore_file_users(file_users);

  await tmpDir.cleanup();
  return err;
};

/**
 * Delete old backups
 */
const delete_old_backups = async () => {
  const directory = getState().getConfig("auto_backup_directory");
  const expire_days = getState().getConfig("auto_backup_expire_days");
  const backup_file_prefix = getState().getConfig("backup_file_prefix");
  if (!expire_days || expire_days < 0) return;
  const files = await readdir(directory);
  for (const file of files) {
    if (!file.startsWith(backup_file_prefix)) continue;
    const stats = await stat(path.join(directory, file));
    const ageDays =
      (new Date().getTime() - stats.birthtime.getTime()) / (1000 * 3600 * 24);
    if (ageDays > expire_days) await unlink(path.join(directory, file));
  }
};
/**
 * Do autobackup now
 */
const auto_backup_now = async () => {
  const fileName = await create_backup();

  const destination = getState().getConfig(
    "auto_backup_destination",
    "Saltcorn files"
  );
  const directory = getState().getConfig("auto_backup_directory", "");
  if (directory === null) throw new Error("Directory is unspecified");

  switch (destination) {
    case "Saltcorn files":
      if (directory.length > 0) {
        await File.new_folder(directory);
      }

      const newPath = File.get_new_path(join(directory, fileName));
      const stats = statSync(fileName);
      await copyFile(fileName, newPath);
      await File.create({
        filename: fileName,
        location: newPath,
        uploaded_at: new Date(),
        size_kb: Math.round(stats.size / 1024),
        mime_super: "application",
        mime_sub: "zip",
        min_role_read: 1,
      });
      await unlink(fileName);
      break;
    case "Local directory":
      //const directory = getState().getConfig("auto_backup_directory");

      if (directory.length > 0) {
        await mkdir(directory, { recursive: true });
      }

      await copyFile(fileName, join(directory, fileName));
      await unlink(fileName);
      await delete_old_backups();
      break;

    default:
      throw new Error("Unknown destination: " + destination);
  }
};

export = {
  create_backup,
  restore,
  create_csv_from_rows,
  auto_backup_now,
  create_pack_json,
  extract,
};