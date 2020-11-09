const db = require("../db");
const { contract, is } = require("contractis");
const { recalculate_for_stored } = require("./expression");
const { sqlsanitize } = require("../db/internal.js");
const vm = require("vm");
const readKey = (v) => {
  const parsed = parseInt(v);
  return isNaN(parsed) ? null : parsed;
};

class Field {
  constructor(o) {
    if (!o.type && !o.input_type)
      throw new Error(`Field ${o.name} initialised with no type`);
    this.label = o.label || o.name;
    this.name = o.name || Field.labelToName(o.label);
    this.fieldview = o.fieldview;
    this.validator = o.validator || (() => true);
    this.showIf = o.showIf;
    this.parent_field = o.parent_field;
    this.postText = o.postText;
    this.class = o.class || "";
    this.id = o.id;
    this.default = o.default;
    this.sublabel = o.sublabel;
    const { getState } = require("../db/state");

    this.type = typeof o.type === "string" ? getState().types[o.type] : o.type;
    this.options = o.options;
    this.required = o.required ? true : false;
    this.is_unique = o.is_unique ? true : false;
    this.hidden = o.hidden || false;
    this.disabled = !!o.disabled;
    this.calculated = !!o.calculated;
    this.stored = !!o.stored;
    this.expression = o.expression;

    this.is_fkey =
      o.type === "Key" ||
      o.type === "File" ||
      (typeof o.type === "string" && o.type.startsWith("Key to"));

    if (!this.is_fkey) {
      this.input_type = o.input_type || "fromtype";
    } else if (o.type === "File") {
      this.type = "File";
      this.input_type = "file";
      this.reftable_name = "_sc_files";
    } else {
      this.reftable_name =
        o.reftable_name ||
        (o.reftable && o.reftable.name) ||
        o.type.replace("Key to ", "");
      this.reftable = o.reftable;
      this.type = "Key";
      this.input_type = "select";
    }

    this.attributes =
      typeof o.attributes === "string"
        ? JSON.parse(o.attributes)
        : o.attributes || {};
    if (o.table_id) this.table_id = o.table_id;

    if (o.table) {
      this.table = o.table;
      if (o.table.id && !o.table_id) this.table_id = o.table.id;
    }
    contract.class(this);
  }
  get toJson() {
    return {
      id: this.id,
      table_id: this.table_id,
      name: this.name,
      label: this.label,
      is_unique: this.is_unique,
      calculated: this.calculated,
      stored: this.stored,
      expression: this.expression,
      sublabel: this.sublabel,
      fieldview: this.fieldview,
      type: typeof this.type === "string" ? this.type : this.type.name,
      reftable_name: this.reftable_name,
      attributes: this.attributes,
      required: this.required,
    };
  }

  static labelToName(label) {
    return sqlsanitize(label.toLowerCase().replace(" ", "_"));
  }

  get form_name() {
    if (this.parent_field) return `${this.parent_field}_${this.name}`;
    else return this.name;
  }

  async fill_fkey_options(force_allow_none = false) {
    if (
      this.is_fkey &&
      (this.type !== "File" ||
        typeof this.attributes.select_file_where !== "undefined")
    ) {
      const rows = await db.select(
        this.reftable_name,
        this.type === "File" ? this.attributes.select_file_where : undefined
      );
      const summary_field =
        this.attributes.summary_field ||
        (this.type === "File" ? "filename" : "id");
      const dbOpts = rows.map((r) => ({
        label: r[summary_field],
        value: r.id,
      }));
      const allOpts =
        !this.required || force_allow_none
          ? [{ label: "", value: "" }, ...dbOpts]
          : dbOpts;
      this.options = [...new Set(allOpts)];
    }
  }
  async distinct_values() {
    if (
      this.type.name === "String" &&
      this.attributes &&
      this.attributes.options
    ) {
      return [
        { label: "", value: "" },
        ...this.attributes.options
          .split(",")
          .map((o) => ({ label: o.trim(), value: o.trim() })),
      ];
    }
    if (this.is_fkey) {
      await this.fill_fkey_options();
      return this.options || [];
    }
    await this.fill_table();
    const rows = await db.select(this.table.name);
    const dbOpts = rows.map((r) => ({
      label: r[this.name],
      value: r[this.name],
    }));
    return [...new Set([{ label: "", value: "" }, ...dbOpts])];
  }

  get sql_type() {
    if (this.is_fkey) {
      const schema = db.getTenantSchemaPrefix();
      return `int references ${schema}"${sqlsanitize(
        this.reftable_name
      )}" (id)`;
    } else {
      return this.type.sql_name;
    }
  }

  get sql_bare_type() {
    if (this.is_fkey) {
      return `int`;
    } else {
      return this.type.sql_name;
    }
  }

  async generate() {
    if (this.is_fkey) {
      const rows = await db.select(
        this.reftable_name,
        {},
        { limit: 1, orderBy: "RANDOM()" }
      );
      if (rows.length === 1) return rows[0].id;
    } else {
      if (this.type && this.type.contract)
        return this.type.contract(this.attributes).generate();
    }
  }

  validate(whole_rec) {
    const type = this.is_fkey ? { name: "Key" } : this.type;
    const readval = this.is_fkey
      ? readKey(whole_rec[this.form_name])
      : !type || !type.read
      ? whole_rec[this.form_name]
      : type.readFromFormRecord
      ? type.readFromFormRecord(whole_rec, this.form_name)
      : type.read(whole_rec[this.form_name], this.attributes);
    if (typeof readval === "undefined" || readval === null)
      if (this.required) return { error: "Unable to read " + type.name };
      else return { success: null };
    const tyvalres =
      type && type.validate
        ? type.validate(this.attributes || {})(readval)
        : readval;
    if (tyvalres.error) return tyvalres;
    const fvalres = this.validator(readval);
    if (typeof fvalres === "string") return { error: fvalres };
    if (typeof fvalres === "undefined" || fvalres) return { success: readval };
    else return { error: "Not accepted" };
  }

  static async find(where, selectopts) {
    const db_flds = await db.select("_sc_fields", where, selectopts);
    return db_flds.map((dbf) => new Field(dbf));
  }

  static async findOne(where) {
    const db_fld = await db.selectOne("_sc_fields", where);
    return new Field(db_fld);
  }

  async add_unique_constraint() {
    const schema = db.getTenantSchemaPrefix();
    await this.fill_table();
    if (db.isSQLite)
      await db.query(
        `create unique index ${sqlsanitize(this.table.name)}_${sqlsanitize(
          this.name
        )}_unique on "${sqlsanitize(this.table.name)}"("${sqlsanitize(
          this.name
        )}")`
      );
    else
      await db.query(
        `alter table ${schema}"${sqlsanitize(
          this.table.name
        )}" add CONSTRAINT ${sqlsanitize(this.table.name)}_${sqlsanitize(
          this.name
        )}_unique UNIQUE ("${sqlsanitize(this.name)}")`
      );
  }

  async remove_unique_constraint() {
    const schema = db.getTenantSchemaPrefix();
    await this.fill_table();
    if (db.isSQLite)
      await db.query(
        `drop index ${sqlsanitize(this.table.name)}_${sqlsanitize(
          this.name
        )}_unique;`
      );
    else
      await db.query(
        `alter table ${schema}"${sqlsanitize(
          this.table.name
        )}" drop CONSTRAINT ${sqlsanitize(this.table.name)}_${sqlsanitize(
          this.name
        )}_unique;`
      );
  }

  async toggle_not_null(not_null) {
    const schema = db.getTenantSchemaPrefix();
    await this.fill_table();
    await db.query(
      `alter table ${schema}"${sqlsanitize(
        this.table.name
      )}" alter column "${sqlsanitize(this.name)}" ${
        not_null ? "set" : "drop"
      } not null;`
    );
  }

  async fill_table() {
    if (!this.table) {
      const Table = require("./table");
      this.table = await Table.findOne({ id: this.table_id });
    }
  }

  async update(v) {
    if (
      typeof v.is_unique !== "undefined" &&
      !!v.is_unique !== !!this.is_unique
    ) {
      if (v.is_unique && !this.is_unique) await this.add_unique_constraint();
      if (!v.is_unique && this.is_unique) await this.remove_unique_constraint();
      await db.update("_sc_fields", { is_unique: v.is_unique }, this.id);
    }

    if (typeof v.required !== "undefined" && !!v.required !== !!this.required)
      await this.toggle_not_null(!!v.required);

    await db.update("_sc_fields", v, this.id);
    Object.entries(v).forEach(([k, v]) => {
      this[k] = v;
    });
  }
  get listKey() {
    return this.type.listAs
      ? (r) => this.type.listAs(r[this.name])
      : this.type.showAs
      ? (r) => this.type.showAs(r[this.name])
      : this.name;
  }
  get presets() {
    if (this.type && this.type.presets) return this.type.presets;

    if (this.type === "Key" && this.reftable_name === "users")
      return { LoggedIn: ({ user }) => user && user.id };

    return null;
  }
  async delete() {
    await db.deleteWhere("_sc_fields", { id: this.id });
    const Table = require("./table");
    const table = await Table.findOne({ id: this.table_id });
    const schema = db.getTenantSchemaPrefix();

    if (!db.isSQLite && (!this.calculated || this.stored)) {
      await db.query(
        `alter table ${schema}"${sqlsanitize(
          table.name
        )}" drop column "${sqlsanitize(this.name)}"`
      );
      if (table.versioned) {
        await db.query(
          `alter table ${schema}"${sqlsanitize(
            table.name
          )}__history" drop column "${sqlsanitize(this.name)}"`
        );
      }
    }
  }

  async enable_fkey_constraint(table) {
    if (this.is_fkey && !db.isSQLite) {
      const schema = db.getTenantSchemaPrefix();

      const q = `alter table ${schema}"${sqlsanitize(
        table.name
      )}" ADD CONSTRAINT "fkey_${sqlsanitize(table.name)}_${sqlsanitize(
        this.name
      )}" FOREIGN KEY ("${sqlsanitize(
        this.name
      )}") references ${schema}"${sqlsanitize(this.reftable_name)}" (id)`;
      await db.query(q);
    }
  }

  static async create(fld, bare = false) {
    const f = new Field(fld);
    const schema = db.getTenantSchemaPrefix();

    const Table = require("./table");
    const is_sqlite = db.isSQLite;
    //const tables = await Table.find();
    //console.log({ tables, fld });

    const sql_type = bare ? f.sql_bare_type : f.sql_type;
    const table = await Table.findOne({ id: f.table_id });
    if (!f.calculated || f.stored) {
      if (typeof f.attributes.default === "undefined") {
        const q = `alter table ${schema}"${sqlsanitize(
          table.name
        )}" add column "${sqlsanitize(f.name)}" ${sql_type} ${
          f.required ? `not null ${is_sqlite ? 'default ""' : ""}` : ""
        }`;
        await db.query(q);
      } else if (is_sqlite) {
        //warning: not safe but sqlite so we don't care
        const q = `alter table ${schema}"${sqlsanitize(
          table.name
        )}" add column "${sqlsanitize(f.name)}" ${sql_type} ${
          f.required
            ? `not null default ${JSON.stringify(f.attributes.default)}`
            : ""
        }`;
        await db.query(q);
      } else {
        const q = `DROP FUNCTION IF EXISTS add_field_${sqlsanitize(f.name)};
      CREATE FUNCTION add_field_${sqlsanitize(f.name)}(thedef ${
          f.sql_bare_type
        }) RETURNS void AS $$
      BEGIN
      EXECUTE format('alter table ${schema}"${sqlsanitize(
          table.name
        )}" add column "${sqlsanitize(f.name)}" ${sql_type} ${
          f.required ? "not null" : ""
        } default %L', thedef);
      END;
      $$ LANGUAGE plpgsql;`;
        await db.query(q);
        await db.query(`SELECT add_field_${sqlsanitize(f.name)}($1)`, [
          f.attributes.default,
        ]);
      }
    }
    f.id = await db.insert("_sc_fields", {
      table_id: f.table_id,
      name: f.name,
      label: f.label,
      type: f.is_fkey ? f.type : f.type.name,
      reftable_name: f.is_fkey ? f.reftable_name : undefined,
      required: f.required,
      is_unique: f.is_unique,
      attributes: f.attributes,
      calculated: f.calculated,
      expression: f.expression,
      stored: f.stored,
    });

    if (table.versioned && !f.calculated) {
      await db.query(
        `alter table ${schema}"${sqlsanitize(
          table.name
        )}__history" add column "${sqlsanitize(f.name)}" ${f.sql_bare_type}`
      );
    }

    if (f.is_unique && !f.calculated) await f.add_unique_constraint();

    if (f.calculated && f.stored) {
      const nrows = await table.countRows({});
      if (nrows > 0) {
        recalculate_for_stored(table); //not waiting as there could be a lot of data
      }
    }
    return f;
  }
}

Field.contract = {
  variables: {
    name: is.str,
    label: is.str,
    class: is.str,
    postText: is.maybe(is.str),
    sublabel: is.maybe(is.str),
    fieldview: is.maybe(is.str),
    parent_field: is.maybe(is.str),
    reftable_name: is.maybe(is.str),
    validator: is.fun(is.any, is.bool),
    type: is.maybe(
      is.or(is.eq("Key"), is.eq("File"), is.obj({ name: is.str }))
    ),
    input_type: is.maybe(
      is.one_of([
        "hidden",
        "file",
        "select",
        "fromtype",
        "search",
        "text",
        "password",
        "section_header",
        "textarea",
      ])
    ),
    is_fkey: is.bool,
    is_unique: is.bool,
    required: is.bool,
    disabled: is.bool,
    id: is.maybe(is.posint),
    attributes: is.obj(),
    table_id: is.maybe(is.posint),
  },
  instance_check: is.and(
    is.or(is.obj({ type: is.defined }), is.obj({ input_type: is.defined })),
    is.or(
      is.obj({ is_fkey: is.eq(false), reftable_name: is.eq(undefined) }),
      is.obj({ is_fkey: is.eq(true), reftable_name: is.str })
    )
  ),
  methods: {
    validate: is.fun(
      is.obj(),
      is.or(is.obj({ errors: is.str }), is.obj({ success: is.any }))
    ),
    toJson: is.getter(is.obj({ type: is.str })),
    sql_type: is.getter(is.str),
    sql_bare_type: is.getter(is.str),
    form_name: is.getter(is.str),
    listKey: is.getter(is.any), // todo why not str?
    presets: is.getter(is.maybe(is.objVals(is.fun(is.obj(), is.any)))),
    delete: is.fun([], is.promise(is.undefined)),
    generate: is.fun([], is.promise(is.any)),
    add_unique_constraint: is.fun([], is.promise(is.undefined)),
    remove_unique_constraint: is.fun([], is.promise(is.undefined)),
    toggle_not_null: is.fun(is.bool, is.promise(is.undefined)), // TODO requires postgres
    fill_table: is.fun([], is.promise(is.undefined)),
    update: is.fun(is.obj(), is.promise(is.undefined)), //TODO requires not-null id
    fill_fkey_options: is.fun(is.maybe(is.bool), is.promise()),
    distinct_values: is.fun(
      [],
      is.promise(is.array(is.obj({ label: is.any, value: is.any })))
    ),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("Field")))
    ),
    findOne: is.fun(is.obj(), is.promise(is.class("Field"))),
    create: is.fun(is.obj(), is.promise(is.class("Field"))),
    labelToName: is.fun(is.str, is.str),
  },
};
module.exports = Field;
