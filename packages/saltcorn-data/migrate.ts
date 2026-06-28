/**
 * DB structure migration functionality
 * @category saltcorn-data
 * @module migrate
 */

/*global window*/

import { createRequire } from "module";
const require = createRequire(import.meta.url);
import dateFormatLib from "dateformat";
const dateFormat: any = dateFormatLib; // NodeNext default-import interop for dateformat
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// browser bundles (mobile app) have no `fileURLToPath`; migrations only run
// server-side, so degrade __dirname to "" when it is unavailable.
const __dirname =
  typeof fileURLToPath === "function"
    ? path.dirname(fileURLToPath(import.meta.url))
    : "";
import db from "./db/index.js";

interface MigrationContents {
  sql?: string | string[];
  sql_pg?:
    | string
    | string[]
    | (({ schema }: { schema: string }) => string | string[]);
  sql_sqlite?: string | string[];
  js?: () => Promise<void> | void;
}

// db.isSQLite is read lazily at call time: a top-level read would touch the
// cyclically-imported db module before it has finished initialising.
const fudge = (s: string | string[]): string | string[] => {
  if (!db.isSQLite) return s;
  return Array.isArray(s)
    ? s.map((x) => fudge(x) as string)
    : s
        .replace("id serial primary", "id integer primary")
        .replace("jsonb", "json");
};

const doMigrationStep = async (
  name: string,
  contents: MigrationContents,
  schema: string
): Promise<void> => {
  const execMany = async (sqls: string | string[]): Promise<any> => {
    if (Array.isArray(sqls)) {
      for (const sql of sqls) {
        await db.query(sql);
      }
    } else {
      return await db.query(sqls);
    }
  };

  if (contents.sql) {
    if (!(db.isSQLite && contents.sql.includes("DROP COLUMN"))) {
      await execMany(fudge(contents.sql));
    }
  }
  if (contents.sql_pg && !db.isSQLite) {
    if (typeof contents.sql_pg === "function")
      await execMany(contents.sql_pg({ schema }));
    else await execMany(contents.sql_pg);
  }
  if (contents.sql_sqlite && db.isSQLite) {
    await execMany(contents.sql_sqlite);
  }
  if (contents.js) {
    await contents.js();
  }
  // todo add columns with date & user when / who runs migration
  await db.insert("_sc_migrations", { migration: name }, { noid: true });
};

const getMigrationsInDB = async (): Promise<string[]> => {
  const dbmigrationRows = await db.select("_sc_migrations");
  return dbmigrationRows.map((r: any) => r.migration);
};

// todo create functionality to rollback migrations
// todo run db backup before run migration / rollback of migration
/**
 * Migrate
 * @param schema0 - schema name
 * @returns {Promise<void>}
 */
// todo resolve database specific
const migrate = async (schema0?: string, verbose?: boolean): Promise<void> => {
  const schema = schema0 || db.connectObj.default_schema;
  //console.log("migrating database schema %s", schema);

  //https://stackoverflow.com/questions/5364928/node-js-require-all-files-in-a-folder
  if (db.is_node) {
    const dbmigrations = new Set(await getMigrationsInDB());
    const files = fs
      .readdirSync(path.join(__dirname, "migrations"))
      .filter(
        (file) =>
          file.match(/\.js$/) !== null &&
          !dbmigrations.has(file.replace(".js", ""))
      );
    if (files.length > 0) {
      for (const file of files) {
        const name = file.replace(".js", "");
        if (!dbmigrations.has(name)) {
          if (verbose)
            process.stdout.write(
              "Tenant " + schema0 + " running migration " + name
            );
          const contents: MigrationContents = require(
            path.join(__dirname, "migrations", name)
          );
          await db.withTransaction(
            async () => {
              // include public so shared extensions installed there (e.g.
              // uuid-ossp, pg_trgm) remain resolvable from the tenant schema -
              // this SET persists on the pooled connection after the migration
              if (!db.isSQLite)
                await db.query(`SET search_path TO "${schema}", public;`);
              await doMigrationStep(name, contents, schema);
              if (verbose) console.log(".");
            },
            async (e: Error) => {
              console.error(
                `Tenant ${schema0} migration ${name} error:`,
                e.message
              );
            }
          );
        }
      }
    }
  } else {
    for (let [k, v] of Object.entries(
      (window as any).saltcorn.data.migrations
    )) {
      await doMigrationStep(k, v as MigrationContents, schema);
    }
  }
};
/**
 * Create blank migration
 * @returns {Promise<void>}
 */
// todo add rollbacksql statement
const create_blank_migration = async (): Promise<void> => {
  var time = dateFormat(new Date(), "yyyymmddHHMM");
  const fnm = path.join(__dirname, "..", "migrations", `${time}.js`);
  fs.writeFileSync(
    fnm,
    `
const sql = "";

module.exports = { sql };
    `
  );
  console.log(fnm);
};

export { migrate, create_blank_migration, getMigrationsInDB };
