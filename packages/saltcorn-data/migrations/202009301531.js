const sql = [
  `alter table _sc_fields add column calculated boolean not null default false;`,
  `alter table _sc_fields add column expression text;`,
];

module.exports = { sql };
