const sql = `create table _sc_errors (
    id serial primary key,
    stack text NOT NULL,
    message text NOT NULL,
    occur_at timestamp not null,
    tenant text NOT NULL,
    user_id int,
    url text not null,
    headers jsonb not null
);`;

module.exports = { sql };
