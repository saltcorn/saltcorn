/**
 * Serve is Saltcorn server starter
 *
 */

const runScheduler = require("@saltcorn/data/models/scheduler");
const User = require("@saltcorn/data/models/user");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");

const path = require("path");

const getApp = require("./app");

module.exports = async ({ port = 3000, watchReaper, ...appargs } = {}) => {
  const app = await getApp(appargs);
  // todo add timeout to config
  const timeout = +getState().getConfig("timeout", 120);
  // Server without letsencrypt
  const nonGreenlockServer = () => {
    const cert = getState().getConfig("custom_ssl_certificate", "");
    const key = getState().getConfig("custom_ssl_private_key", "");
    // Server with http on port 80 / https on 443
    // todo  resolve hardcode
    if (port === 80 && cert && key) {
      const https = require("https");
      const http = require("http");
      const httpServer = http.createServer(app);
      const httpsServer = https.createServer({ key, cert }, app);
      // todo timeout to config
      httpServer.setTimeout(timeout * 1000);
      httpsServer.setTimeout(timeout * 1000);
      httpServer.listen(port, () => {
        console.log("HTTP Server running on port 80");
      });

      // todo port to config
      httpsServer.listen(443, () => {
        console.log("HTTPS Server running on port 443");
      });
    } else {
      // server with http only
      const http = require("http");
      const httpServer = http.createServer(app);
      // todo timeout to config
      // todo refer in doc to httpserver doc
      // todo there can be added other parameters for httpserver
      httpServer.setTimeout(timeout * 1000);
      httpServer.listen(port, () => {
        console.log(`Saltcorn listening on http://localhost:${port}/`);
      });
    }
  };
  // server with letsencrypt ssl
  if (port === 80 && getState().getConfig("letsencrypt", false)) {
    const admin_users = await User.find({ role_id: 1 }, { orderBy: "id" });
    const file_store = db.connectObj.file_store;
    const Greenlock = require("greenlock");
    const greenlock = Greenlock.create({
      packageRoot: __dirname,
      configDir: path.join(file_store, "greenlock.d"),
      maintainerEmail: admin_users[0].email,
    });
    const certs = await greenlock._find({});
    console.log("Certificates:", certs);
    if (certs && certs.length > 0)
      require("greenlock-express")
        .init({
          packageRoot: __dirname,
          configDir: path.join(file_store, "greenlock.d"),
          maintainerEmail: admin_users[0].email,
          cluster: false,
        })
        .serve(app, ({ secureServer }) => {
          secureServer.setTimeout(timeout * 1000);
        });
    else nonGreenlockServer();
  } else nonGreenlockServer();
  // todo add disableScheduler to config
  setTimeout(() => runScheduler({ port, watchReaper }), 1000);
  require("./systemd")({ port });
};
