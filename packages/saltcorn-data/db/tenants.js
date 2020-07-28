const { AsyncLocalStorage } = require("async_hooks");
const { sqlsanitize } = require("./internal");

var is_multi_tenant = true;
const is_it_multi_tenant = () => is_multi_tenant;

const tenantNamespace= new AsyncLocalStorage();

const enable_multi_tenant = () => {
};

const runWithTenant = (tenant, f) => {
  if (!is_multi_tenant) return f();
  else return tenantNamespace.run(sqlsanitize(tenant).toLowerCase(), f);
};


const getTenantSchema = () => {
  if (!is_multi_tenant) return "public";
  const storeVal = tenantNamespace.getStore();
  return storeVal || "public";
};

module.exports = { getTenantSchema,
    enable_multi_tenant,
    runWithTenant,
    is_it_multi_tenant}