import * as multiTenant from "@saltcorn/db-common/multi-tenant";
import * as singleTenant from "@saltcorn/db-common/single-tenant";

import { sqlsanitize, mkWhere, Where } from "@saltcorn/db-common/internal";

const { getConnectObject, is_sqlite } = require("./connect");

/** @type {any} */
const connectObj = getConnectObject();

/** @type {boolean} */
const isSQLite = is_sqlite(connectObj);

const initDbModule = (): any => {
  let dbmodule = null;
  if (isSQLite) {
    dbmodule = require("@saltcorn/sqlite/sqlite");
    dbmodule.init(getConnectObject);
  } else {
    dbmodule = require("@saltcorn/postgres/postgres")(getConnectObject);
  }
  if (!dbmodule) throw new Error("No database package found.");
  return dbmodule;
};

const dbModule = initDbModule();

/** @type {db/tenant} */
import tenantsModule = require("@saltcorn/db-common/tenants");
const tenant: typeof multiTenant | typeof singleTenant | null = tenantsModule(
  connectObj
);
if (!tenant) throw new Error("tenant is null");

/**
 * @returns {string}
 */
const getTenantSchemaPrefix = (): string =>
  isSQLite ? "" : `"${tenant.getTenantSchema()}".`;

const dbExports: any = {
  ...tenant,
  sqlsanitize,
  connectObj,
  isSQLite,
  ...dbModule,
  mkWhere: (q: Where) => mkWhere(q, isSQLite),
  getTenantSchemaPrefix,
};
export = dbExports;
