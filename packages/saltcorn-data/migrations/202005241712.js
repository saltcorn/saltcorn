
const sql= `
alter table _sc_plugins add column version text default 'latest';
`;

module.exports = { sql }
    