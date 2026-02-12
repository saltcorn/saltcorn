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
import migrate, { getMigrationsInDB } from "@saltcorn/data/migrate";
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
import { stringify } from "csv-stringify/sync";
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
  trigger_pack,
} = pack;
import config from "@saltcorn/data/models/config";
const { configTypes } = config;
const { asyncMap, isTest } = require("@saltcorn/data/utils");
import Trigger from "@saltcorn/data/models/trigger";
import Library from "@saltcorn/data/models/library";
import Tag from "@saltcorn/data/models/tag";
import Model from "@saltcorn/data/models/model";
import ModelInstance from "@saltcorn/data/models/model_instance";
import EventLog from "@saltcorn/data/models/eventlog";
import path from "path";
const { exec, execSync, spawn } = require("child_process");

import SftpClient from "ssh2-sftp-client";
import { CodePagePack } from "@saltcorn/types/base_types";
const os = require("os");
const semver = require("semver");
import {
  S3,
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import MetaData from "@saltcorn/data/models/metadata";

/**
 * @param [withEventLog] - include event log
 */
const create_pack_json = async (
  withEventLog: boolean = false,
  forSnapshot: boolean = false
): Promise<object> => {
  const state = getState();

  // tables
  const tables = await asyncMap(
    await Table.find({}, { orderBy: "id" }),
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
  const triggers = await asyncMap(Trigger.find({}), trigger_pack);

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
  const model_instances = forSnapshot
    ? []
    : await asyncMap(
        await ModelInstance.find({}),
        async (modelinst: ModelInstance) => {
          const model = await Model.findOne({ id: modelinst.model_id });
          if (!model)
            throw new Error(`Model of instance '${modelinst.name}' not found`);
          const table = await Table.findOne({ id: model.table_id });
          if (!table)
            throw new Error(`Table of model '${model.name}' not found`);
          return await model_instance_pack(
            modelinst.name,
            model.name,
            table.name
          );
        }
      );
  // optional event log
  const event_logs = withEventLog
    ? await asyncMap(
        await EventLog.find({}),
        async (e: EventLog) => await event_log_pack(e)
      )
    : [];
  const function_code_pages = state.getConfigCopy("function_code_pages", {});
  const function_code_pages_tags = state.getConfigCopy(
    "function_code_pages_tags",
    {}
  );
  const code_pages: Array<CodePagePack> = [];
  Object.keys(function_code_pages).forEach((name) => {
    code_pages.push({
      name,
      code: function_code_pages[name],
      tags: function_code_pages_tags[name] || [],
    });
  });

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
    code_pages,
  };

  if (forSnapshot) {
    const cfgs = await db.select("_sc_config");
    const config: any = {};

    for (const cfg of cfgs) {
      //exclude base url, multitenancy, ssl/lets encrypt,
      if (configTypes[cfg.key]?.excludeFromSnapshot) continue;
      if (state.isFixedConfig(cfg.key)) continue;

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

const sanitiseTableName = (nm: string): string => nm.replaceAll("/", "");

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
  await table.dump_to_json(
    join(dirpath, sanitiseTableName(table.name) + ".json")
  );
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
        await t.dump_history_to_json(
          join(dirpath, sanitiseTableName(t.name) + "__history.json")
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

const backup_metadata = async (root_dirpath: string): Promise<void> => {
  const metadata = await MetaData.find({});
  await writeFile(
    join(root_dirpath, "metadata.json"),
    JSON.stringify(metadata)
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

  const state = getState();
  for (const cfg of cfgs) {
    if (!state.isFixedConfig(cfg.key))
      await writeFile(
        join(dirpath, cfg.key),
        JSON.stringify(db.isSQLite ? JSON.parse(cfg.value) : cfg.value)
      );
  }
};

const backup_info_file = async (root_dirpath: string): Promise<void> => {
  const state = getState();
  const migrations_run = await getMigrationsInDB();
  const dbversion = await db.getVersion(true);
  const saltcorn_version = db.connectObj.sc_version;

  await writeFile(
    join(root_dirpath, "backup-info.json"),
    JSON.stringify(
      {
        saltcorn_version,
        migrations_run,
        backup_date: new Date().toISOString(),
        node_version: process.version,
        database_type: db.isSQLite ? "SQLite" : "PostgreSQL",
        database_version: dbversion,
        os: {
          platform: os.platform(),
          arch: os.arch(),
          machine: os.machine(),
          version: os.version(),
          type: os.type(),
          release: os.release(),
        },
      },
      null,
      2
    )
  );
};

const zipFolder = async (folder: string, zipFileName: string) => {
  const backup_with_system_zip = executableIsAvailable("zip");
  const backup_password = getState().getConfig("backup_password", "");
  if (backup_with_system_zip) {
    return await new Promise((resolve, reject) => {
      const absZipPath = path.join(process.cwd(), zipFileName);
      const args = [
        "-5",
        "-rq",
        ...(backup_password ? [`-P`, backup_password] : []),
        absZipPath,
        ".",
      ];

      const subprocess = spawn("zip", args, { cwd: folder });
      subprocess.stdout.on("data", (data: any) => {
        getState().log(6, data.toString());
      });

      subprocess.stderr.on("data", (data: any) => {
        getState().log(1, data.toString());
      });

      subprocess.on("close", (exitCode: any) => {
        if (exitCode !== 0) reject(new Error("zip failed"));
        else resolve(undefined);
      });
    });
  } else {
    const zip = new Zip();
    zip.addLocalFolder(folder);
    zip.writeZip(zipFileName);
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
  await backup_info_file(tmpDir.path);
  await backup_metadata(tmpDir.path);

  const day = dateFormat(new Date(), "yyyy-mm-dd-HH-MM");

  const ten = db.getTenantSchema();
  const tens =
    ten === db.connectObj.default_schema
      ? getState().getConfig("site_name", "Saltcorn")
      : ten;
  const backup_file_prefix = getState().getConfig("backup_file_prefix");
  const zipFileName = fnm || `${backup_file_prefix}${tens}-${day}.zip`;

  await zipFolder(tmpDir.path, zipFileName);
  await tmpDir.cleanup();
  return zipFileName;
};

// https://stackoverflow.com/a/74743490/19839414
function executableIsAvailable(name: string) {
  const shell = (cmd: string) => execSync(cmd, { encoding: "utf8" });
  try {
    shell(`which ${name}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * @function
 * @param {string} fnm
 * @param {string} dir
 * @returns {Promise<void>}
 */
const extract = async (
  fnm: string,
  dir: string,
  password?: string
): Promise<void> => {
  const state = getState();
  const backup_with_system_zip = executableIsAvailable("unzip");

  if (backup_with_system_zip) {
    return await new Promise((resolve, reject) => {
      const args = [
        ...(password ? [`-P${password}`] : []),
        File.normalise(fnm),
        "-d",
        dir,
      ];

      const subprocess = spawn("unzip", args);

      subprocess.stdout.on("data", (data: any) => {
        state.log(6, data.toString());
      });

      subprocess.stderr.on("data", (data: any) => {
        const output = data.toString();
        state.log(1, output);
        if (output.includes("password") || output.includes("encrypted")) {
          reject({ requiresPassword: true });
        }
      });

      subprocess.on("close", (exitCode: any) => {
        if (exitCode !== 0) reject(new Error("unzip failed"));
        else resolve();
      });
    });
  } else {
    const zip = new Zip(fnm);
    try {
      if (password) {
        zip.extractAllTo(dir, true, false, password);
      } else {
        zip.extractAllTo(dir, true, false);
      }
    } catch (error: any) {
      if (
        error.message.includes("password") ||
        error.message.includes("encrypted")
      ) {
        error.requiresPassword = true;
      }
      throw error;
    }
  }
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
  const state = getState();

  if (existsSync(fnm)) {
    const file_rows = await csvtojson().fromFile(fnm);
    for (const file of file_rows) {
      if (file.isDirectory)
        await mkdir(File.get_new_path(file.location), { recursive: true });
    }
    if (!isTest()) state.log(2, `Restoring ${file_rows.length} files...`);
    for (const file of file_rows) {
      try {
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
        //const id = await db.insert("_sc_files", file_row);}
      } catch (e: any) {
        state.log(
          1,
          `Error restoring file ${JSON.stringify(file)}: ${e.message}`
        );
      }
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
  getState().log(2, `Correcting file id references to locations`);

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
  if (!isTest()) getState().log(2, `Restoring file users`);
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

  const restore_history = getState().getConfig("restore_history", true);
  for (const table of tables) {
    if (!isTest()) getState().log(2, `restoring table ${table.name}`);

    const fnm_csv =
      table.name === "users"
        ? join(dirpath, "users.csv")
        : join(dirpath, "tables", sanitiseTableName(table.name) + ".csv");
    const fnm_json = join(
      dirpath,
      "tables",
      sanitiseTableName(table.name) + ".json"
    );
    if (existsSync(fnm_json)) {
      const res = await table.import_json_file(
        fnm_json,
        table.name === "users" && !restore_first_user
      );
      if (instanceOfErrorMsg(res)) {
        console.error(err);
        err = (err || "") + res.error;
      }
    } else if (existsSync(fnm_csv)) {
      const res = await table.import_csv_file(fnm_csv, {
        skip_first_data_row: table.name === "users" && !restore_first_user,
      });
      if (instanceOfErrorMsg(res)) {
        console.error(res);
        err = (err || "") + res.error;
      }
    }
    if (table.versioned && restore_history) {
      const fnm_hist_json = join(
        dirpath,
        "tables",
        sanitiseTableName(table.name) + "__history.json"
      );
      if (existsSync(fnm_hist_json)) {
        if (!isTest())
          getState().log(2, `restoring table history ${table.name}`);

        await table.import_json_history_file(fnm_hist_json);
      }
    }
  }
  for (const table of tables) {
    try {
      await table.enable_fkey_constraints();
    } catch (e: any) {
      console.error("table restore error", e);
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

const restore_metadata = async (dirpath: string): Promise<void> => {
  const fnm: string = join(dirpath, "metadata.json");
  if (!existsSync(fnm)) return;
  if (!isTest()) getState().log(2, `Restoring metadata`);
  const mds = JSON.parse((await readFile(fnm)).toString()) as Array<MetaData>;

  for (const md of mds) {
    await MetaData.create(md);
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
  restore_first_user?: boolean,
  password?: string
): Promise<string | void> => {
  const state = getState();
  state.log(2, `Starting restore to tenant ${db.getTenantSchema()}`);

  const tmpDir = await dir({ unsafeCleanup: true });

  await extract(fnm, tmpDir.path, password);

  state.log(2, `Unzip done`);

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

  if (existsSync(join(basePath, "backup-info.json"))) {
    const info = JSON.parse(
      (await readFile(join(basePath, "backup-info.json"))).toString()
    );
    const saltcorn_version = db.connectObj.sc_version;

    if (
      info.saltcorn_version &&
      semver.gt(info.saltcorn_version, saltcorn_version)
    ) {
      err = `Warning: backup is from a more recent version (${
        info.saltcorn_version
      }) than the installed version (${saltcorn_version}). `;
    }
  }

  //install pack
  if (!isTest()) state.log(2, `Reading pack`);
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
  if (!isTest()) state.log(2, `Restoring config`);
  await restore_config(basePath);

  if (!isTest()) state.log(2, `Restoring pack`);
  await install_pack(pack, undefined, loadAndSaveNewPlugin, true);

  // files
  if (!isTest()) state.log(2, `Restoring files`);
  const { file_users, newLocations } = await restore_files(basePath);

  //table csvs
  if (!isTest()) state.log(2, `Restoring tables`);
  const tabres = await restore_tables(basePath, restore_first_user);
  if (tabres) err = (err || "") + tabres;

  if (!isTest()) state.log(2, `Restoring metadata`);
  await restore_metadata(basePath);

  if (Object.keys(newLocations).length > 0)
    await correct_fileid_references_to_location(newLocations);
  await restore_file_users(file_users);

  await tmpDir.cleanup();
  state.log(
    2,
    `Completed restore to tenant ${db.getTenantSchema()}${
      err ? ` with errors ${err}` : " successfully"
    }`
  );

  return err;
};

/**
 * Delete old backups
 */
const delete_old_backups = async () => {
  const directory = getState().getConfig("auto_backup_directory");
  const expire_days = getState().getConfig("auto_backup_expire_days");
  const backup_file_prefix = getState().getConfig("backup_file_prefix");
  const destination = getState().getConfig("auto_backup_destination");

  if (!expire_days || expire_days < 0) return;

  if (destination === "Local directory") {
    const files = await readdir(directory);
    for (const file of files) {
      if (!file.startsWith(backup_file_prefix)) continue;
      const stats = await stat(path.join(directory, file));
      const fileTime = (stats as any).birthtime?.getTime
        ? (stats as any).birthtime.getTime()
        : stats.mtime.getTime();
      const ageMs = new Date().getTime() - fileTime;
      const ageDays = ageMs / (1000 * 3600 * 24);
      if (ageDays > expire_days) await unlink(path.join(directory, file));
    }
  } else if (destination === "S3") {
    const s3EndpointCfg = getState().getConfig("backup_s3_endpoint");
    const s3Secure = getState().getConfig("backup_s3_secure", true);
    const endpoint = s3EndpointCfg
      ? /:\/\//.test(s3EndpointCfg)
        ? s3EndpointCfg
        : `${s3Secure ? "https" : "http"}://${s3EndpointCfg}`
      : undefined;
    const s3 = new S3Client({
      credentials: {
        accessKeyId: getState().getConfig("backup_s3_access_key"),
        secretAccessKey: getState().getConfig("backup_s3_access_secret"),
      },
      region: getState().getConfig("backup_s3_region"),
      ...(endpoint ? { endpoint } : {}),
    });

    const bucket = getState().getConfig("backup_s3_bucket");
    const keyPrefix = (getState().getConfig("backup_s3_path_prefix", "") || "")
      .toString()
      .replace(/^\/+|\/+$/g, "");
    const listPrefix = [keyPrefix, backup_file_prefix]
      .filter((s) => s && s.length)
      .join("/");

    const listParams: any = {
      Bucket: bucket,
      Prefix: listPrefix,
    };

    try {
      let continuationToken: string | undefined = undefined;
      do {
        const listedObjects: ListObjectsV2CommandOutput = await s3.send(
          new ListObjectsV2Command({
            ...listParams,
            ContinuationToken: continuationToken,
          })
        );
        if (listedObjects.Contents) {
          for (const obj of listedObjects.Contents) {
            if (!obj.Key || !obj.LastModified) continue;
            const ageMs =
              new Date().getTime() - new Date(obj.LastModified).getTime();
            const ageDays = ageMs / (1000 * 3600 * 24);
            if (ageDays > expire_days) {
              await s3.send(
                new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key })
              );
            }
          }
        }
        continuationToken = listedObjects.IsTruncated
          ? listedObjects.NextContinuationToken
          : undefined;
      } while (continuationToken);
    } catch (err: any) {
      console.error(`Error deleting old backups from S3: ${err.message}`);
    }
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
    case "S3":
      const bEndpointCfg = state.getConfig("backup_s3_endpoint");
      const bSecure = state.getConfig("backup_s3_secure", true);
      const bEndpoint = bEndpointCfg
        ? /:\/\//.test(bEndpointCfg)
          ? bEndpointCfg
          : `${bSecure ? "https" : "http"}://${bEndpointCfg}`
        : undefined;
      const s3 = new S3({
        credentials: {
          accessKeyId: state.getConfig("backup_s3_access_key"),
          secretAccessKey: state.getConfig("backup_s3_access_secret"),
        },
        region: state.getConfig("backup_s3_region"),
        ...(bEndpoint ? { endpoint: bEndpoint } : {}),
      });

      const bucket = state.getConfig("backup_s3_bucket");
      const pathPrefix = (state.getConfig("backup_s3_path_prefix", "") || "")
        .toString()
        .replace(/^\/+|\/+$/g, "");
      const s3Key = [pathPrefix, basename(fileName)]
        .filter((s) => s && s.length)
        .join("/");
      const fileStream = () => createReadStream(fileName);
      try {
        const uploadResult = await new Upload({
          client: s3,
          params: {
            Bucket: bucket,
            Key: s3Key,
            Body: fileStream(),
            ACL: "private",
            ContentType: "application/zip",
          },
        }).done();

        if (uploadResult.$metadata.httpStatusCode !== 200) {
          throw new Error(
            `S3 Upload failed with status code ${uploadResult.$metadata.httpStatusCode}`
          );
        }
      } catch (err: any) {
        state.log(1, `S3 Upload error: ${err.message}`);
        throw new Error(err?.message);
      }
      await delete_old_backups();
      break;
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
        await MetaData.create({
          type: "Backup",
          name: "Success",
          body: {},
        });
        state.log(6, `Auto backup for tenant completed successfully`);
      } catch (e: any) {
        console.error(e);
        await Crash.create(e, {
          url: `Scheduler auto backup for tenant`,
          headers: {},
        });
        throw new Error(e);
      }
    });
  else
    try {
      await auto_backup_now_tenant(state);
      await MetaData.create({
        type: "Backup",
        name: "Success",
        body: {},
      });
      state.log(3, `Auto backup completed successfully`);
    } catch (e: any) {
      console.error(e);
      await Crash.create(e, {
        url: `Scheduler auto backup`,
        headers: {},
      });
      throw new Error(e);
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
