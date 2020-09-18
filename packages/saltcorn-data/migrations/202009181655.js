const sql = `
alter table users add column resetPasswordToken text;
alter table users add column resetPasswordExpiry timestamp;
`;

module.exports = { sql };
