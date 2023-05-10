import db from "@saltcorn/data/db/index";
import utils = require("@saltcorn/data/utils");
const { getSafeSaltcornCmd } = utils;
import { join } from "path";
import { existsSync, mkdirSync, copySync, writeFileSync } from "fs-extra";
import { Row } from "@saltcorn/db-common/internal";
import { spawnSync } from "child_process";
import Table from "@saltcorn/data/models/table";

/**
 * copy files from 'server/public' into the www folder (with a version_tag prefix)
 * @param buildDir directory where the app will be build
 */
export function copyStaticAssets(buildDir: string) {
  const wwwDir = join(buildDir, "www");
  const assetsDst = join(wwwDir, "static_assets", db.connectObj.version_tag);
  if (!existsSync(assetsDst)) {
    mkdirSync(assetsDst, { recursive: true });
  }
  const serverRoot = join(require.resolve("@saltcorn/server"), "..");
  const srcPrefix = join(serverRoot, "public");
  const srcFiles = [
    "jquery-3.6.0.min.js",
    "saltcorn-common.js",
    "saltcorn.js",
    "saltcorn.css",
    "codemirror.js",
    "codemirror.css",
    "socket.io.min.js",
  ];
  for (const srcFile of srcFiles) {
    copySync(join(srcPrefix, srcFile), join(assetsDst, srcFile));
  }
}

/**
 * copy files from 'startbootstrap-sb-admin-2-bs5' into the www directory
 * @param buildDir directory where the app will be build
 */
export function copySbadmin2Deps(buildDir: string) {
  const sbadmin2Dst = join(
    buildDir,
    "www",
    "plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.5"
  );
  if (!existsSync(sbadmin2Dst)) {
    mkdirSync(sbadmin2Dst, { recursive: true });
  }
  const devPath = join(
    __dirname,
    "../../../..",
    "node_modules/startbootstrap-sb-admin-2-bs5"
  );
  const prodPath = join(
    require.resolve("@saltcorn/cli"),
    "../..",
    "node_modules/startbootstrap-sb-admin-2-bs5"
  );
  const srcPrefix = existsSync(devPath) ? devPath : prodPath;
  const srcFiles = [
    "vendor/fontawesome-free",
    "vendor/bootstrap/js/bootstrap.bundle.min.js",
    "vendor/jquery-easing/jquery.easing.min.js",
    "css/sb-admin-2.css",
    "js/sb-admin-2.min.js",
  ];
  for (const srcFile of srcFiles) {
    copySync(join(srcPrefix, srcFile), join(sbadmin2Dst, srcFile));
  }
}

/**
 * create a cfg file, the app use this configs
 * @param param0
 */
export function writeCfgFile({
  buildDir,
  entryPoint,
  entryPointType,
  serverPath,
  localUserTables,
  tenantAppName,
  allowOfflineMode,
}: any) {
  const wwwDir = join(buildDir, "www");
  let cfg: any = {
    version_tag: db.connectObj.version_tag,
    entry_point: `get/${entryPointType}/${entryPoint}`,
    server_path: !serverPath.endsWith("/")
      ? serverPath
      : serverPath.substring(0, serverPath.length - 1),
    localUserTables,
    allowOfflineMode,
  };
  if (tenantAppName) cfg.tenantAppName = tenantAppName;
  writeFileSync(join(wwwDir, "config"), JSON.stringify(cfg));
}

/**
 * create a file with all data from the db
 * the app updates its local db from this
 * @param buildDir directory where the app will be build
 */
export async function buildTablesFile(buildDir: string) {
  const wwwDir = join(buildDir, "www");
  const scTables = (await db.listScTables()).filter(
    (table: Row) =>
      ["_sc_migrations", "_sc_errors", "_sc_session"].indexOf(table.name) === -1
  );
  const tablesWithData = await Promise.all(
    scTables.map(async (row: Row) => {
      const dbData = await db.select(row.name);
      return { table: row.name, rows: dbData };
    })
  );
  writeFileSync(
    join(wwwDir, "tables.json"),
    JSON.stringify({
      created_at: new Date(),
      sc_tables: tablesWithData,
    })
  );
}

/**
 * copy files form 'server/locales' into the app
 * @param buildDir directory where the app will be build
 */
export function copyTranslationFiles(buildDir: string) {
  const localesDir = join(require.resolve("@saltcorn/server"), "..", "locales");
  copySync(localesDir, join(buildDir, "www", "locales"));
}

/**
 * init an empty db
 * after the first startup, this db will be updated from the tables.json
 * @param buildDir directory where the app will be build
 */
export async function createSqliteDb(buildDir: string) {
  const result = spawnSync(getSafeSaltcornCmd(), ["add-schema", "-f"], {
    env: {
      ...process.env,
      FORCE_SQLITE: "true",
      SQLITE_FILEPATH: join(buildDir, "www", "scdb.sqlite"),
    },
  });
  if (result.error) {
    console.log(result.error);
    return -1;
  } else {
    console.log(
      result.output
        ? result.output.toString()
        : "'reset-schema' finished without output"
    );
    return result.status;
  }
}
