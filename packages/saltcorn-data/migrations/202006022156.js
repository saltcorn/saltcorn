const sql = `
create table _sc_files (
    id serial primary key,
    filename text NOT NULL,
    location text NOT NULL,
    uploaded_at timestamp not null,
    size_kb int not null,
    user_id int references users(id)
);
`;

module.exports = { sql };
