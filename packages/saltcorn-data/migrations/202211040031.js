const sql = [
    `alter table _sc_tenants add column template text;`,
    `alter table _sc_tenants add column created timestamp;`,
];
module.exports = { sql };
    