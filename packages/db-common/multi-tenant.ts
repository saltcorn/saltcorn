/**
 * @category db-common
 * @module multi-tenant
 */

import { sqlsanitize } from "./internal";
import { AsyncLocalStorage } from "async_hooks";

const is_multi_tenant = true;
let connObj: any = null;

export const tenantNamespace = new AsyncLocalStorage();

/**
 * set the connection object of the the multi-tenant
 * @param connObjPara
 */
export const init = (connObjPara: any): void => {
  connObj = connObjPara;
};

/**
 * @returns {boolean}
 */
export const is_it_multi_tenant = (): boolean => is_multi_tenant;

/**
 * @returns {void}
 */
export const enable_multi_tenant = (): void => {};

/**
 * @param {object} tenant
 * @param {function} f
 * @returns {object}
 */
export const runWithTenant = (tenant: string, f: () => any): any => {
  if (!is_multi_tenant) return f();
  else return tenantNamespace.run(sqlsanitize(tenant).toLowerCase(), f);
};

export const getTenantSchema = (): string => {
  if (!connObj) throw new Error("The connection object is not initalized");
  const storeVal = tenantNamespace.getStore();
  return storeVal || connObj.default_schema;
};
