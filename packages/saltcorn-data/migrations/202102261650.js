
const sql = 'alter table users add column "verification_token" text, add column "verified_on" timestamp;';

module.exports = { sql };
    