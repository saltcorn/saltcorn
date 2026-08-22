module.exports = {
  sc_plugin_api_version: 1,
  plugin_name: "local-test-plugin",
  // fixture route for the cross-tenant session replay regression test
  // (infosec-scan/py-sectest/tenant_auth_test.py) - gated only on req.user,
  // no tenant check of its own, matching how a real plugin author would
  // naturally write this since the framework is expected to own that check.
  // note: plugin_routes_handler.js's error_catcher calls callback
  // positionally as (req, res, next), not the destructured {req, res} the
  // PluginRoute type declares
  routes: [
    {
      url: "/local-test-plugin-secret",
      method: "get",
      callback: (req, res) => {
        if (!req.user || req.user.role_id !== 1) {
          res.status(403).json({ error: "not authorized" });
          return;
        }
        res.json({ secret: "LOCAL_TEST_PLUGIN_SECRET" });
      },
    },
  ],
};
