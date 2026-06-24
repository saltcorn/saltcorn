import * as multiTenant from "./multi-tenant.js";

let tenantExport: typeof multiTenant | null = null;
/**
 *
 * @param connObj db connection object
 * @returns
 */
export default (connObj: any) => {
  if (!tenantExport) {
    tenantExport = multiTenant;
  }
  if (!tenantExport) throw new Error("unable to initalize a tenant");
  tenantExport.init(connObj);
  return tenantExport;
};
