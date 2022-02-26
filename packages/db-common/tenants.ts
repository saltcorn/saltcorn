import * as multiTenant from "./multi-tenant";
import * as singleTenant from "./single-tenant";

let tenantExport: typeof multiTenant | typeof singleTenant | null = null;
/**
 *
 * @param connObj db connection object
 * @returns
 */
export = (connObj: any) => {
  if (!tenantExport) {
    tenantExport = connObj.multi_tenant
      ? require("./multi-tenant")
      : require("./single-tenant");
  }
  if (!tenantExport) throw new Error("unable to initalize a tenant");
  tenantExport.init(connObj);
  return tenantExport;
};
