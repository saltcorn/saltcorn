const sql_pg = `ALTER TABLE users
ADD CONSTRAINT users_unique_email UNIQUE (email);`;

const sql_sqlite = `create unique index users_unique_email on users(email);`;

module.exports = { sql_pg, sql_sqlite };
