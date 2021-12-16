import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";

/*
 * Role class
 * @category saltcorn-data
 */
class Role {
  id: number;
  role: Role;

  /**
   * Role constructor
   * @param {object} o
   */
  constructor(o: RoleCfg) {
    this.id = o.id;
    this.role = o.role;
  }

  /**
   * @param {*} uo
   * @returns {Role}
   */
  public static async create(uo: RoleCfg) {
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
  public static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Role[]> {
    const us = await db.select("_sc_roles", where, selectopts);
    return us.map((u: RoleCfg) => new Role(u));
  }

  /**
   * @param {*} where
   * @returns {Promise<Role>}
   */
  public static async findOne(where: Where): Promise<Role> {
    const u: RoleCfg = await db.selectMaybeOne("_sc_roles", where);
    return u ? new Role(u) : u;
  }

  /**
   * @returns {Promise<void>}
   */
  public async delete(): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_roles WHERE id = $1`, [this.id]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  public async update(row: Row): Promise<void> {
    await db.update("_sc_roles", row, this.id);
  }
}

namespace Role {
  export type RoleCfg = {
    id: number;
    role: any;
  };
}
type RoleCfg = Role.RoleCfg;

export = Role;
