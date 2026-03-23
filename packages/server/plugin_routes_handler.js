const express = require("express");
const passport = require("passport");
const { error_catcher } = require("./routes/utils.js");

const apiTokenMiddleware = (req, res, next) => {
  if (req.user) return next();
  passport.authenticate("api-bearer", { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user || user.role_id === 100) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Stores express routers for tenants with plugin routes.
 */
class PluginRoutesHandler {
  constructor() {
    this.tenantRouters = {};
    this.noCsrfUrls = new Set();
  }

  initTenantRouter(tenant, pluginRoutes) {
    if (
      !pluginRoutes ||
      Object.keys(pluginRoutes).length === 0 ||
      Object.values(pluginRoutes).every((routes) => routes.length === 0)
    ) {
      this.tenantRouters[tenant] = null;
    } else {
      const tenantRouter = express.Router();
      for (const routes of Object.values(pluginRoutes)) {
        for (const route of routes) {
          const middlewares = route.apiToken ? [apiTokenMiddleware] : [];
          switch (route.method) {
            case "post":
              tenantRouter.post(route.url, ...middlewares, error_catcher(route.callback));
              if (route.noCsrf === true) this.noCsrfUrls.add(route.url);
              break;
            case "get":
            default:
              tenantRouter.get(route.url, ...middlewares, error_catcher(route.callback));
              if (route.noCsrf === true) this.noCsrfUrls.add(route.url);
              break;
          }
        }
      }
      this.tenantRouters[tenant] = tenantRouter;
    }
  }
}

module.exports = PluginRoutesHandler;
