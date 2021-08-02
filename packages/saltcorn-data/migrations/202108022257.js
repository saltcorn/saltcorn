// add min role to _sc_trigger
const sql = 'alter table _sc_triggers add column min_role integer NOT NULL references _sc_roles(id) default 10;';

module.exports = { sql };

    