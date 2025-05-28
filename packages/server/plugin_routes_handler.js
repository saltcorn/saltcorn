const express = require("express");
const { error_catcher } = require("./routes/utils.js");

/**
 */
class PluginRoutesHandler {
  constructor() {
    this.tenantRouters = {};
    this.noCsrfUrls = new Set();
  }

  initTenantRouter(tenant, pluginRoutes) {
    const tenantRouter = express.Router();
    for (const routes of Object.values(pluginRoutes)) {
      for (const route of routes) {
        switch (route.method) {
          case "post":
            tenantRouter.post(route.url, error_catcher(route.callback));
            if (route.noCsrf === true) this.noCsrfUrls.add(route.url);
            break;
          case "get":
          default:
            tenantRouter.get(route.url, error_catcher(route.callback));
            if (route.noCsrf === true) this.noCsrfUrls.add(route.url);
            break;
        }
      }
    }
    this.tenantRouters[tenant] = tenantRouter;
  }
}

module.exports = PluginRoutesHandler;
