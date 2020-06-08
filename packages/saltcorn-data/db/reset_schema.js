const db = require(".");
const { migrate } = require("../migrate");

//https://stackoverflow.com/a/21247009
const reset = async (dontDrop = false, schema = "public") => {
  if (!dontDrop) {
    await db.query(`
    DROP SCHEMA "${schema}" CASCADE;
    CREATE SCHEMA "${schema}";
    GRANT ALL ON SCHEMA "${schema}" TO postgres;
    GRANT ALL ON SCHEMA "${schema}" TO "${schema}" ;
    COMMENT ON SCHEMA "${schema}" IS 'standard public schema';
  `);
  }

  await db.query(`
    CREATE TABLE "${schema}"._sc_roles (
      id serial primary key,      
      role VARCHAR(50)
    )
  `);

  await db.query(`
    CREATE TABLE "${schema}"._sc_config (
      key text primary key,      
      value JSONB not null
    )
  `);

  await db.query(`
    CREATE TABLE "${schema}"._sc_migrations (
      migration text primary key
    )
  `);

  await db.insert(`_sc_roles`, { role: "admin", id: 1 });
  await db.insert(`_sc_roles`, { role: "staff", id: 4 });
  await db.insert(`_sc_roles`, { role: "user", id: 8 });
  await db.insert(`_sc_roles`, { role: "public", id: 10 });

  await db.query(`
    CREATE TABLE "${schema}"._sc_tables
    (
      id serial primary key,
      name text NOT NULL unique,
      expose_api_read boolean NOT NULL DEFAULT false,
      expose_api_write boolean NOT NULL DEFAULT false,
      min_role_read integer NOT NULL references "${schema}"._sc_roles(id) DEFAULT 1,
      min_role_write integer NOT NULL references "${schema}"._sc_roles(id) DEFAULT 1
    )
  `);

  await db.query(`
    CREATE INDEX _sc_idx_table_name on "${schema}"._sc_tables(name); 
  `);

  await db.query(`
    CREATE TABLE "${schema}"._sc_fields
    (
      id serial primary key,
      table_id integer references "${schema}"._sc_tables(id) NOT NULL,
      name text NOT NULL,
      label text,
      type text,
      reftable_name text,
      attributes jsonb,
      required boolean NOT NULL DEFAULT false
    )
  `);
  await db.query(`
    CREATE INDEX _sc_idx_field_table on "${schema}"._sc_fields(table_id); 
  `);

  await db.query(`
    CREATE TABLE "${schema}"._sc_views
    (
      id serial primary key,
      viewtemplate text NOT NULL,
      name text NOT NULL,
      table_id integer references "${schema}"._sc_tables(id),
      configuration jsonb NOT NULL,
      is_public boolean NOT NULL DEFAULT false,
      on_root_page boolean NOT NULL DEFAULT false,
      on_menu boolean NOT NULL DEFAULT false
    )
  `);
  await db.query(`
    CREATE INDEX _sc_idx_view_name on "${schema}"._sc_views(name); 
  `);

  await db.query(`
    CREATE TABLE "${schema}".users (
      id serial primary key,      
      email VARCHAR(128),
      password VARCHAR(60),
      role_id integer not null references "${schema}"._sc_roles(id)
    )
  `);

  await db.query(`
  CREATE TABLE "${schema}"._sc_plugins (
    id serial primary key,      
    name VARCHAR(128),
    source VARCHAR(128),
    location VARCHAR(128)
  )
  `);
  await db.insert("_sc_plugins", {
    name: "base",
    source: "npm",
    location: "@saltcorn/base-plugin"
  });
  await db.insert("_sc_plugins", {
    name: "sbadmin2",
    source: "npm",
    location: "@saltcorn/sbadmin2"
  });
  if (schema === "public")
    await db.query(`
    CREATE UNLOGGED TABLE "_sc_session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
    WITH (OIDS=FALSE);
    
    ALTER TABLE "_sc_session" ADD CONSTRAINT "_sc_session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
    
    CREATE INDEX "_sc_IDX_session_expire" ON "_sc_session" ("expire");
  `);

  await migrate(schema);
};

module.exports = reset;
