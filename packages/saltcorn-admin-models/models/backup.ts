const { getState } = require("@saltcorn/data/db/state");
import db from "@saltcorn/data/db/index";
import Table from "@saltcorn/data/models/table";
import { instanceOfErrorMsg } from "@saltcorn/types/common_types";
import View from "@saltcorn/data/models/view";
import File from "@saltcorn/data/models/file";
import Crash from "@saltcorn/data/models/crash";
import Field from "@saltcorn/data/models/field";
import Role from "@saltcorn/data/models/role";
import Page from "@saltcorn/data/models/page";
import PageGroup from "@saltcorn/data/models/page_group";
import Plugin from "@saltcorn/data/models/plugin";
import migrate from "@saltcorn/data/migrate";
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
import { existsSync, readdirSync, statSync, createReadStream } from "fs";
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
  page_group_pack,
  tag_pack,
  model_instance_pack,
  event_log_pack,
  install_pack,
  can_install_pack,
} = pack;
import config from "@saltcorn/data/models/config";
const { configTypes } = config;
const { asyncMap } = require("@saltcorn/data/utils");
import Trigger from "@saltcorn/data/models/trigger";
import Library from "@saltcorn/data/models/library";
import Tag from "@saltcorn/data/models/tag";
import Model from "@saltcorn/data/models/model";
import ModelInstance from "@saltcorn/data/models/model_instance";
import EventLog from "@saltcorn/data/models/eventlog";
import path from "path";

import SftpClient from "ssh2-sftp-client";

/**
 * @param [withEventLog] - include event log
 */
const create_pack_json = async (
  withEventLog: boolean = false,
  forSnapshot: boolean = false
): Promise<object> => {
  // tables
  const tables = await asyncMap(
    await Table.find({}),
    async (t: Table) => await table_pack(t) // find already done before
  );
  // views
  const views = await asyncMap(
    (await View.find({})).filter((v) => v.id),
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
  // page groups
  const page_groups = await asyncMap(
    await PageGroup.find({}),
    async (v: Page) => await page_group_pack(v.name)
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

  const pack: any = {
    tables,
    views,
    plugins,
    pages,
    page_groups,
    triggers,
    roles,
    library,
    tags,
    models,
    model_instances,
    event_logs,
  };

  if (forSnapshot) {
    const cfgs = await db.select("_sc_config");
    const config: any = {};
    for (const cfg of cfgs) {
      //exclude base url, multitenancy, ssl/lets encrypt,
      if (configTypes[cfg.key]?.excludeFromSnapshot) continue;
      config[cfg.key] = (db.isSQLite ? JSON.parse(cfg.value) : cfg.value)?.v;
    }
    pack.config = config;
  }
  return pack;
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
  const backup_history = getState().getConfig("backup_history", true);

  for (const t of tables) {
    if (!t.external && !t.provider_name) {
      await create_table_json(t, dirpath);
      if (t.versioned && backup_history) {
        const rows = await t.get_history();
        await writeFile(
          join(dirpath, t.name + "__history.json"),
          JSON.stringify(rows)
        );
      }
    }
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

const backup_migrations = async (root_dirpath: string): Promise<void> => {
  const migrations = await migrate.getMigrationsInDB();
  await writeFile(
    join(root_dirpath, "migrations.json"),
    JSON.stringify(migrations)
  );
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
  await backup_migrations(tmpDir.path);

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
    if (table.versioned) {
      const fnm_hist_json = join(
        dirpath,
        "tables",
        table.name + "__history.json"
      );
      if (existsSync(fnm_hist_json)) {
        const fileContents = (await readFile(fnm_hist_json)).toString();
        const rows = JSON.parse(fileContents);
        for (const row of rows) {
          await table.insert_history_row(row);
        }
      }
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

  let basePath = tmpDir.path;
  // safari re-compressed. Safari unpacks zip files on download. If the user
  // chooses compress in finder, the backup dir is nested inside the zip file
  if (!existsSync(join(basePath, "pack.json"))) {
    const files = await readdir(basePath);
    let found = false;
    for (const file of files) {
      if (existsSync(join(basePath, file, "pack.json"))) {
        basePath = join(basePath, file);
        found = true;
        break;
      }
    }
    if (!found) return "Not a valid backup file";
  }
  let err;
  //install pack
  const pack = JSON.parse(
    (await readFile(join(basePath, "pack.json"))).toString()
  );

  const can_restore = await can_install_pack(pack);
  if (typeof can_restore !== "boolean" && can_restore.error) {
    return `Cannot restore backup, clashing entities: 
    ${can_restore.error || ""}
    Delete these entities or restore to a pristine instance.
    `;
  }
  //config
  await restore_config(basePath);
  await install_pack(pack, undefined, loadAndSaveNewPlugin, true);

  // files
  const { file_users, newLocations } = await restore_files(basePath);

  //table csvs
  const tabres = await restore_tables(basePath, restore_first_user);
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
const auto_backup_now_tenant = async (state: any) => {
  state.log(6, `Creating backup file`);
  const fileName = await create_backup();
  state.log(6, `Created backup file with name ${fileName}`);

  const destination = state.getConfig(
    "auto_backup_destination",
    "Saltcorn files"
  );
  const directory = state.getConfig("auto_backup_directory", "");
  if (directory === null) throw new Error("Directory is unspecified");
  state.log(6, `Backup to destination`);

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
      //const directory = state.getConfig("auto_backup_directory");

      if (directory.length > 0) {
        await mkdir(directory, { recursive: true });
      }

      await copyFile(fileName, join(directory, fileName));
      await unlink(fileName);
      await delete_old_backups();
      break;
    case "SFTP server":
      let sftp = new SftpClient();
      await sftp.connect({
        host: state.getConfig("auto_backup_server"),
        port: state.getConfig("auto_backup_port"),
        username: state.getConfig("auto_backup_username"),
        password: state.getConfig("auto_backup_password"),
      });
      let data = createReadStream(fileName);
      let remote = join(
        state.getConfig("auto_backup_directory", ""),
        basename(fileName)
      );
      const putres = await sftp.put(data, remote);
      state.log(6, `SFTP Put response: ${putres}`);

      await sftp.end();
      const retain_dir = state.getConfig("auto_backup_retain_local_directory");
      if (retain_dir) {
        await mkdir(retain_dir, { recursive: true });
        await copyFile(fileName, join(retain_dir, fileName));
      }
      await unlink(fileName);
      break;
    //await  SftpClient()
    default:
      throw new Error("Unknown destination: " + destination);
  }
};
const auto_backup_now = async () => {
  const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
  const state = getState();
  const tenantModule = require("./tenant");
  if (isRoot && state.getConfig("auto_backup_tenants"))
    await tenantModule.eachTenant(async () => {
      try {
        await auto_backup_now_tenant(state);
      } catch (e) {
        console.error(e);
        await Crash.create(e, {
          url: `Scheduler auto backup for tenant`,
          headers: {},
        });
      }
    });
  else await auto_backup_now_tenant(state);
};
export = {
  create_backup,
  restore,
  create_csv_from_rows,
  auto_backup_now,
  create_pack_json,
  extract,
};
