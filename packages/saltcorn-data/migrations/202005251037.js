const sql = `
update _sc_roles set id= 10 where role='public';
update _sc_roles set id= 8 where role='user';
update _sc_roles set id= 4 where role='staff';
`;

module.exports = { sql };
