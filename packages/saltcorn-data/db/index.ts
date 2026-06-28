/**
 * db index
 * @category saltcorn-data
 * @module db/index
 * @subcategory db
 */

import { getConnectObject, is_sqlite } from "./connect.js";
import sqliteCapacitorPkg from "@saltcorn/sqlite-mobile/sqlite_capacitor";
import * as sqlitePkg from "@saltcorn/sqlite/sqlite";
import * as postgresPkg from "@saltcorn/postgres/postgres";
import * as multiTenant from "@saltcorn/db-common/multi-tenant";

import { sqlsanitize, mkWhere, Where } from "@saltcorn/db-common/internal";

import { isNode } from "../utils.js";
import { getConnectObject as getConnectObjectMobile } from "./connect_mobile.js";

// reset_schema is loaded lazily (at call time) rather than statically imported:
// reset_schema -> state -> config (etc.) read db.* at module-evaluation time, so
// a static import here would form a load-time cycle in which db's default export
// is still in its temporal dead zone. Deferring it lets db/index finish first.
const reset = async (...args: any[]): Promise<void> =>
  (await import("./reset_schema.js")).default(...args);


/** @type {any} */
const connectObj = isNode() ? getConnectObject() : getConnectObjectMobile();

/** @type {boolean} */
const isSQLite = is_sqlite(connectObj);

const is_node = isNode();

const initDbModule = (): any => {
  let dbmodule = null;
  if (!isNode()) {
    dbmodule = sqliteCapacitorPkg;
    dbmodule.setConnectionObject(connectObj);
  } else if (isSQLite) {
    dbmodule = sqlitePkg;
    dbmodule.init(getConnectObject);
  } else {
    dbmodule = postgresPkg;
    dbmodule.init(getConnectObject);
  }
  if (!dbmodule) throw new Error("No database package found.");
  return dbmodule;
};

const dbModule = initDbModule();

/** @type {db/tenant} */
import tenantsModule from "@saltcorn/db-common/tenants";
import { DbExportsType } from "@saltcorn/db-common/types";
const tenant: typeof multiTenant | null = tenantsModule(connectObj);
if (!tenant) throw new Error("tenant is null");

/**
 * @returns {string}
 */
const getTenantSchemaPrefix = (): string =>
  isSQLite ? "" : `"${tenant.getTenantSchema()}".`;

const dbExports: DbExportsType = {
  ...tenant,
  sqlsanitize,
  connectObj,
  isSQLite,
  is_node,
  ...dbModule,
  mkWhere: (q: Where) => mkWhere(q, isSQLite),
  getTenantSchemaPrefix,
  reset,
};
export default dbExports;
