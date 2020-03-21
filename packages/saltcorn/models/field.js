const types = require("../types");
const db = require("../db");
const { sqlsanitize, fkeyPrefix } = require("../db/internal.js");

class Field {
  constructor(o) {
    if (!o.type && !o.input_type) throw "Field initialised with no type";
    this.label = o.label || o.name;
    this.name = o.name;
    this.id = o.id;
    this.type = typeof o.type === "string" ? types[o.type] : o.type;
    this.options = o.options;
    this.required = o.required;
    this.hidden = o.hidden || false;

    this.is_fkey = typeof o.type === "string" && o.type.startsWith(fkeyPrefix);

    if (!this.is_fkey) {
      this.input_type = o.input_type || "fromtype";
    } else {
      this.reftable = sqlsanitize(o.type.replace(fkeyPrefix, ""));
      this.type = o.type;
      this.input_type = "select";
    }

    this.attributes = o.attributes || {};
    if (o.table_id) this.table_id = o.table_id;

    if (o.table) {
      this.table = o.table;
      if (o.table.id && !o.table_id) this.table_id = o.table.id;
    }
  }

  async fill_fkey_options() {
    if (this.is_fkey) {
      const rows = await db.select(this.reftable);
      const summary_field = this.attributes.summary_field || "id";
      this.options = [
        ...new Set(rows.map(r => ({ label: r[summary_field], value: r.id })))
      ];
    }
  }

  get sql_type() {
    if (this.is_fkey) {
      return `int references ${this.reftable} (id)`;
    } else {
      return this.type.sql_name;
    }
  }

  validate(whole_rec) {
    const type = this.is_fkey ? types.Integer : this.type;
    const readval = !type
      ? whole_rec[this.name]
      : type.readFromFormRecord
      ? type.readFromFormRecord(whole_rec, this.name)
      : type.read(whole_rec[this.name]);
    if (typeof readval === "undefined")
      if (this.required) return { error: "Unable to read " + type.name };
      else return { success: null };
    const valres =
      type && type.validate
        ? type.validate(this.attributes || {})(readval)
        : false;
    if (valres.error) return valres;
    else return { success: readval };
  }

  static async find(where) {
    const db_flds = await db.select("fields", where);
    return db_flds.map(dbf => new Field(dbf));
  }
  static async findOne(where) {
    const db_fld = await db.selectOne("fields", where);
    return new Field(db_fld);
  }
  static async create(fld) {
    const f = new Field(fld);
    if (!f.table && f.table_id) f.table = await db.get_table_by_id(f.table_id);
    const q = `alter table ${sqlsanitize(
      f.table.name
    )} add column ${sqlsanitize(f.name)} ${f.sql_type} ${
      f.required ? "not null" : ""
    } ${
      f.attributes.default ? `default '${f.attributes.default}'` : "" //todo escape
    }`;
    //console.log(q)
    await db.query(q);
    await db.insert("fields", {
      table_id: f.table_id,
      name: f.name,
      label: f.label,
      type: f.is_fkey ? f.type : f.type.name,
      required: f.required,
      attributes: f.attributes
    });
    return f;
  }
}
module.exports = Field;
