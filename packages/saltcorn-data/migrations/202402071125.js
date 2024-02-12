const sql =
  "alter table _sc_page_groups add column random_allocation boolean NOT NULL DEFAULT false";

module.exports = { sql };
