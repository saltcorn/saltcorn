const sql_pg = `
create table IF NOT EXISTS _sc_models (
  id serial primary key,
  name text not null,
  table_id integer references _sc_tables(id),
  modelpattern text not null,
  configuration jsonb,
  UNIQUE (table_id, name)
);
create table IF NOT EXISTS _sc_model_instances (
  id serial primary key,
  name text not null,
  model_id integer references _sc_models(id),
  state jsonb,
  hyperparameters jsonb,
  trained_on timestamp not null,
  report text,
  metric_values jsonb,
  parameters jsonb,
  fit_object bytea, 
  is_default boolean,
  unique (model_id, name)
);`;

const sql_sqlite = [
  `
create table _sc_models (
  id integer primary key,
  name text not null,
  table_id integer references _sc_tables(id),
  modelpattern text not null,
  configuration json,
  UNIQUE(table_id, name) ON CONFLICT FAIL
);`,
  `
create table _sc_model_instances (
  id integer primary key,
  name text not null,
  model_id integer references _sc_models(id),
  state json,
  hyperparameters json,
  trained_on timestamp not null,
  report text,
  metric_values json,
  parameters json,
  fit_object blob, 
  is_default boolean,
  UNIQUE(model_id, name) ON CONFLICT FAIL
);`,
];

const sql_mysql = [
  `
create table IF NOT EXISTS _sc_models (
  id INT AUTO_INCREMENT primary key,
  name varchar(255) not null,
  table_id integer references _sc_tables(id),
  modelpattern text not null,
  configuration JSON,
  UNIQUE (table_id, name)
);`,
  `
create table IF NOT EXISTS _sc_model_instances (
  id INT AUTO_INCREMENT primary key,
  name varchar(255) not null,
  model_id integer references _sc_models(id),
  state JSON,
  hyperparameters JSON,
  trained_on timestamp not null,
  report text,
  metric_values JSON,
  parameters JSON,
  fit_object LONGBLOB,
  is_default boolean,
  unique (model_id, name)
);`,
];

module.exports = { sql_pg, sql_sqlite, sql_mysql };
