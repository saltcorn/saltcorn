/**
 * Serve is Saltcorn server starter
 *
 */

const runScheduler = require("@saltcorn/data/models/scheduler");
const User = require("@saltcorn/data/models/user");
const db = require("@saltcorn/data/db");
const {
  getState,
  init_multi_tenant,
  create_tenant,
  restart_tenant,
} = require("@saltcorn/data/db/state");

const path = require("path");

const getApp = require("./app");
const Trigger = require("@saltcorn/data/models/trigger");
const cluster = require("cluster");
const { loadAllPlugins, loadAndSaveNewPlugin } = require("./load_plugins");
const { getConfig } = require("@saltcorn/data/models/config");
const { migrate } = require("@saltcorn/data/migrate");

// helpful https://gist.github.com/jpoehls/2232358

const initMaster = async ({ disableMigrate }) => {
  let sql_log;
  try {
    sql_log = await getConfig("log_sql");
  } catch (e) {
    const msg = e.message;
    if (msg && msg.includes("_sc_config"))
      console.error(
        "Database is reachable but not initialised. Please run 'saltcorn reset-schema' or 'saltcorn add-schema'"
      );
    else {
      console.error("Database is not reachable. The error was: ", msg);
      console.error("Connection parameters tried: ");
      console.error(db.connectObj);
    }
    process.exit(1);
  }
  // switch on sql logging
  if (sql_log) db.set_sql_logging(); // dont override cli flag
  // migrate database
  if (!disableMigrate) await migrate(db.connectObj.default_schema, true);
  // load all plugins
  await loadAllPlugins();
  // switch on sql logging - but it was initiated before???
  if (getState().getConfig("log_sql", false)) db.set_sql_logging();
  if (db.is_it_multi_tenant()) {
    await init_multi_tenant(loadAllPlugins, disableMigrate);
  }
};

const workerDispatchMsg = ({ tenant, ...msg }) => {
  if (tenant) {
    db.runWithTenant(tenant, () => workerDispatchMsg(msg));
    return;
  }
  if (msg.refresh) getState()[`refresh_${msg.refresh}`](true);
  if (msg.createTenant)
    create_tenant(msg.createTenant, loadAllPlugins, "", true);
  if (msg.installPlugin) {
    loadAndSaveNewPlugin(msg.installPlugin, msg.force, true);
  }
  if (msg.restart_tenant) restart_tenant(loadAllPlugins);
  if (msg.removePlugin) getState().remove_plugin(msg.removePlugin, true);
};
const onMessageFromWorker = (
  masterState,
  { port, watchReaper, disableScheduler, pid }
) => (msg) => {
  //console.log("worker msg", typeof msg, msg);
  if (msg === "Start" && !masterState.started) {
    masterState.started = true;
    runScheduler({ port, watchReaper, disableScheduler });
    require("./systemd")({ port });
    return true;
  } else if (msg === "RestartServer") {
    process.exit(0);
    return true;
  } else if (msg.tenant || msg.createTenant) {
    ///ie from saltcorn
    //broadcast
    Object.entries(cluster.workers).forEach(([wpid, w]) => {
      if (wpid !== pid) w.send(msg);
    });
    return true;
  }
};
module.exports = async ({
  port = 3000,
  watchReaper,
  disableScheduler,
  defaultNCPUs,
  ...appargs
} = {}) => {
  const useNCpus = process.env.SALTCORN_NWORKERS
    ? +process.env.SALTCORN_NWORKERS
    : defaultNCPUs;

  const letsEncrypt = getConfig("letsencrypt", false);
  const masterState = {
    started: false,
  };

  const addWorker = (worker) => {
    console.log("init worker msg with pid",worker.process.pid);
    worker.on(
      "message",
      onMessageFromWorker(masterState, {
        port,
        watchReaper,
        disableScheduler,
        pid: worker.process.pid,
      })
    );
  };

  if (port === 80 && letsEncrypt) {
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

    if (certs && certs.length > 0) {
      const app = await getApp(appargs);
      const timeout = +getState().getConfig("timeout", 120);
      console.log("Greenlock!");
      require("@saltcorn/greenlock-express")
        .init({
          packageRoot: __dirname,
          configDir: path.join(file_store, "greenlock.d"),
          maintainerEmail: admin_users[0].email,
          cluster: true,
          workers: useNCpus,
        })
        .ready((glx) => {
          glx.serveApp(app, ({ secureServer }) => {
            console.log("Setting http timeout to", timeout);
            secureServer.setTimeout(timeout * 1000);
          }); // todo set timeout
        })
        .master(() => {
          initMaster(appargs).then(() => {
            Object.values(cluster.workers).forEach(addWorker);
          });
        });

      return; // WILL THIS WORK  ???
    }
  }
  // No greenlock!
  console.log("No Greenlock!");

  if (cluster.isMaster) {
    await initMaster(appargs);

    for (let i = 0; i < useNCpus; i++) addWorker(cluster.fork());

    Trigger.emitEvent("Startup");

    cluster.on("exit", (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
      addWorker(cluster.fork());
    });
  } else {
    process.on("message", workerDispatchMsg);

    const app = await getApp(appargs);

    const cert = getState().getConfig("custom_ssl_certificate", "");
    const key = getState().getConfig("custom_ssl_private_key", "");
    const timeout = +getState().getConfig("timeout", 120);

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
      console.log("Setting http timeout to", timeout);

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
      console.log("Setting http timeout to", timeout);
      httpServer.setTimeout(timeout * 1000);
      httpServer.listen(port, () => {
        console.log(`Saltcorn listening on http://localhost:${port}/`);
      });
    }
    process.send("Start");
  }
};
