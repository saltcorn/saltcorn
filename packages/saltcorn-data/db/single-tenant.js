module.exports = {
  getTenantSchema: () => "public",
  is_it_multi_tenant: () => false,
  enable_multi_tenant() {},
  runWithTenant(t, f) {
    return f();
  }
};
