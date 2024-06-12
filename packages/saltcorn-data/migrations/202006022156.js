const sql = `
create table IF NOT EXISTS _sc_files (
    id serial primary key,
    filename text NOT NULL,
    location text NOT NULL,
    uploaded_at timestamp not null,
    size_kb int not null,
    user_id int references users(id),
    mime_super text not null,
    mime_sub text not null,
    min_role_read integer NOT NULL references _sc_roles(id)
);
`;

module.exports = { sql };
