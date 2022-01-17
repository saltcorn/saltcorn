/**
 * @category db-common
 * @module single-tenant
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
 * @returns {string}
 */
export const getTenantSchema = (): string => {
  if (!connObj) throw new Error("The connection object is not initalized");
  return connObj.default_schema;
};

/**
 * @returns {false}
 */
export const is_it_multi_tenant = (): boolean => false;

/**
 * @returns {void}
 */
export const enable_multi_tenant = (): void => {};

/**
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
