const sql = `
alter table users add column reset_password_token text;
alter table users add column reset_password_expiry timestamp;
`;

module.exports = { sql };
