/**
 * db index
 * @category saltcorn-data
 * @module db/index
 * @subcategory db
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sc_connect = () => (require("./connect.js") as any).default;
const _sc_reset_schema = () => (require("./reset_schema.js") as any).default;
import _sc__saltcorn_sqlite_mobile_sqlite_capacitor from "@saltcorn/sqlite-mobile/sqlite_capacitor";
import * as _sc__saltcorn_sqlite_sqlite from "@saltcorn/sqlite/sqlite";
import * as _sc__saltcorn_postgres_postgres from "@saltcorn/postgres/postgres";
import * as multiTenant from "@saltcorn/db-common/multi-tenant";

import { sqlsanitize, mkWhere, Where } from "@saltcorn/db-common/internal";

import utils from "../utils.js";
const { isNode } = utils;
import { getConnectObject as getConnectObjectMobile } from "./connect_mobile.js";
const { getConnectObject, is_sqlite } = _sc_connect();

// reset_schema imports db/index, so load it lazily (when reset() is actually
// called) to avoid an ESM require-in-cycle error at module-evaluation time.
const reset = (...args: any[]) => _sc_reset_schema()(...args);

/** @type {any} */
const connectObj = isNode() ? getConnectObject() : getConnectObjectMobile();

/** @type {boolean} */
const isSQLite = is_sqlite(connectObj);

const is_node = isNode();

const initDbModule = (): any => {
  let dbmodule = null;
  if (!isNode()) {
    dbmodule = (_sc__saltcorn_sqlite_mobile_sqlite_capacitor as any);
    dbmodule.setConnectionObject(connectObj);
  } else if (isSQLite) {
    dbmodule = (_sc__saltcorn_sqlite_sqlite as any);
    dbmodule.init(getConnectObject);
  } else {
    dbmodule = (_sc__saltcorn_postgres_postgres as any);
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
