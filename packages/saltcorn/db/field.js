const types = require("../types");
const db = require(".");
const { sqlsanitize } = require("./internal.js");
const { calc_sql_type } = require("../routes/utils.js");

const fkeyPrefix = "Key to ";

class Field {
  constructor(o) {
    this.label = o.flabel;
    this.name = o.fname;
    this.id = o.id;
    this.ftype = o.ftype;
    this.is_fkey = o.ftype.startsWith(fkeyPrefix);
    if (!this.is_fkey) this.type = types.as_dict[o.ftype];
    else this.reftable = sqlsanitize(o.ftype.replace(fkeyPrefix, ""));
    this.attributes = o.attributes;
    if (o.table_id) this.table_id = o.table_id;

    if (o.table) {
      this.table = o.table;
      if (o.table.id && !o.table_id) this.table_id = o.table.id;
    }
  }

  get to_formfield() {
    return this.is_fkey
      ? {
          label: this.label,
          name: this.name,
          input_type: "number"
        }
      : {
          label: this.label,
          name: this.name,
          type: this.type,
          input_type: "fromtype"
        };
  }

  get sql_type() {
    if (this.is_fkey) {
      return `int references ${this.reftable} (id)`;
    } else {
      return this.type.sql_name;
    }
  }

  validate(s) {
    const type = this.is_fkey ? types.as_dict.Integer : this.type;
    const readval = type.read(s);
    if (typeof readval === "undefined")
      return { error: "Unable to read " + type.name };
    const valres = type.validate(this.attributes || {})(readval);
    if (valres.error) return valres;
    else return { success: readval };
  }

  static async get_by_table_id(tid) {
    const db_flds = await db.select("fields", { table_id: tid });
    return db_flds.map(dbf => new Field(dbf));
  }

  static async create(fld) {
    const f = new Field(fld);

    await db.query(
      `alter table ${sqlsanitize(f.table.name)} add column ${sqlsanitize(
        f.name
      )} ${calc_sql_type(f.ftype)}`
    );
    await db.insert("fields", {
      table_id: f.table_id,
      fname: f.name,
      flabel: f.label,
      ftype: f.ftype,
      attributes: f.attributes
    });
    return f;
  }
}
module.exports = Field;
