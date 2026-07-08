const sql = `
alter table _sc_snapshots add column hash text not null default '';
`;
module.exports = { sql };
