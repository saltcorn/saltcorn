const db = require("../db");
const { sqlsanitize, mkWhere, mkSelectOptions } = require("../db/internal.js");
const Field = require("./field");
const { contract, is } = require("contractis");
const { is_table_query } = require("../contracts");
const csvtojson = require("csvtojson");
const moment = require("moment");

const transposeObjects = objs => {
  const keys = new Set();
  for (const o of objs) {
    Object.keys(o).forEach(k => keys.add(k));
  }
  const res = {};
  keys.forEach(k => {
    res[k] = [];
  });
  for (const o of objs) {
    keys.forEach(k => {
      res[k].push(o[k]);
    });
  }
  return res;
};

const dateFormats = [moment.ISO_8601];

const isDate = function(date) {
  return moment(date, dateFormats, true).isValid();
};

const normalise_error_message = msg =>
  db.isSQLite
    ? msg.replace(
        /SQLITE_CONSTRAINT: UNIQUE constraint failed: (.*?)\.(.*?)/,
        "Duplicate value for unique field: $2"
      )
    : msg.replace(
        /duplicate key value violates unique constraint "(.*?)_(.*?)_unique"/,
        "Duplicate value for unique field: $2"
      );

class Table {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
    this.expose_api_read = o.expose_api_read;
    this.expose_api_write = o.expose_api_write;
    this.min_role_read = o.min_role_read;
    this.min_role_write = o.min_role_write;
    this.versioned = !!o.versioned;
    contract.class(this);
  }
  static async findOne(where) {
    const tbl = await db.selectMaybeOne("_sc_tables", where);

    return tbl ? new Table(tbl) : tbl;
  }
  static async find(where, selectopts) {
    const tbls = await db.select("_sc_tables", where, selectopts);

    return tbls.map(t => new Table(t));
  }
  static async create(name, options = {}) {
    const schema = db.getTenantSchemaPrefix();
    await db.query(
      `create table ${schema}"${sqlsanitize(name)}" (id ${
        db.isSQLite ? "integer" : "serial"
      } primary key)`
    );
    const tblrow = {
      name,
      versioned: options.versioned || false,
      expose_api_read: options.expose_api_read || false,
      expose_api_write: options.expose_api_write || false,
      min_role_read: options.min_role_read || 1,
      min_role_write: options.min_role_write || 1
    };
    const id = await db.insert("_sc_tables", tblrow);
    return new Table({ ...tblrow, id });
  }
  async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`drop table ${schema}"${sqlsanitize(this.name)}"`);
    await db.query(`delete FROM ${schema}_sc_fields WHERE table_id = $1`, [
      this.id
    ]);

    await db.query(`delete FROM ${schema}_sc_tables WHERE id = $1`, [this.id]);
  }
  get sql_name() {
    return `${db.getTenantSchemaPrefix()}"${sqlsanitize(this.name)}"`;
  }
  async deleteRows(where) {
    await db.deleteWhere(this.name, where);
  }

  async getRow(where) {
    return await db.selectOne(this.name, where);
  }

  async getRows(where, selopts) {
    return await db.select(this.name, where, selopts);
  }
  async countRows(where) {
    return await db.count(this.name, where);
  }
  async updateRow(v, id, _userid) {
    if (this.versioned)
      await db.insert(this.name + "__history", {
        ...v,
        id,
        _version: {
          sql: `coalesce((select max(_version) from "${this.name +
            "__history"}" where id=${+id}), 0)+1`
        },
        _time: new Date(),
        _userid
      });
    return await db.update(this.name, v, id);
  }
  async tryUpdateRow(v, id, _userid) {
    try {
      await this.updateRow(v, id, _userid);
      return { success: true };
    } catch (e) {
      return { error: normalise_error_message(e.message) };
    }
  }

  async toggleBool(id, field_name) {
    const schema = db.getTenantSchemaPrefix();
    await db.query(
      `update ${schema}"${sqlsanitize(this.name)}" set ${sqlsanitize(
        field_name
      )}=NOT ${sqlsanitize(field_name)} where id=$1`,
      [id]
    );
  }

  async insertRow(v, _userid) {
    const id = await db.insert(this.name, v);
    if (this.versioned)
      await db.insert(this.name + "__history", {
        ...v,
        id,
        _version: 1,
        _userid,
        _time: new Date()
      });
    return id;
  }

  async tryInsertRow(v, _userid) {
    try {
      const id = await this.insertRow(v, _userid);
      return { success: id };
    } catch (e) {
      return { error: normalise_error_message(e.message) };
    }
  }

  async getFields() {
    if (!this.fields)
      this.fields = await Field.find({ table_id: this.id }, { orderBy: "id" });
    return this.fields;
  }

  async update(new_table_rec) {
    //TODO RENAME TABLE

    const schemaPrefix = db.getTenantSchemaPrefix();

    const existing = await Table.findOne({ id: this.id });
    await db.update("_sc_tables", new_table_rec, this.id);
    const new_table = await Table.findOne({ id: this.id });

    if (new_table.versioned && !existing.versioned) {
      const fields = await new_table.getFields();
      const flds = fields.map(
        f => `,"${sqlsanitize(f.name)}" ${f.sql_bare_type}`
      );

      await db.query(
        `create table ${schemaPrefix}"${sqlsanitize(new_table.name)}__history" (
          id integer not null,
          _version integer,
          _time timestamp,
          _userid integer
          ${flds.join("")}
          ,PRIMARY KEY(id, _version)
          );`
      );
    } else if (!new_table.versioned && existing.versioned) {
      await db.query(`
      drop table ${schemaPrefix}"${sqlsanitize(new_table.name)}__history";`);
    }
  }

  async get_history() {
    return await db.select(
      `${sqlsanitize(this.name)}__history`,
      {},
      { orderBy: "_version" }
    );
  }

  static async create_from_csv(name, filePath) {
    const rows = await csvtojson().fromFile(filePath);
    const rowsTr = transposeObjects(rows);
    const table = await Table.create(name);

    for (const [k, vs] of Object.entries(rowsTr)) {
      if (k === "id") continue;
      const required = vs.every(v => v !== "");
      const nonEmpties = vs.filter(v => v !== "");
      const isBools = "true false yes no on off y n t f".split(" ");
      var type;
      if (
        nonEmpties.every(v =>
          //https://www.postgresql.org/docs/11/datatype-boolean.html

          isBools.includes(v && v.toLowerCase && v.toLowerCase())
        )
      )
        type = "Bool";
      else if (nonEmpties.every(v => !isNaN(v)))
        if (nonEmpties.every(v => Number.isSafeInteger(+v))) type = "Integer";
        else type = "Float";
      else if (nonEmpties.every(v => isDate(v))) type = "Date";
      else type = "String";
      const label = (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");
      await Field.create({
        name: k,
        required,
        type,
        table,
        label
      });
    }
    const parse_res = await table.import_csv_file(filePath);
    parse_res.table = table;
    return parse_res;
  }

  async import_csv_file(filePath) {
    const [headers] = await csvtojson({
      output: "csv",
      noheader: true
    }).fromFile(filePath);
    const fields = await this.getFields();
    const okHeaders = {};
    for (const f of fields) {
      if (headers.includes(f.name)) okHeaders[f.name] = f;
      else if (headers.includes(f.label)) okHeaders[f.label] = f;
      else if (f.required)
        return { error: `Required field missing: ${f.label}` };
    }
    // also id
    if (headers.includes(`id`)) okHeaders.id = { type: "Integer" };
    const colRe = new RegExp(`(${Object.keys(okHeaders).join("|")})`);
    const file_rows = await csvtojson({
      includeColumns: colRe
    }).fromFile(filePath);
    var i = 1;
    const client = db.isSQLite ? db : await db.getClient();
    await client.query("BEGIN");
    for (const rec of file_rows) {
      i += 1;
      try {
        await db.insert(this.name, rec, true, client);
      } catch (e) {
        await client.query("ROLLBACK");

        await client.release(true);
        return { error: `${e.message} in row ${i}` };
      }
    }
    await client.query("COMMIT");

    if (!db.isSQLite) await client.release(true);

    return {
      success: `Imported ${file_rows.length} rows into table ${this.name}`
    };
  }

  async get_parent_relations() {
    const fields = await this.getFields();
    var parent_relations = [];
    var parent_field_list = [];
    for (const f of fields) {
      if (f.is_fkey && f.type !== "File") {
        if (f.reftable_name === "users") {
          parent_field_list.push(`${f.name}.email`);
          const table = new Table({ name: "users " });
          parent_relations.push({ key_field: f, table });
        } else {
          const table = await Table.findOne({ name: f.reftable_name });
          await table.getFields();
          table.fields.forEach(pf => {
            parent_field_list.push(`${f.name}.${pf.name}`);
          });
          parent_relations.push({ key_field: f, table });
        }
      }
    }
    return { parent_relations, parent_field_list };
  }

  async get_child_relations() {
    const cfields = await Field.find({ reftable_name: this.name });
    var child_relations = [];
    var child_field_list = [];
    for (const f of cfields) {
      if (f.is_fkey) {
        const table = await Table.findOne({ id: f.table_id });
        child_field_list.push(`${table.name}.${f.name}`);
        await table.getFields();
        child_relations.push({ key_field: f, table });
      }
    }
    return { child_relations, child_field_list };
  }
  async getJoinedRows(opts = {}) {
    const fields = await this.getFields();
    var fldNms = ["a.id"];
    var joinq = "";
    var joinTables = [];
    var joinFields = opts.joinFields || [];
    const schema = db.getTenantSchemaPrefix();

    fields
      .filter(f => f.type === "File")
      .forEach(f => {
        joinFields[`${f.name}__filename`] = {
          ref: f.name,
          reftable: "_sc_files",
          target: `filename`
        };
      });

    Object.entries(joinFields).forEach(([fldnm, { ref, target }]) => {
      const reftable = fields.find(f => f.name === ref).reftable_name;
      const jtNm = `${sqlsanitize(reftable)}_jt_${sqlsanitize(ref)}`;
      if (!joinTables.includes(jtNm)) {
        joinTables.push(jtNm);
        joinq += ` left join ${schema}"${sqlsanitize(
          reftable
        )}" ${jtNm} on ${jtNm}.id=a.${sqlsanitize(ref)}`;
      }
      fldNms.push(`${jtNm}.${sqlsanitize(target)} as ${sqlsanitize(fldnm)}`);
    });
    for (const f of fields) {
      fldNms.push(`a."${sqlsanitize(f.name)}"`);
    }
    Object.entries(opts.aggregations || {}).forEach(
      ([fldnm, { table, ref, field, aggregate }]) => {
        fldNms.push(
          `(select ${sqlsanitize(aggregate)}(${sqlsanitize(field) ||
            "*"}) from ${schema}"${sqlsanitize(table)}" where ${sqlsanitize(
            ref
          )}=a.id) ${sqlsanitize(fldnm)}`
        );
      }
    );

    var whereObj = {};
    if (opts.where) {
      Object.keys(opts.where).forEach(k => {
        if (k === "_fts") whereObj[k] = { table: "a", ...opts.where[k] };
        else whereObj["a." + k] = opts.where[k];
      });
    }
    const { where, values } = mkWhere(whereObj, db.isSQLite);
    const selectopts = {
      limit: opts.limit,
      orderBy: opts.orderBy && "a." + opts.orderBy,
      orderDesc: opts.orderDesc,
      offset: opts.offset
    };

    const sql = `SELECT ${fldNms.join()} FROM ${schema}"${sqlsanitize(
      this.name
    )}" a ${joinq} ${where}  ${mkSelectOptions(selectopts)}`;
    const res = await db.query(sql, values);

    return res.rows;
  }
}

Table.contract = {
  constructs: { name: is.str },
  variables: { name: is.str },
  methods: {
    delete: is.fun([], is.promise(is.eq(undefined))),
    deleteRows: is.fun(is.obj(), is.promise(is.eq(undefined))),
    getRow: is.fun(is.obj(), is.promise(is.obj())),
    getRows: is.fun(is.maybe(is.obj()), is.promise(is.array(is.obj()))),
    countRows: is.fun(is.maybe(is.obj()), is.promise(is.posint)),
    updateRow: is.fun([is.obj(), is.posint], is.promise(is.eq(undefined))),
    toggleBool: is.fun([is.posint, is.str], is.promise(is.eq(undefined))),
    insertRow: is.fun(is.obj(), is.promise(is.posint)),
    tryInsertRow: is.fun(
      [is.obj(), is.maybe(is.posint)],
      is.promise(
        is.or(is.obj({ error: is.str }), is.obj({ success: is.posint }))
      )
    ),
    tryUpdateRow: is.fun(
      [is.obj(), is.posint, is.maybe(is.posint)],
      is.promise(
        is.or(is.obj({ error: is.str }), is.obj({ success: is.eq(true) }))
      )
    ),
    getFields: is.fun([], is.promise(is.array(is.class("Field")))),
    get_parent_relations: is.fun(
      [],
      is.promise(
        is.obj({
          parent_relations: is.array(
            is.obj({
              key_field: is.class("Field"),
              table: is.class("Table")
            })
          ),
          parent_field_list: is.array(is.str)
        })
      )
    ),
    get_child_relations: is.fun(
      [],
      is.promise(
        is.obj({
          child_relations: is.array(
            is.obj({
              key_field: is.class("Field"),
              table: is.class("Table")
            })
          ),
          child_field_list: is.array(is.str)
        })
      )
    ),
    getJoinedRows: is.fun(
      is.maybe(is_table_query),
      is.promise(is.array(is.obj({})))
    )
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("Table")))
    ),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("Table")))),
    create: is.fun(is.str, is.promise(is.class("Table")))
    //update: is.fun([is.posint, is.obj({})], is.promise(is.eq(undefined)))
  }
};
module.exports = Table;
