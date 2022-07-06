import db from "@saltcorn/data/db/index";
import { join } from "path";
import { existsSync, mkdirSync, copySync, writeFileSync } from "fs-extra";
import { Row } from "@saltcorn/db-common/internal";
const reset = require("@saltcorn/data/db/reset_schema");

/**
 *
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
 *
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
 *
 * @param param0
 */
export function writeCfgFile({
  buildDir,
  entryPoint,
  serverPath,
  localUserTables,
}: any) {
  const wwwDir = join(buildDir, "www");
  let cfg = {
    version_tag: db.connectObj.version_tag,
    entry_view: `get/view/${entryPoint}`,
    server_path: serverPath,
    localUserTables,
  };
  writeFileSync(join(wwwDir, "config"), JSON.stringify(cfg));
}

/**
 *
 * @param buildDir directory where the app will be build
 */
export async function buildTablesFile(buildDir: string) {
  const wwwDir = join(buildDir, "www");
  const scTables = (await db.listScTables()).filter(
    (table: Row) => ["_sc_migrations", "_sc_errors"].indexOf(table.name) === -1
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
 *
 * @param buildDir directory where the app will be build
 */
export async function createSqliteDb(buildDir: string) {
  const dbPath = join(buildDir, "www", "scdb.sqlite");
  let connectObj = db.connectObj;
  connectObj.sqlite_path = dbPath;
  await db.changeConnection(connectObj);
  await reset();
}
