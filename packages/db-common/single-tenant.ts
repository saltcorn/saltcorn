/**
 * This is the single tenant module
 * @module
 */
let connObj: any = null;

/**
 * set the connection object of the the single-tenant
 * @param connObjPara
 */
export const init = (connObjPara: any): void => {
  connObj = connObjPara;
};

/**
 * Get tenant schema name
 * @returns {string}
 */
export const getTenantSchema = (): string => {
  if (!connObj) throw new Error("The connection object is not initialized");
  return connObj.default_schema;
};

/**
 * Returns true if platform runs multi tenant mode
 * @returns {false}
 */
export const is_it_multi_tenant = (): boolean => false;

/**
 * @returns {void}
 */
export const enable_multi_tenant = (): void => {};

/**
 * Run function with tenant
 * @param {*} t
 * @param {function} f
 * @returns {*}
 */
export const runWithTenant = <Type>(
  t: string,
  f: () => Promise<Type>
): Promise<Type> => {
  return f();
};
