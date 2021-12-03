import db = require("../db");

type ConstructorParams = {
  id: number;
  role: any;
};

/*
 * Role class
 * @category saltcorn-data
 */
export default class Role {
  id: number;
  role: Role;

  /**
   * Role constructor
   * @param {object} o
   */
  constructor(o: ConstructorParams) {
    this.id = o.id;
    this.role = o.role;
  }

  /**
   * @param {*} uo
   * @returns {Role}
   */
  public static async create(uo: any) {
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
  public static async find(where: any, selectopts: any) {
    const us = await db.select("_sc_roles", where, selectopts);
    return us.map((u: any) => new Role(u));
  }

  /**
   * @param {*} where
   * @returns {Promise<Role>}
   */
  public static async findOne(where: any) {
    const u = await db.selectMaybeOne("_sc_roles", where);
    return u ? new Role(u) : u;
  }

  /**
   * @returns {Promise<void>}
   */
  public async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_roles WHERE id = $1`, [this.id]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  public async update(row: any) {
    await db.update("_sc_roles", row, this.id);
  }
}
