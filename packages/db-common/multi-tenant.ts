/**
 * This is the multi tenant module
 * @module
 */
import { sqlsanitize } from "./internal";
import { AsyncLocalStorage } from "async_hooks";

const is_multi_tenant = true;
let connObj: any = null;

type RequestContext = {
  tenant: string;
  client?: any;
  req?: any;
};

export const tenantNamespace: AsyncLocalStorage<RequestContext> =
  new AsyncLocalStorage();

/**
 * set the connection object of the multi-tenant
 * @param connObjPara
 */
export const init = (connObjPara: any): void => {
  connObj = connObjPara;
};

/**
 * Returns true if platform runs multi tenant mode
 * @returns {boolean}
 */
export const is_it_multi_tenant = (): boolean => is_multi_tenant;

/**
 * @returns {void}
 */
export const enable_multi_tenant = (): void => {};

/**
 * Run function with tenant
 * @param {object} tenant
 * @param {function} f
 * @returns {object}
 */
export const runWithTenant = <Type>(
  tenantOrMore: string | RequestContext,
  f: () => Promise<Type>
): Promise<Type> => {
  const tenant0 =
    typeof tenantOrMore === "string" ? tenantOrMore : tenantOrMore?.tenant;
  const tenant = sqlsanitize(tenant0).toLowerCase();
  const client = typeof tenantOrMore === "string" ? null : tenantOrMore.client;
  const req = typeof tenantOrMore === "string" ? null : tenantOrMore.req;
  return tenantNamespace.run({ tenant, client, req }, f);
};
/**
 * Get tenant schema name
 */
export const getTenantSchema = (): string => {
  if (!connObj) throw new Error("The connection object is not initialized");
  const storeVal = tenantNamespace.getStore();
  return storeVal?.tenant || connObj.default_schema;
};

export const getRequestContext = (): RequestContext | undefined => {
  if (!connObj) throw new Error("The connection object is not initialized");
  const storeVal = tenantNamespace.getStore();
  return storeVal;
};
