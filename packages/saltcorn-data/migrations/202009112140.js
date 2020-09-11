const sql = `ALTER TABLE users
ADD CONSTRAINT users_unique_email UNIQUE (email);`;

module.exports = { sql };
