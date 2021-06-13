
const sql = [
    "alter table _sc_tenants alter column description set default '';",
    "alter table _sc_tables alter column description set default '';",
    "alter table _sc_views alter column description set default '';",
    "alter table _sc_fields alter column description set default '';",
    "alter table _sc_pages alter column description set default '';",
];;

module.exports = { sql };
    