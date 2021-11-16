/**
 * @category db-common
 * @module tenants
 */

let tenantExport = null;


module.exports = /**
 * @function
 * @name "module.exports function"
 * @returns {multi-tenant|single-tenant}
 */
(connObj) => {
  if(!tenantExport) {
    tenantExport = connObj.multi_tenant ? 
        require("./multi-tenant")(connObj)
      : require("./single-tenant")(connObj);
  }
  return tenantExport;
}
