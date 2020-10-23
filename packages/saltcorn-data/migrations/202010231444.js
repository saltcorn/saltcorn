const sql =
  'alter table users add column "disabled" boolean not null default false;';

module.exports = { sql };
