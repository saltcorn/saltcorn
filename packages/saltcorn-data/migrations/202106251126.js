const sql = `
alter table _sc_plugins add column deploy_private_key text;
`;

module.exports = { sql };