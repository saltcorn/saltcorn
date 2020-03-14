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
      attributes jsonb,
      required boolean NOT NULL DEFAULT false
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

  await db.query(`
    CREATE TABLE roles (
      id serial primary key,      
      role VARCHAR(50)
    )
  `);
  await db.insert("roles", { role: "admin", id: 1 });
  await db.insert("roles", { role: "staff", id: 2 });
  await db.insert("roles", { role: "user", id: 3 });

  await db.query(`
    CREATE TABLE users (
      id serial primary key,      
      email VARCHAR(128),
      password VARCHAR(60),
      role_id integer not null references roles(id)
    )
  `);

  await db.query(`
    CREATE TABLE "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
    WITH (OIDS=FALSE);
    
    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
    
    CREATE INDEX "IDX_session_expire" ON "session" ("expire");
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
