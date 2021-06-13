
const sql = "alter table _sc_fields add column description text;";

// todo implement rollback mechanism
// const rollback_sql = "alter table _sc_fields drop column description text;";

module.exports = { sql };
    