/**
 * Table Database Access Layer
 *
 */
const db = require("../db");
const { sqlsanitize, mkWhere, mkSelectOptions } = require("../db/internal.js");
const Field = require("./field");
const Trigger = require("./trigger");
const {
  apply_calculated_fields,
  apply_calculated_fields_stored,
  recalculate_for_stored,
} = require("./expression");
const { contract, is } = require("contractis");
const { is_table_query } = require("../contracts");
const csvtojson = require("csvtojson");
const moment = require("moment");
const fs = require("fs");
const {
  InvalidConfiguration,
  InvalidAdminAction,
  satisfies,
  structuredClone,
  getLines,
} = require("../utils");

const transposeObjects = (objs) => {
  const keys = new Set();
  for (const o of objs) {
    Object.keys(o).forEach((k) => keys.add(k));
  }
  const res = {};
  keys.forEach((k) => {
    res[k] = [];
  });
  for (const o of objs) {
    keys.forEach((k) => {
      res[k].push(o[k]);
    });
  }
  return res;
};
// todo configure date format
const dateFormats = [moment.ISO_8601];

const isDate = function (date) {
  return moment(date, dateFormats, true).isValid();
};
// todo resolve database specific
const normalise_error_message = (msg) =>
  db.isSQLite
    ? msg.replace(
        /SQLITE_CONSTRAINT: UNIQUE constraint failed: (.*?)\.(.*?)/,
        "Duplicate value for unique field: $2"
      )
    : msg.replace(
        /duplicate key value violates unique constraint "(.*?)_(.*?)_unique"/,
        "Duplicate value for unique field: $2"
      );

/**
 * Table class
 */
class Table {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
    this.min_role_read = o.min_role_read;
    this.min_role_write = o.min_role_write;
    this.ownership_field_id = o.ownership_field_id;
    this.versioned = !!o.versioned;
    this.external = false;
    this.description = o.description;
    if (o.fields) this.fields = o.fields.map((f) => new Field(f));
    contract.class(this);
  }

  /**
   *
   * Find one Table
   * @param where - where condition
   * @returns {Promise<*|Table|null>} table or null
   */
  static async findOne(where) {
    if (
      where &&
      ((where.constructor && where.constructor.name === "Table") ||
        where.getRows)
    )
      return where;
    if (typeof where === "string") return Table.findOne({ name: where });
    if (typeof where === "number") return Table.findOne({ id: where });
    if (where.name) {
      const { getState } = require("../db/state");
      const extTable = getState().external_tables[where.name];
      if (extTable) return extTable;
    }
    const { getState } = require("../db/state");
    const tbl = getState().tables.find(
      where.id
        ? (v) => v.id === +where.id
        : where.name
        ? (v) => v.name === where.name
        : satisfies(where)
    );
    return tbl ? new Table(structuredClone(tbl)) : null;
  }

  /**
   * Find Tables
   * @param where - where condition
   * @param selectopts - options
   * @returns {Promise<*>} table list
   */
  static async find(where, selectopts = { orderBy: "name", nocase: true }) {
    const tbls = await db.select("_sc_tables", where, selectopts);

    return tbls.map((t) => new Table(t));
  }
  static async find_with_external(
    where0 = {},
    selectopts = { orderBy: "name", nocase: true }
  ) {
    const { external, ...where } = where0;
    let externals = [],
      dbs = [];
    if (external !== false) {
      //do include externals
      const { getState } = require("../db/state");
      externals = Object.values(getState().external_tables);
    }
    if (external !== true) {
      //do include db tables
      const tbls = await db.select("_sc_tables", where, selectopts);
      dbs = tbls.map((t) => new Table(t));
    }
    return [...dbs, ...externals];
  }

  /**
   * Get owner column name
   * @param fields - fields list
   * @returns {null|*} null or owner column name
   */
  owner_fieldname_from_fields(fields) {
    if (!this.ownership_field_id) return null;
    const field = fields.find((f) => f.id === this.ownership_field_id);
    return field.name;
  }

  /**
   * Get owner column name
   * @returns {Promise<string|null|*>}
   */
  async owner_fieldname() {
    if (this.name === "users") return "id";
    if (!this.ownership_field_id) return null;
    const fields = await this.getFields();
    return this.owner_fieldname_from_fields(fields);
  }

  /**
   * Check if user is owner of row
   * @param user - user
   * @param row - table row
   * @returns {Promise<string|null|*|boolean>}
   */
  async is_owner(user, row) {
    if (!user) return false;
    const field_name = await this.owner_fieldname();
    return field_name && row[field_name] === user.id;
  }

  /**
   * Create table
   * @param name - table name
   * @param options - table fields
   * @returns {Promise<Table>} table
   */
  static async create(name, options = {}) {
    const schema = db.getTenantSchemaPrefix();
    // create table in database
    await db.query(
      `create table ${schema}"${sqlsanitize(name)}" (id ${
        db.isSQLite ? "integer" : "serial"
      } primary key)`
    );
    // populate table definition row
    const tblrow = {
      name,
      versioned: options.versioned || false,
      min_role_read: options.min_role_read || 1,
      min_role_write: options.min_role_write || 1,
      ownership_field_id: options.ownership_field_id,
      description: options.description || "",
    };
    // insert table defintion into _sc_tables
    const id = await db.insert("_sc_tables", tblrow);
    // add primary key columnt ID
    await db.query(
      `insert into ${schema}_sc_fields(table_id, name, label, type, attributes, required, is_unique,primary_key)
          values($1,'id','ID','Integer', '{}', true, true, true)`,
      [id]
    );
    // create table
    const table = new Table({ ...tblrow, id });
    // create table history
    if (table.versioned) await table.create_history_table();
    // refresh tables cache
    await require("../db/state").getState().refresh_tables();

    return table;
  }

  /**
   * Drop current table
   * @returns {Promise<void>}
   */
  async delete() {
    const schema = db.getTenantSchemaPrefix();
    const is_sqlite = db.isSQLite;
    await this.update({ ownership_field_id: null });
    const client = is_sqlite ? db : await db.getClient();
    await client.query(`BEGIN`);
    try {
      await client.query(
        `drop table if exists ${schema}"${sqlsanitize(this.name)}"`
      );
      await client.query(
        `delete FROM ${schema}_sc_fields WHERE table_id = $1`,
        [this.id]
      );

      await client.query(`delete FROM ${schema}_sc_tables WHERE id = $1`, [
        this.id,
      ]);
      if (this.versioned)
        await client.query(
          `drop table if exists ${schema}"${sqlsanitize(this.name)}__history"`
        );

      await client.query(`COMMIT`);
    } catch (e) {
      await client.query(`ROLLBACK`);
      if (!is_sqlite) client.release(true);
      throw e;
    }
    if (!is_sqlite) client.release(true);
    await require("../db/state").getState().refresh_tables();
  }

  /***
   * get Table SQL Name
   * @returns {string}
   */
  get sql_name() {
    return `${db.getTenantSchemaPrefix()}"${sqlsanitize(this.name)}"`;
  }

  /**
   * Delete rows from table
   * @param where - condition
   * @returns {Promise<void>}
   */
  async deleteRows(where) {
    const triggers = await Trigger.getTableTriggers("Delete", this);
    if (triggers.length > 0) {
      const rows = await this.getRows(where);
      for (const trigger of triggers) {
        for (const row of rows) {
          await trigger.run(row);
        }
      }
    }
    await db.deleteWhere(this.name, where);
  }

  /**
   * ????
   * @param row
   * @returns {*}
   */
  readFromDB(row) {
    for (const f of this.fields) {
      if (f.type && f.type.readFromDB)
        row[f.name] = f.type.readFromDB(row[f.name]);
    }
    return row;
  }

  /**
   * Get one row from table in db
   * @param where
   * @returns {Promise<null|*>}
   */
  async getRow(where) {
    await this.getFields();
    const row = await db.selectMaybeOne(this.name, where);
    if (!row) return null;
    return apply_calculated_fields([this.readFromDB(row)], this.fields)[0];
  }

  /**
   * Get rows from Table in db
   * @param where
   * @param selopts
   * @returns {Promise<*>}
   */
  async getRows(where, selopts) {
    await this.getFields();
    const rows = await db.select(this.name, where, selopts);
    return apply_calculated_fields(
      rows.map((r) => this.readFromDB(r)),
      this.fields
    );
  }

  /**
   * Count amount of rows in db table
   * @param where
   * @returns {Promise<number>}
   */
  async countRows(where) {
    return await db.count(this.name, where);
  }

  /**
   * Return distinct Values for column in table
   * ????
   * @param fieldnm
   * @returns {Promise<*>}
   */

  async distinctValues(fieldnm) {
    const res = await db.query(
      `select distinct "${db.sqlsanitize(fieldnm)}" from ${this.sql_name}`
    );
    return res.rows.map((r) => r[fieldnm]);
  }

  /**
   * Update row
   * @param v_in
   * @param id
   * @param _userid
   * @returns {Promise<void>}
   */
  async updateRow(v_in, id, _userid) {
    let existing;
    let v;
    const fields = await this.getFields();
    const pk_name = this.pk_name;
    if (fields.some((f) => f.calculated && f.stored)) {
      existing = await db.selectOne(this.name, { [pk_name]: id });
      v = await apply_calculated_fields_stored(
        { ...existing, ...v_in },
        this.fields
      );
    } else v = v_in;
    if (this.versioned) {
      if (!existing)
        existing = await db.selectOne(this.name, { [pk_name]: id });
      await db.insert(this.name + "__history", {
        ...existing,
        ...v,
        [pk_name]: id,
        _version: {
          next_version_by_id: +id,
        },
        _time: new Date(),
        _userid,
      });
    }
    await db.update(this.name, v, id, { pk_name });
    if (typeof existing === "undefined") {
      const triggers = await Trigger.getTableTriggers("Update", this);
      if (triggers.length > 0)
        existing = await db.selectOne(this.name, { [pk_name]: id });
    }
    const newRow = { ...existing, ...v, [pk_name]: id };
    await Trigger.runTableTriggers("Update", this, newRow);

}

  /**
   * Try to Update row
   * @param v
   * @param id
   * @param _userid
   * @returns {Promise<{error}|{success: boolean}>}
   */
  async tryUpdateRow(v, id, _userid) {
    try {
      await this.updateRow(v, id, _userid);
      return { success: true };
    } catch (e) {
      return { error: normalise_error_message(e.message) };
    }
  }

  /**
   * ????
   * @param id
   * @param field_name
   * @returns {Promise<void>}
   */
  async toggleBool(id, field_name) {
    const schema = db.getTenantSchemaPrefix();
    await db.query(
      `update ${schema}"${sqlsanitize(this.name)}" set "${sqlsanitize(
        field_name
      )}"=NOT coalesce("${sqlsanitize(field_name)}", false) where id=$1`,
      [id]
    );
    const triggers = await Trigger.getTableTriggers("Update", this);
    if (triggers.length > 0) {
      const row = await this.getRow({ id });
      for (const trigger of triggers) {
        await trigger.run(row);
      }
    }
  }

  /**
   * Get primary key field
   * @returns {*}
   */
  get pk_name() {
    return this.fields.find((f) => f.primary_key).name;
  }

  /**
   * Insert row
   * @param v_in
   * @param _userid
   * @returns {Promise<*>}
   */
  async insertRow(v_in, _userid) {
    await this.getFields();
    const v = await apply_calculated_fields_stored(v_in, this.fields);
    const pk_name = this.pk_name;
    const id = await db.insert(this.name, v, { pk_name });
    if (this.versioned)
      await db.insert(this.name + "__history", {
        ...v,
        [pk_name]: id,
        _version: 1,
        _userid,
        _time: new Date(),
      });
    await Trigger.runTableTriggers("Insert", this, { [pk_name]: id, ...v });
    return id;
  }

  /**
   * Try to Insert row
   * @param v
   * @param _userid
   * @returns {Promise<{error}|{success: *}>}
   */
  async tryInsertRow(v, _userid) {
    try {
      const id = await this.insertRow(v, _userid);
      return { success: id };
    } catch (e) {
      return { error: normalise_error_message(e.message) };
    }
  }

  /**
   * Get Fields list for table
   * @returns {Promise<*>}
   */
  async getFields() {
    if (!this.fields) {
      this.fields = await Field.find({ table_id: this.id }, { orderBy: "id" });
    }
    return this.fields;
  }

  /**
   * Create history table
   * @returns {Promise<void>}
   */
  // todo create function that returns history table name for table
  async create_history_table() {
    const schemaPrefix = db.getTenantSchemaPrefix();

    const fields = await this.getFields();
    const flds = fields.map(
      (f) => `,"${sqlsanitize(f.name)}" ${f.sql_bare_type}`
    );
    const pk = fields.find((f) => f.primary_key).name;

    // create history table
    await db.query(
      `create table ${schemaPrefix}"${sqlsanitize(this.name)}__history" (
          _version integer,
          _time timestamp,
          _userid integer
          ${flds.join("")}
          ,PRIMARY KEY("${pk}", _version)
          );`
    );
  }

  /**
   * Drop history table
   * @returns {Promise<void>}
   */
  async drop_history_table() {
    const schemaPrefix = db.getTenantSchemaPrefix();

    await db.query(`
      drop table ${schemaPrefix}"${sqlsanitize(this.name)}__history";`);
  }

  /**
   * Rename table
   * @param new_name
   * @returns {Promise<void>}
   */
  async rename(new_name) {
    //in transaction
    if (db.isSQLite)
      throw new InvalidAdminAction("Cannot rename table on SQLite");
    const schemaPrefix = db.getTenantSchemaPrefix();

    const client = await db.getClient();
    await client.query(`BEGIN`);
    try {
      //rename table
      await db.query(
        `alter table ${schemaPrefix}"${sqlsanitize(
          this.name
        )}" rename to "${sqlsanitize(new_name)}";`
      );
      //change refs
      await db.query(
        `update ${schemaPrefix}_sc_fields set reftable_name=$1 where reftable_name=$2`,
        [sqlsanitize(new_name), sqlsanitize(this.name)]
      );
      //rename history
      if (this.versioned)
        await db.query(
          `alter table ${schemaPrefix}"${sqlsanitize(
            this.name
          )}__history" rename to "${sqlsanitize(new_name)}__history";`
        );
      //1. change record
      await this.update({ name: new_name });
      await client.query(`COMMIT`);
    } catch (e) {
      await client.query(`ROLLBACK`);
      client.release(true);
      throw e;
    }
    client.release(true);
    await require("../db/state").getState().refresh_tables();
  }
  async update(new_table_rec) {
    //TODO RENAME TABLE
    if (new_table_rec.ownership_field_id === "")
      delete new_table_rec.ownership_field_id;
    const existing = await Table.findOne({ id: this.id });
    const { external, fields, ...upd_rec } = new_table_rec;
    await db.update("_sc_tables", upd_rec, this.id);
    await require("../db/state").getState().refresh_tables();

    const new_table = await Table.findOne({ id: this.id });

    if (new_table.versioned && !existing.versioned) {
      await new_table.create_history_table();
    } else if (!new_table.versioned && existing.versioned) {
      await new_table.drop_history_table();
    }
    Object.assign(this, new_table_rec);
  }

  /**
   * Get table history data
   * @param id
   * @returns {Promise<*>}
   */
  async get_history(id) {
    return await db.select(
      `${sqlsanitize(this.name)}__history`,
      { id },
      { orderBy: "_version" }
    );
  }

  /**
   * Enable constraints
   * @returns {Promise<void>}
   */
  async enable_fkey_constraints() {
    const fields = await this.getFields();
    for (const f of fields) await f.enable_fkey_constraint(this);
  }

  /**
   * Table Create from CSV
   * @param name
   * @param filePath
   * @returns {Promise<{error: string}|{error: string}|{error: string}|{error: string}|{error: string}|{success: string}|{error: (string|string|*)}>}
   */
  static async create_from_csv(name, filePath) {
    let rows;
    try {
      const s = await getLines(filePath, 500);
      rows = await csvtojson().fromString(s); // todo agrument type unknown
    } catch (e) {
      return { error: `Error processing CSV file` };
    }
    const rowsTr = transposeObjects(rows);
    const table = await Table.create(name);
    for (const [k, vs] of Object.entries(rowsTr)) {
      const required = vs.every((v) => v !== "");
      const nonEmpties = vs.filter((v) => v !== "");
      const isBools = "true false yes no on off y n t f".split(" ");
      let type;
      if (
        nonEmpties.every((v) =>
          //https://www.postgresql.org/docs/11/datatype-boolean.html

          isBools.includes(v && v.toLowerCase && v.toLowerCase())
        )
      )
        type = "Bool";
      else if (nonEmpties.every((v) => !isNaN(v)))
        if (nonEmpties.every((v) => Number.isSafeInteger(+v))) type = "Integer";
        else type = "Float";
      else if (nonEmpties.every((v) => isDate(v))) type = "Date";
      else type = "String";
      const label = (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");

      //can fail here if: non integer i d, duplicate headers, invalid name
      const fld = new Field({
        name: Field.labelToName(k),
        required,
        type,
        table,
        label,
      });
      if (db.sqlsanitize(k.toLowerCase()) === "id") {
        if (type !== "Integer") {
          await table.delete();
          return { error: `Columns named "id" must have only integers` };
        }
        if (!required) {
          await table.delete();
          return { error: `Columns named "id" must not have missing values` };
        }
        continue;
      }
      if (db.sqlsanitize(fld.name) === "") {
        await table.delete();
        return {
          error: `Invalid column name ${k} - Use A-Z, a-z, 0-9, _ only`,
        };
      }
      try {
        await Field.create(fld);
      } catch (e) {
        await table.delete();
        return { error: `Error in header ${k}: ${e.message}` };
      }
    }
    const parse_res = await table.import_csv_file(filePath);
    if (parse_res.error) {
      await table.delete();
      return { error: parse_res.error };
    }

    parse_res.table = table;
    await require("../db/state").getState().refresh_tables();

    return parse_res;
  }

  /**
   * Import CSV file to existing table
   * @param filePath
   * @param recalc_stored
   * @param skip_first_data_row
   * @returns {Promise<{error: string}|{success: string}>}
   */
  async import_csv_file(filePath, recalc_stored, skip_first_data_row) {
    let headers;
    const { readStateStrict } = require("../plugin-helper");
    try {
      const s = await getLines(filePath, 1);
      [headers] = await csvtojson({
        output: "csv",
        noheader: true,
      }).fromString(s); // todo agrument type unknown
    } catch (e) {
      return { error: `Error processing CSV file` };
    }
    const fields = (await this.getFields()).filter((f) => !f.calculated);
    const okHeaders = {};
    const pk_name = this.pk_name;
    const renames = [];
    for (const f of fields) {
      if (headers.includes(f.name)) okHeaders[f.name] = f;
      else if (headers.includes(f.label)) {
        okHeaders[f.label] = f;
        renames.push({ from: f.label, to: f.name });
      } else if (f.required && !f.primary_key)
        return { error: `Required field missing: ${f.label}` };
    }
    const fieldNames = headers.map((hnm) => {
      if (okHeaders[hnm]) return okHeaders[hnm].name;
    });
    // also id
    if (headers.includes(`id`)) okHeaders.id = { type: "Integer" };
    const colRe = new RegExp(`(${Object.keys(okHeaders).join("|")})`);

    let i = 1;
    let rejects = 0;
    const client = db.isSQLite ? db : await db.getClient();

    const stats = await fs.promises.stat(filePath)
    const fileSizeInMegabytes = stats.size / (1024*1024);
    
    await client.query("BEGIN");

    const readStream = fs.createReadStream(filePath);

    try {
      if (db.copyFrom && fileSizeInMegabytes>1) {
        let theError;

        const copyres = await db
          .copyFrom(readStream, this.name, fieldNames, client)
          .catch((cate) => {
            theError = cate;
          });
        if (theError || (copyres && copyres.error)) {
          theError = theError || copyres.error;
          return {
            error: `Error processing CSV file: ${
              !theError
                ? theError
                : theError.error || theError.message || theError
            }`,
          };
        }
      } else {
        await new Promise((resolve, reject) => {
          csvtojson({
            includeColumns: colRe,
          })
            .fromStream(readStream)
            .subscribe(
              async (rec) => {
                i += 1;
                if (skip_first_data_row && i === 2) return;
                try {
                  renames.forEach(({ from, to }) => {
                    rec[to] = rec[from];
                    delete rec[from];
                  });
                  const rowOk = readStateStrict(rec, fields);
                  if (rowOk)
                    await db.insert(this.name, rec, {
                      noid: true,
                      client,
                      pk_name,
                    });
                  else rejects += 1;
                } catch (e) {
                  await client.query("ROLLBACK");

                  if (!db.isSQLite) await client.release(true);
                  reject({ error: `${e.message} in row ${i}` });
                }
              },
              (err) => {
                reject({ error: !err ? err : err.message || err });
              },
              () => {
                resolve();
              }
            );
        });
        readStream.destroy();
      }
    } catch (e) {
      return {
        error: `Error processing CSV file: ${
          !e ? e : e.error || e.message || e
        }`,
      };
    }

    await client.query("COMMIT");

    if (!db.isSQLite) await client.release(true);
    const pk = fields.find((f) => f.primary_key);
    if (db.reset_sequence && pk.type.name === "Integer")
      await db.reset_sequence(this.name);

    if (recalc_stored && this.fields.some((f) => f.calculated && f.stored)) {
      await recalculate_for_stored(this);
    }
    return {
      success:
        `Imported ${i > 1 ? i - 1 - rejects : ""} rows into table ${
          this.name
        }` + (rejects ? `. Rejected ${rejects} rows.` : ""),
    };
  }

  /**
   * Import JSON table description
   * @param filePath
   * @param skip_first_data_row
   * @returns {Promise<{error: string}|{success: string}>}
   */
  async import_json_file(filePath, skip_first_data_row) {
    // todo argument type buffer is not assignable for type String...
    const file_rows = JSON.parse(await fs.promises.readFile(filePath));
    const fields = await this.getFields();
    const pk_name = this.pk_name;
    const { readState } = require("../plugin-helper");

    let i = 1;
    const client = db.isSQLite ? db : await db.getClient();
    await client.query("BEGIN");
    for (const rec of file_rows) {
      i += 1;
      if (skip_first_data_row && i === 2) continue;
      fields
        .filter((f) => f.calculated && !f.stored)
        .forEach((f) => {
          if (typeof rec[f.name] !== "undefined") {
            delete rec[f.name];
          }
        });
      try {
        readState(rec, fields);
        await db.insert(this.name, rec, { noid: true, client, pk_name });
      } catch (e) {
        await client.query("ROLLBACK");

        if (!db.isSQLite) await client.release(true);
        return { error: `${e.message} in row ${i}` };
      }
    }
    await client.query("COMMIT");
    if (!db.isSQLite) await client.release(true);
    const pk = fields.find((f) => f.primary_key);
    if (db.reset_sequence && pk.type.name === "Integer")
      await db.reset_sequence(this.name);

    return {
      success: `Imported ${file_rows.length} rows into table ${this.name}`,
    };
  }

  /**
   * Get parent relations for table
   * @param allow_double
   * @returns {Promise<{parent_relations: *[], parent_field_list: *[]}>}
   */
  async get_parent_relations(allow_double) {
    const fields = await this.getFields();
    let parent_relations = [];
    let parent_field_list = [];
    for (const f of fields) {
      if (f.is_fkey && f.type !== "File") {
        const table = await Table.findOne({ name: f.reftable_name });
        await table.getFields();
        for (const pf of table.fields.filter(
          (f) => !f.calculated || f.stored
        )) {
          parent_field_list.push(`${f.name}.${pf.name}`);
          if (pf.is_fkey && pf.type !== "File" && allow_double) {
            const table1 = await Table.findOne({ name: pf.reftable_name });
            await table1.getFields();
            for (const gpf of table1.fields.filter(
              (f) => !f.calculated || f.stored
            )) {
              parent_field_list.push(`${f.name}.${pf.name}.${gpf.name}`);
            }
            parent_relations.push({ key_field: pf, through: f, table: table1 });
          }
        }
        parent_relations.push({ key_field: f, table });
      }
    }
    return { parent_relations, parent_field_list };
  }

  /**
   * Get child relations for table
   * @returns {Promise<{child_relations: *[], child_field_list: *[]}>}
   */
  async get_child_relations() {
    const cfields = await Field.find({ reftable_name: this.name });
    let child_relations = [];
    let child_field_list = [];
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

  /**
   *
   * @param opts
   * @returns {Promise<{values, sql: string}>}
   */
  async getJoinedQuery(opts = {}) {
    const fields = await this.getFields();
    let fldNms = [];
    let joinq = "";
    let joinTables = [];
    let joinFields = opts.joinFields || [];
    const schema = db.getTenantSchemaPrefix();

    fields
      .filter((f) => f.type === "File")
      .forEach((f) => {
        joinFields[`${f.name}__filename`] = {
          ref: f.name,
          reftable: "_sc_files",
          target: `filename`,
        };
      });
    for (const [fldnm, { ref, target, through }] of Object.entries(
      joinFields
    )) {
      const reffield = fields.find((f) => f.name === ref);
      if (!reffield)
        throw new InvalidConfiguration(`Key field ${ref} not found in table ${this.name}`);
      const reftable = reffield.reftable_name;
      const jtNm = `${sqlsanitize(reftable)}_jt_${sqlsanitize(ref)}`;
      if (!joinTables.includes(jtNm)) {
        joinTables.push(jtNm);
        joinq += ` left join ${schema}"${sqlsanitize(
          reftable
        )}" ${jtNm} on ${jtNm}."${reffield.refname}"=a."${sqlsanitize(ref)}"`;
      }
      if (through) {
        const throughTable = await Table.findOne({
          name: reffield.reftable_name,
        });
        const throughTableFields = await throughTable.getFields();
        const throughRefField = throughTableFields.find(
          (f) => f.name === through
        );
        const finalTable = throughRefField.reftable_name;
        const jtNm1 = `${sqlsanitize(reftable)}_jt_${sqlsanitize(
          through
        )}_jt_${sqlsanitize(ref)}`;
        if (!joinTables.includes(jtNm1)) {
          joinTables.push(jtNm1);
          joinq += ` left join ${schema}"${sqlsanitize(
            finalTable
          )}" ${jtNm1} on ${jtNm1}.id=${jtNm}."${sqlsanitize(through)}"`;
        }
        fldNms.push(`${jtNm1}.${sqlsanitize(target)} as ${sqlsanitize(fldnm)}`);
      } else {
        fldNms.push(`${jtNm}.${sqlsanitize(target)} as ${sqlsanitize(fldnm)}`);
      }
    }
    for (const f of fields.filter((f) => !f.calculated || f.stored)) {
      fldNms.push(`a."${sqlsanitize(f.name)}"`);
    }
    Object.entries(opts.aggregations || {}).forEach(
      ([fldnm, { table, ref, field, where, aggregate, subselect }]) => {
        if (aggregate.startsWith("Latest ")) {
          const dateField = aggregate.replace("Latest ", "");
          fldNms.push(
            `(select "${sqlsanitize(field)}" from ${schema}"${sqlsanitize(
              table
            )}" where ${dateField}=(select max(${dateField}) from ${schema}"${sqlsanitize(
              table
            )}" where "${sqlsanitize(ref)}"=a.id${
              where ? ` and ${where}` : ""
            }) and "${sqlsanitize(ref)}"=a.id) ${sqlsanitize(fldnm)}`
          );
        } else if (subselect)
          fldNms.push(
            `(select ${sqlsanitize(aggregate)}(${
              field ? `"${sqlsanitize(field)}"` : "*"
            }) from ${schema}"${sqlsanitize(table)}" where ${sqlsanitize(
              ref
            )} in (select "${subselect.field}" from ${schema}"${
              subselect.table.name
            }" where "${subselect.whereField}"=a.id)) ${sqlsanitize(fldnm)}`
          );
        else
          fldNms.push(
            `(select ${sqlsanitize(aggregate)}(${
              field ? `"${sqlsanitize(field)}"` : "*"
            }) from ${schema}"${sqlsanitize(table)}" where "${sqlsanitize(
              ref
            )}"=a.id${where ? ` and ${where}` : ""}) ${sqlsanitize(fldnm)}`
          );
      }
    );

    let whereObj = {};
    if (opts.where) {
      Object.keys(opts.where).forEach((k) => {
        if (k === "_fts") whereObj[k] = { table: "a", ...opts.where[k] };
        else whereObj[`a."${k}"`] = opts.where[k];
      });
    }
    const { where, values } = mkWhere(whereObj, db.isSQLite);
    const selectopts = {
      limit: opts.limit,
      orderBy:
        opts.orderBy &&
        (opts.orderBy.distance ? opts.orderBy : "a." + opts.orderBy),
      orderDesc: opts.orderDesc,
      offset: opts.offset,
    };

    const sql = `SELECT ${fldNms.join()} FROM ${schema}"${sqlsanitize(
      this.name
    )}" a ${joinq} ${where}  ${mkSelectOptions(selectopts)}`;
    return { sql, values };
  }
  async getJoinedRows(opts = {}) {
    const fields = await this.getFields();

    const { sql, values } = await this.getJoinedQuery(opts);
    const res = await db.query(sql, values);

    return apply_calculated_fields(res.rows, fields);
  }
}

/**
 * Table contract
 * @type {{variables: {name: ((function(*=): *)|*)}, methods: {updateRow: ((function(*=): *)|*), get_history: ((function(*=): *)|*), tryUpdateRow: ((function(*=): *)|*), deleteRows: ((function(*=): *)|*), update: ((function(*=): *)|*), getRows: ((function(*=): *)|*), getRow: ((function(*=): *)|*), delete: ((function(*=): *)|*), get_parent_relations: ((function(*=): *)|*), get_child_relations: ((function(*=): *)|*), tryInsertRow: ((function(*=): *)|*), getFields: ((function(*=): *)|*), insertRow: ((function(*=): *)|*), toggleBool: ((function(*=): *)|*), getJoinedRows: ((function(*=): *)|*), countRows: ((function(*=): *)|*), distinctValues: ((function(*=): *)|*), sql_name: ((function(*=): *)|*), import_csv_file: ((function(*=): *)|*)}, static_methods: {find: ((function(*=): *)|*), create_from_csv: ((function(*=): *)|*), findOne: ((function(*=): *)|*), find_with_external: ((function(*=): *)|*), create: ((function(*=): *)|*)}, constructs: {name: ((function(*=): *)|*)}}}
 */
Table.contract = {
  constructs: { name: is.str },
  variables: { name: is.str },
  methods: {
    delete: is.fun([], is.promise(is.eq(undefined))),
    update: is.fun(is.obj(), is.promise(is.eq(undefined))),
    deleteRows: is.fun(is.obj(), is.promise(is.eq(undefined))),
    getRow: is.fun(is.obj(), is.promise(is.maybe(is.obj()))),
    getRows: is.fun(is.maybe(is.obj()), is.promise(is.array(is.obj()))),
    countRows: is.fun(is.maybe(is.obj()), is.promise(is.posint)),
    updateRow: is.fun([is.obj(), is.any], is.promise(is.eq(undefined))),
    toggleBool: is.fun([is.any, is.str], is.promise(is.eq(undefined))),
    insertRow: is.fun(is.obj(), is.promise(is.any)),
    get_history: is.fun(is.posint, is.promise(is.array(is.obj()))),
    distinctValues: is.fun(is.str, is.promise(is.array(is.any))),
    tryInsertRow: is.fun(
      [is.obj(), is.maybe(is.posint)],
      is.promise(is.or(is.obj({ error: is.str }), is.obj({ success: is.any })))
    ),
    tryUpdateRow: is.fun(
      [is.obj(), is.any, is.maybe(is.posint)],
      is.promise(
        is.or(is.obj({ error: is.str }), is.obj({ success: is.eq(true) }))
      )
    ),
    sql_name: is.getter(is.str),
    getFields: is.fun([], is.promise(is.array(is.class("Field")))),
    get_parent_relations: is.fun(
      [],
      is.promise(
        is.obj({
          parent_relations: is.array(
            is.obj({
              key_field: is.class("Field"),
              table: is.class("Table"),
            })
          ),
          parent_field_list: is.array(is.str),
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
              table: is.class("Table"),
            })
          ),
          child_field_list: is.array(is.str),
        })
      )
    ),
    import_csv_file: is.fun(
      is.str,
      is.promise(is.or(is.obj({ success: is.str }), is.obj({ error: is.str })))
    ),
    getJoinedRows: is.fun(
      is.maybe(is_table_query),
      is.promise(is.array(is.obj({})))
    ),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("Table")))
    ),
    find_with_external: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(
        is.array(is.or(is.class("Table"), is.obj({ external: is.eq(true) })))
      )
    ),
    findOne: is.fun(
      is.or(is.obj(), is.str, is.posint),
      is.promise(
        is.maybe(is.or(is.class("Table"), is.obj({ external: is.eq(true) })))
      )
    ),
    create: is.fun(is.str, is.promise(is.class("Table"))),
    create_from_csv: is.fun(
      [is.str, is.str],
      is.promise(
        is.or(
          is.obj({ success: is.str, table: is.class("Table") }),
          is.obj({ error: is.str })
        )
      )
    ),
    //update: is.fun([is.posint, is.obj({})], is.promise(is.eq(undefined)))
  },
};
module.exports = Table;
