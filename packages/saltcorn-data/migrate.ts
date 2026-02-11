/**
 * DB structure migration functionality
 * @category saltcorn-data
 * @module migrate
 */

/*global window*/

import fs from "fs";
import path from "path";
import db from "./db";
const dateFormat = require("dateformat");

const is_sqlite = db.isSQLite;

interface MigrationContents {
  sql?: string | string[];
  sql_pg?: string | string[];
  sql_sqlite?: string | string[];
  js?: () => Promise<void> | void;
}

const fudge = is_sqlite
  ? (s: string | string[]): string | string[] =>
      Array.isArray(s)
        ? s.map(fudge as (s: string) => string)
        : s
            .replace("id serial primary", "id integer primary")
            .replace("jsonb", "json")
  : (s: string | string[]) => s;

const doMigrationStep = async (
  name: string,
  contents: MigrationContents
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
    if (!(is_sqlite && contents.sql.includes("DROP COLUMN"))) {
      await execMany(fudge(contents.sql));
    }
  }
  if (contents.sql_pg && !is_sqlite) {
    await execMany(contents.sql_pg);
  }
  if (contents.sql_sqlite && is_sqlite) {
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
            console.log("Tenant %s running migration %s", schema0, name);
          const contents: MigrationContents = require(
            path.join(__dirname, "migrations", name)
          );
          await db.withTransaction(async () => {
            if (!is_sqlite) await db.query(`SET search_path TO "${schema}";`);
            await doMigrationStep(name, contents);
          });
        }
      }
    }
  } else {
    for (let [k, v] of Object.entries(
      (window as any).saltcorn.data.migrations
    )) {
      await doMigrationStep(k, v as MigrationContents);
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
