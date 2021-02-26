const sql = [
  'alter table users add column "verification_token" text',
  'alter table users add column "verified_on" timestamp;',
];

module.exports = { sql };
