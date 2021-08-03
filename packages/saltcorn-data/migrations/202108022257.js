// add min role to _sc_trigger
//const sql = 'alter table _sc_triggers add column min_role integer NOT NULL references _sc_roles(id) default 10;';
const sql =[
    "alter table _sc_triggers add column min_role integer references _sc_roles(id);",
    "update _sc_triggers set min_role=1 where when_trigger='API call' and min_role is null;",
];

module.exports = { sql };

    