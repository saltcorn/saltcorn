// @ts-ignore
import * as sqlite from "@saltcorn/sqlite/sqlite";
// @ts-ignore
import * as postgres from "@saltcorn/postgres/postgres";

import * as multiTenant from "@saltcorn/db-common/multi-tenant";
import * as singleTenant from "@saltcorn/db-common/single-tenant";

import { sqlsanitize, mkWhere } from "@saltcorn/db-common/internal";

const { getConnectObject, is_sqlite } = require("./connect");

/** @type {any} */
const connectObj = getConnectObject();

/** @type {boolean} */
const isSQLite = is_sqlite(connectObj)

/**
 * @returns {sqlite|postgres}
 */
const initDbModule = (): typeof sqlite | typeof postgres => {
  let dbmodule: typeof sqlite | typeof postgres | null = null;
  dbmodule = isSQLite ?
    require("@saltcorn/sqlite/sqlite") : require("@saltcorn/postgres/postgres");
  if (!dbmodule) throw new Error("No database package found.");
  dbmodule.init(getConnectObject);
  return dbmodule;
};

/** @type {db/sqlite|db/pg} */
const dbModule = initDbModule();

/** @type {db/tenant} */
import tenantsModule = require("@saltcorn/db-common/tenants");
const tenant: typeof multiTenant | typeof singleTenant | null = 
  tenantsModule(connectObj);
if (!tenant) throw new Error("tenant is null");

/** 
 * @returns {string} 
 */
const getTenantSchemaPrefix = () =>
  isSQLite ? "" : `"${tenant.getTenantSchema()}".`;

const dbExports: any = {
  ...tenant,
  sqlsanitize,
  connectObj,
  isSQLite,
  ...dbModule,
  mkWhere: (q:any) => mkWhere(q, isSQLite),
  getTenantSchemaPrefix,
};
export = dbExports;