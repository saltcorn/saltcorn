import * as multiTenant from "./multi-tenant";

let tenantExport: typeof multiTenant | null = null;
/**
 *
 * @param connObj db connection object
 * @returns
 */
export = (connObj: any) => {
  if (!tenantExport) {
    tenantExport = require("./multi-tenant");
  }
  if (!tenantExport) throw new Error("unable to initalize a tenant");
  tenantExport.init(connObj);
  return tenantExport;
};
