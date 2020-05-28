const sql = `
alter table _sc_fields add column is_unique boolean NOT NULL DEFAULT false;
`;

module.exports = { sql };
