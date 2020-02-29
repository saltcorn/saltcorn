const db = require(".");

//https://stackoverflow.com/a/21247009
const reset = async () => {
  await db.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
    COMMENT ON SCHEMA public IS 'standard public schema';
  `);

  await db.query(`
    CREATE TABLE tables
    (
      id serial primary key,
      name text NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE fields
    (
      id serial primary key,
      table_id integer references tables(id),
      fname text NOT NULL,
      flabel text,
      ftype text,
      attributes jsonb
    )
  `);

  await db.query(`
    CREATE TABLE views
    (
      id serial primary key,
      viewtemplate text NOT NULL,
      name text NOT NULL,
      table_id integer references tables(id),
      configuration jsonb NOT NULL
    )
  `);
};

reset().then(
  () => {
    console.log("Database reset successful");
    process.exit(0);
  },
  err => {
    console.error(err);
    process.exit(1);
  }
);
