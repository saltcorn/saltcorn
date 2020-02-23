const types = require("../types");
const db = require("../db");
const { sqlsanitize } = require("./utils.js");


const fkeyPrefix = "Key to ";

class Field {
  constructor(o) {
    this.label = o.flabel;
    this.name = o.fname;
    this.is_fkey = o.ftype.startsWith(fkeyPrefix);
    if (!this.is_fkey) this.type = types.as_dict[o.ftype];
    else this.reftable = sqlsanitize(o.ftype.replace(fkeyPrefix, ""));
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

  sql_type() {
    if (this.is_fkey) {
      return `int references ${this.reftable} (id)`;
    } else {
      return this.type.sql_name;
    }
  }

  static async get_by_table_id(tid) {
    const db_flds = await db.get_fields_by_table_id(tid);
    return db_flds.map(dbf => new Field(dbf));
  }
}
module.exports = Field;
