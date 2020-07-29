const fs = require("fs");
const path = require("path");
const db = require("./db");

const dateFormat = require("dateformat");
const { ifError } = require("assert");

const migrate = async (schema = "public") => {
  //console.log("migrating",schema )
  const is_sqlite = db.isSQLite;

  const dbmigrationRows = await db.select("_sc_migrations");
  const dbmigrations = dbmigrationRows.map(r => r.migration);
  //https://stackoverflow.com/questions/5364928/node-js-require-all-files-in-a-folder
  const files = fs
    .readdirSync(path.join(__dirname, "migrations"))
    .filter(file => file.match(/\.js$/) !== null);

  const client = is_sqlite ? db : await db.getClient();
  if (!is_sqlite) {
    db.sql_log(`SET search_path TO "${schema}";`);
    await client.query(`SET search_path TO "${schema}";`);
  }

  const fudge=is_sqlite ? s=> s.replace('id serial primary', 'id integer primary'):s=>s 

  for (const file of files) {
    const name = file.replace(".js", "");
    if (!dbmigrations.includes(name)) {
      //console.log("Running migration", name);
      const contents = require(path.join(__dirname, "migrations", name));
      if (contents.sql) {
        if (!(is_sqlite && contents.sql.includes("DROP COLUMN")))
          await client.query(fudge(contents.sql));
      }
      await db.insert("_sc_migrations", { migration: name }, true);
    }
  }
  if (!is_sqlite) client.release(true);
};

const create_blank_migration = async () => {
  var time = dateFormat(new Date(), "yyyymmddHHMM");
  const fnm = path.join(__dirname, "migrations", `${time}.js`);
  fs.writeFileSync(
    fnm,
    `
const sql = "";

module.exports = { sql };
    `
  );
  console.log(fnm);
};

module.exports = { migrate, create_blank_migration };
