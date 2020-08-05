const sql = `
alter table _sc_plugins add column configuration jsonb;
`;

module.exports = { sql };
