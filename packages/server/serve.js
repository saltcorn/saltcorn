/**
 * Serve is Saltcorn server starter
 *
 * @category server
 * @module serve
 */
const runScheduler = require("@saltcorn/data/models/scheduler");
const User = require("@saltcorn/data/models/user");
const Plugin = require("@saltcorn/data/models/plugin");
const db = require("@saltcorn/data/db");
const {
  getState,
  init_multi_tenant,
  restart_tenant,
  add_tenant,
} = require("@saltcorn/data/db/state");
const { create_tenant } = require("@saltcorn/admin-models/models/tenant");

const path = require("path");

const getApp = require("./app");
const Trigger = require("@saltcorn/data/models/trigger");
const cluster = require("cluster");
const {
  loadAllPlugins,
  loadAndSaveNewPlugin,
  loadPlugin,
} = require("./load_plugins");
const { getConfig } = require("@saltcorn/data/models/config");
const { migrate } = require("@saltcorn/data/migrate");
const socketio = require("socket.io");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const {
  setTenant,
  getSessionStore,
  get_tenant_from_req,
} = require("./routes/utils");
const passport = require("passport");
const { authenticate } = require("passport");
const View = require("@saltcorn/data/models/view");
const {
  listenForChanges,
  getRelevantPackages,
  getPluginDirectories,
} = require("./restart_watcher");
const {
  eachTenant,
  getAllTenants,
} = require("@saltcorn/admin-models/models/tenant");
const { auto_backup_now } = require("@saltcorn/admin-models/models/backup");
const Snapshot = require("@saltcorn/admin-models/models/snapshot");

const take_snapshot = async () => {
  return await Snapshot.take_if_changed();
};

// helpful https://gist.github.com/jpoehls/2232358
/**
 * @param {object} opts
 * @param {boolean} opts.disableMigrate
 * @param {boolean} [useClusterAdaptor = true]
 */
const initMaster = async ({ disableMigrate }, useClusterAdaptor = true) => {
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
    const tenants = await getAllTenants();
    await init_multi_tenant(loadAllPlugins, disableMigrate, tenants);
  }
  if (useClusterAdaptor) setupPrimary();
};

/**
 * @param {object} opts
 * @param {object} opts.tenant
 * @param {...*} opts.msg
 * @returns {void}
 */
const workerDispatchMsg = ({ tenant, ...msg }) => {
  if (tenant) {
    db.runWithTenant(tenant, () => workerDispatchMsg(msg));
    return;
  }

  if (msg.refresh_plugin_cfg) {
    Plugin.findOne({ name: msg.refresh_plugin_cfg }).then((plugin) => {
      if (plugin) loadPlugin(plugin);
    });
  }
  if (!getState()) {
    console.error("no State for tenant", tenant);
    return;
  }
  if (msg.refresh) getState()[`refresh_${msg.refresh}`](true);
  if (msg.createTenant) {
    const tenant_template = getState().getConfig("tenant_template");
    add_tenant(msg.createTenant);
    create_tenant({
      t: msg.createTenant,
      plugin_loader: loadAllPlugins,
      noSignalOrDB: true,
      tenant_template,
    });
    db.runWithTenant(msg.createTenant, async () => {
      getState().refresh(true);
    });
  }
  if (msg.installPlugin) {
    loadAndSaveNewPlugin(msg.installPlugin, msg.force, true);
  }
  if (msg.restart_tenant) restart_tenant(loadAllPlugins);
  if (msg.removePlugin) getState().remove_plugin(msg.removePlugin, true);
};

/**
 *
 * @param {*} masterState
 * @param {object} opts
 * @param {string} opts.port
 * @param {boolean} opts.watchReaper
 * @param {boolean} opts.disableScheduler
 * @param {number} opts.pid
 * @returns {function}
 */
const onMessageFromWorker =
  (masterState, { port, watchReaper, disableScheduler, pid }) =>
  (msg) => {
    //console.log("worker msg", typeof msg, msg);
    if (msg === "Start" && !masterState.started) {
      masterState.started = true;
      runScheduler({
        port,
        watchReaper,
        disableScheduler,
        eachTenant,
        auto_backup_now,
        take_snapshot,
      });
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
      workerDispatchMsg(msg); //also master
      return true;
    }
  };

module.exports =
  /**
   * @function
   * @name "module.exports function"
   * @param {object} [opts = {}]
   * @param {number} [opts.port = 3000]
   * @param {boolean} opts.watchReaper
   * @param {boolean} opts.disableScheduler
   * @param {number} opts.defaultNCPUs
   * @param {boolean} opts.dev
   * @param {...*} opts.appargs
   * @returns {Promise<void>}
   */
  async ({
    port = 3000,
    watchReaper,
    disableScheduler,
    defaultNCPUs,
    dev,
    ...appargs
  } = {}) => {
    if (dev && cluster.isMaster) {
      listenForChanges(getRelevantPackages(), await getPluginDirectories());
    }
    const useNCpus = process.env.SALTCORN_NWORKERS
      ? +process.env.SALTCORN_NWORKERS
      : defaultNCPUs;

    const letsEncrypt = await getConfig("letsencrypt", false);
    const masterState = {
      started: false,
      listeningTo: new Set([]),
    };

    const addWorker = (worker) => {
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
        const initMasterListeners = () => {
          Object.entries(cluster.workers).forEach(([id, w]) => {
            if (!masterState.listeningTo.has(id)) {
              addWorker(w);
              masterState.listeningTo.add(id);
            }
          });
          if (masterState.listeningTo.size < useNCpus)
            setTimeout(initMasterListeners, 250);
        };
        require("greenlock-express")
          .init({
            packageRoot: __dirname,
            configDir: path.join(file_store, "greenlock.d"),
            maintainerEmail: admin_users[0].email,
            cluster: true,
            workers: useNCpus,
          })
          .ready((glx) => {
            const httpsServer = glx.httpsServer();
            setupSocket(httpsServer);
            httpsServer.setTimeout(timeout * 1000);
            process.on("message", workerDispatchMsg);
            glx.serveApp(app);
            process.send && process.send("Start");
          })
          .master(() => {
            initMaster(appargs).then(initMasterListeners);
          });

        return; // none of stuff below will execute
      }
    }
    // No greenlock!

    if (cluster.isMaster) {
      const forkAnyWorkers = useNCpus > 1 && process.platform !== "win32";
      await initMaster(appargs, forkAnyWorkers);

      if (forkAnyWorkers) {
        for (let i = 0; i < useNCpus; i++) addWorker(cluster.fork());

        cluster.on("exit", (worker, code, signal) => {
          console.log(`worker ${worker.process.pid} died`);
          addWorker(cluster.fork());
        });
      } else {
        await nonGreenlockWorkerSetup(appargs, port);
        runScheduler({
          port,
          watchReaper,
          disableScheduler,
          eachTenant,
          auto_backup_now,
          take_snapshot,
        });
      }
      Trigger.emitEvent("Startup");
    } else {
      await nonGreenlockWorkerSetup(appargs, port);
    }
  };

/**
 * @param {*} appargs
 * @param {*} port
 * @returns {Promise<void>}
 */
const nonGreenlockWorkerSetup = async (appargs, port) => {
  process.send && process.on("message", workerDispatchMsg);

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
    setupSocket(httpServer, httpsServer);
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
    setupSocket(httpServer);

    // todo timeout to config
    // todo refer in doc to httpserver doc
    // todo there can be added other parameters for httpserver
    httpServer.setTimeout(timeout * 1000);
    httpServer.listen(port, () => {
      console.log(`Saltcorn listening on http://localhost:${port}/`);
    });
  }
  process.send && process.send("Start");
};

/**
 *
 * @param  {...*} servers
 */
const setupSocket = (...servers) => {
  // https://socket.io/docs/v4/middlewares/
  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);

  const io = new socketio.Server({ transports: ["websocket"] });
  for (const server of servers) {
    io.attach(server);
  }

  //io.use(wrap(setTenant));
  io.use(wrap(getSessionStore()));
  io.use(wrap(passport.initialize()));
  io.use(wrap(passport.authenticate(["jwt", "session"])));
  if (process.send && !cluster.isMaster) io.adapter(createAdapter());
  getState().setRoomEmitter((tenant, viewname, room_id, msg) => {
    io.to(`${tenant}_${viewname}_${room_id}`).emit("message", msg);
  });
  io.on("connection", (socket) => {
    socket.on("join_room", ([viewname, room_id]) => {
      const ten = get_tenant_from_req(socket.request) || "public";
      const f = () => {
        try {
          const view = View.findOne({ name: viewname });
          if (view.viewtemplateObj.authorize_join) {
            view.viewtemplateObj
              .authorize_join(view, room_id, socket.request.user)
              .then((authorized) => {
                if (authorized) socket.join(`${ten}_${viewname}_${room_id}`);
              });
          } else socket.join(`${ten}_${viewname}_${room_id}`);
        } catch (err) {
          getState().log(1, `Socket join_room error: ${err.stack}`);
        }
      };
      if (ten && ten !== "public") db.runWithTenant(ten, f);
      else f();
    });
  });
};
