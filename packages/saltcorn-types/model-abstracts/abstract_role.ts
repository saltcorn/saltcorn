/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_role
 * @subcategory model-abstracts
 */

/** A user role, e.g. Admin, Staff, User, Public. */
export interface AbstractRole {
  id: number;
  role: string;
}

/** Configuration shape for creating/updating a role. */
export type RoleCfg = AbstractRole

/** A portable (import/export) representation of a {@link RoleCfg}. */
export type RolePack = {} & RoleCfg;
