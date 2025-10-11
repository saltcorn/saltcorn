const sql_pg = `
create table if not exists _sc_api_tokens (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  token text not null unique,
  created_at timestamp not null default now()
);
create index if not exists _sc_api_tokens_user_idx on _sc_api_tokens(user_id);

insert into _sc_api_tokens (user_id, token, created_at)
select u.id as user_id, u.api_token as token, now()
from users u
where u.api_token is not null and u.api_token <> ''
  and not exists (
    select 1 from _sc_api_tokens t where t.token = u.api_token
  );
`;

const sql_sqlite = `
create table if not exists _sc_api_tokens (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  token text not null unique,
  created_at timestamp not null default CURRENT_TIMESTAMP
);
create index if not exists _sc_api_tokens_user_idx on _sc_api_tokens(user_id);

insert into _sc_api_tokens (user_id, token, created_at)
select u.id as user_id, u.api_token as token, CURRENT_TIMESTAMP
from users u
where u.api_token is not null and u.api_token <> ''
  and not exists (
    select 1 from _sc_api_tokens t where t.token = u.api_token
  );
`;

module.exports = { sql_pg, sql_sqlite };
