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
      name text NOT NULL unique
    )
  `);
  
  await db.query(`
    CREATE INDEX idx_table_name on tables(name); 
  `);

  await db.query(`
    CREATE TABLE fields
    (
      id serial primary key,
      table_id integer references tables(id) NOT NULL,
      name text NOT NULL,
      label text,
      type text,
      reftable_name text references tables(name),
      attributes jsonb,
      required boolean NOT NULL DEFAULT false
    )
  `);
  await db.query(`
    CREATE INDEX idx_field_table on fields(table_id); 
  `);

  await db.query(`
    CREATE TABLE views
    (
      id serial primary key,
      viewtemplate text NOT NULL,
      name text NOT NULL,
      table_id integer references tables(id),
      configuration jsonb NOT NULL,
      is_public boolean NOT NULL DEFAULT false,
      on_root_page boolean NOT NULL DEFAULT false,
      on_menu boolean NOT NULL DEFAULT false
    )
  `);
  await db.query(`
    CREATE INDEX idx_view_name on fields(name); 
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
  CREATE TABLE plugins (
    id serial primary key,      
    name VARCHAR(128),
    source VARCHAR(128),
    location VARCHAR(128)
  )
  `);
  await db.insert("plugins", {
    name: "base",
    source: "npm",
    location: "saltcorn-base-plugin"
  });
  await db.insert("plugins", {
    name: "sbadmin2",
    source: "npm",
    location: "saltcorn-sbadmin2"
  });
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
