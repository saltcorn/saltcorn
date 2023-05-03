const sql_pg = `
create table _sc_models (
  id serial primary key,
  name text not null unique,
  table_id integer references _sc_tables(id),
  modeltemplate text not null,
  configuration jsonb
);
create table _sc_model_instances (
  id serial primary key,
  name text not null unique,
  model_id integer references _sc_models(id),
  state jsonb,
  hyperparameters jsonb,
  trained_on timestamp not null,
  report text,
  metric_values jsonb,
  parameters jsonb,
  fit_object bytea, 
  is_default boolean
);
`;

const sql_sqlite = `
create table _sc_models (
  id integer primary key,
  name text not null unique,
  table_id integer references _sc_tables(id),
  modeltemplate text not null,
  configuration json
);
create table _sc_model_instances (
  id integer primary key,
  name text not null unique,
  model_id integer references _sc_models(id),
  state json,
  hyperparameters json,
  trained_on timestamp not null,
  report text,
  metric_values json,
  parameters json,
  fit_object blob, 
  is_default boolean
);
`;

module.exports = { sql_pg, sql_sqlite };
