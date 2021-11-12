/**
 * Role Database Access Layer
 * @category saltcorn-data
 * @module models/role
 * @subcategory models
 */
const db = require("../db");
const { contract, is } = require("contractis");
/**
 * Role class
 * @category saltcorn-data
 */
class Role {
  /**
   * Role constructor
   * @param {object} o 
   */
  constructor(o) {
    this.id = o.id;
    this.role = o.role;
    contract.class(this);
  }

  /**
   * @param {*} uo 
   * @returns {Role}
   */
  static async create(uo) {
    const u = new Role(uo);

    const ex = await Role.findOne({ id: u.id });
    if (ex) return { error: `Role with this id already exists` };
    await db.insert("_sc_roles", {
      id: u.id,
      role: u.role,
    });
    return u;
  }

  /**
   * @param {*} where 
   * @param {*} selectopts 
   * @returns {Promise<Role[]>}
   */
  static async find(where, selectopts) {
    const us = await db.select("_sc_roles", where, selectopts);
    return us.map((u) => new Role(u));
  }

  /**
   * @param {*} where 
   * @returns {Promise<Role>}
   */
  static async findOne(where) {
    const u = await db.selectMaybeOne("_sc_roles", where);
    return u ? new Role(u) : u;
  }

  /**
   * @returns {Promise<void>}
   */
  async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_roles WHERE id = $1`, [this.id]);
  }

  /**
   * @param {*} row 
   * @returns {Promise<void>}
   */
  async update(row) {
    await db.update("_sc_roles", row, this.id);
  }
}

Role.contract = {
  variables: {
    id: is.posint,
    role: is.str,
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined)),
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("Role")))),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("Role")))),
    create: is.fun(
      is.obj({ id: is.posint, role: is.str }),
      is.promise(is.or(is.obj({ error: is.str }), is.class("Role")))
    ),
  },
};

module.exports = Role;
