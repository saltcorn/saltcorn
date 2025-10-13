/**
 * Serve is Saltcorn server starter
 *
 * @category server
 * @module serve
 */
const { runScheduler } = require("@saltcorn/data/models/scheduler");
const User = require("@saltcorn/data/models/user");
const Plugin = require("@saltcorn/data/models/plugin");
const db = require("@saltcorn/data/db");
const { getConfigFile, configFilePath } = require("@saltcorn/data/db/connect");
const {
  getState,
  init_multi_tenant,
  restart_tenant,
  add_tenant,
  get_other_domain_tenant,
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
const { getConfig, setConfig } = require("@saltcorn/data/models/config");
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
const { writeFileSync, rmdirSync, readFileSync } = require("fs");
const { pathExistsSync } = require("fs-extra");
const envPaths = require("env-paths");

const take_snapshot = async () => {
  return await Snapshot.take_if_changed();
};

/**
 * Ensure the cfg file has a jwt_secret
 */
const ensureJwtSecret = () => {
  const cfg = getConfigFile();
  if (cfg && !cfg.jwt_secret) {
    try {
      const newSecret = require("crypto").randomBytes(64).toString("hex");
      cfg.jwt_secret = newSecret;
      writeFileSync(configFilePath, JSON.stringify(cfg, null, 2));
      db.connectObj.jwt_secret = newSecret;
    } catch (error) {
      console.log(
        `Unable to set a jwt_secret: ${
          error.message ? error.message : "Unknown error"
        }`
      );
    }
  }
};

/**
 * validate all plugins folders and remove invalid entries
 * A folder is invalid when it has dependencies but not node_modules directory
 */
const ensurePluginsFolder = async () => {
  const rootFolder = envPaths("saltcorn", { suffix: "plugins" }).data;
  const staticDeps = [
    "@saltcorn/markup",
    "@saltcorn/data",
    "@saltcorn/postgres",
    "jest",
  ];
  const allPluginFolders = new Set();
  await eachTenant(async () => {
    try {
      const allPlugins = (await Plugin.find()).filter(
        (p) => !["base", "sbadmin2"].includes(p.name)
      );
      for (const plugin of allPlugins) {
        const tokens =
          plugin.source === "npm"
            ? plugin.location.split("/")
            : plugin.name.split("/");
        const pluginDir = path.join(
          rootFolder,
          plugin.source === "git" ? "git_plugins" : "plugins_folder",
          ...tokens,
          plugin.version || "unknownversion"
        );
        allPluginFolders.add(pluginDir);
      }
    } catch {
      //ignore
    }
  });
  for (const folder of allPluginFolders) {
    try {
      if (pathExistsSync(folder)) {
        const packageJson = JSON.parse(
          readFileSync(path.join(folder, "package.json"))
        );
        if (
          (Object.keys(packageJson.dependencies || {}).some(
            (d) => !staticDeps.includes(d)
          ) ||
            Object.keys(packageJson.devDependencies || {}).some(
              (d) => !staticDeps.includes(d)
            )) &&
          !pathExistsSync(path.join(folder, "node_modules"))
        )
          rmdirSync(folder, { recursive: true });
      }
    } catch (e) {
      console.log(`Error checking plugin folder: ${e.message || e}`);
    }
  }
};

/**
 * Users with push_notify enabled store subscription in push_notification_subscriptions
 * This function ensures that enabled users at least have an empty array
 * and disabled users have no entry
 */
const ensureNotificationSubscriptions = async () => {
  const allSubs = await getConfig("push_notification_subscriptions", {});
  let changed = false;
  for (const user of await User.find()) {
    const enabled = user._attributes?.notify_push || false;
    if (enabled && !allSubs[user.id]) {
      allSubs[user.id] = [];
      changed = true;
    } else if (!enabled && allSubs[user.id]) {
      delete allSubs[user.id];
      changed = true;
    }
  }
  if (changed) {
    await setConfig("push_notification_subscriptions", { ...allSubs });
  }
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
  if (!disableMigrate)
    await db.runWithTenant(
      db.connectObj.default_schema,
      async () => await migrate(db.connectObj.default_schema, true)
    );
  // load all plugins
  await loadAllPlugins(true);
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
  if (msg.refresh) {
    if (msg.refresh === "ephemeral_config")
      getState().refresh_ephemeral_config(msg.key, msg.value);
    else getState()[`refresh_${msg.refresh}`](true);
  }
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
 * @param {string} opts.host
 * @param {boolean} opts.watchReaper
 * @param {boolean} opts.disableScheduler
 * @param {number} opts.pid
 * @returns {function}
 */
const onMessageFromWorker =
  (masterState, { port, host, watchReaper, disableScheduler, pid }) =>
  (msg) => {
    //console.log("worker msg", typeof msg, msg);
    if (msg === "Start" && !masterState.started) {
      masterState.started = true;
      runScheduler({
        port,
        host,
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
        //if it is plugin refresh, we need sender to get it as wll
        if (wpid !== pid || msg?.refresh_plugin_cfg) w.send(msg);
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
   * @param {host} [opts.host]
   * @param {boolean} opts.watchReaper
   * @param {boolean} opts.disableScheduler
   * @param {number} opts.defaultNCPUs
   * @param {boolean} opts.dev
   * @param {...*} opts.appargs
   * @returns {Promise<void>}
   */
  async ({
    port = 3000,
    host,
    watchReaper,
    disableScheduler,
    defaultNCPUs,
    dev,
    ...appargs
  } = {}) => {
    if (cluster.isMaster) {
      ensureJwtSecret();
      await ensurePluginsFolder();
      await ensureNotificationSubscriptions();
    }
    process.on("unhandledRejection", (reason, p) => {
      console.error(reason, "Unhandled Rejection at Promise");
    });

    if (dev && cluster.isMaster) {
      listenForChanges(getRelevantPackages(), await getPluginDirectories());
    }
    const useNCpus = process.env.SALTCORN_NWORKERS
      ? +process.env.SALTCORN_NWORKERS
      : defaultNCPUs;

    const letsEncrypt = await getConfig("letsencrypt", false);
    const pruneSessionInterval = +(await getConfig(
      "prune_session_interval",
      900
    ));
    const masterState = {
      started: false,
      listeningTo: new Set([]),
    };

    const addWorker = (worker) => {
      worker.on(
        "message",
        onMessageFromWorker(masterState, {
          port,
          host,
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
          getState().sendMessageToWorkers = (msg) => {
            Object.entries(cluster.workers).forEach(([wpid, w]) => {
              w.send(msg);
            });
            workerDispatchMsg(msg); //also master
          };

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
            setupSocket(
              appargs?.subdomainOffset,
              pruneSessionInterval,
              httpsServer
            );
            httpsServer.setTimeout(timeout * 1000);
            process.on("message", workerDispatchMsg);
            glx.serveApp(app);
            getState().processSend("Start");
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
        getState().sendMessageToWorkers = (msg) => {
          Object.entries(cluster.workers).forEach(([wpid, w]) => {
            w.send(msg);
          });
          workerDispatchMsg(msg); //also master
        };

        cluster.on("exit", (worker, code, signal) => {
          console.log(`worker ${worker.process.pid} died`);
          addWorker(cluster.fork());
        });
      } else {
        getState().sendMessageToWorkers = (msg) => {
          workerDispatchMsg(msg); //also master
        };
        await nonGreenlockWorkerSetup(appargs, port, host);
        runScheduler({
          port,
          host,
          watchReaper,
          disableScheduler,
          eachTenant,
          auto_backup_now,
          take_snapshot,
        });
        require("./systemd")({ port });
      }
      Trigger.emitEvent("Startup");
    } else {
      await nonGreenlockWorkerSetup(appargs, port, host);
    }
  };

/**
 * @param {*} appargs
 * @param {*} port
 * @returns {Promise<void>}
 */
const nonGreenlockWorkerSetup = async (appargs, port, host) => {
  process.send && process.on("message", workerDispatchMsg);

  const app = await getApp(appargs);

  const cert = getState().getConfig("custom_ssl_certificate", "");
  const key = getState().getConfig("custom_ssl_private_key", "");
  const timeout = +getState().getConfig("timeout", 120);
  const pruneSessionInterval = +(await getState().getConfig(
    "prune_session_interval",
    900
  ));
  // Server with http on port 80 / https on 443
  // todo  resolve hardcode

  const listenArgs = { port };
  if (host) listenArgs.host = host;
  if (port === 80 && cert && key) {
    const https = require("https");
    const http = require("http");
    const httpServer = http.createServer(app);
    const httpsServer = https.createServer({ key, cert }, app);
    // todo timeout to config
    httpServer.setTimeout(timeout * 1000);
    httpsServer.setTimeout(timeout * 1000);
    setupSocket(
      appargs?.subdomainOffset,
      pruneSessionInterval,
      httpServer,
      httpsServer
    );
    httpServer.listen(listenArgs, () => {
      console.log("HTTP Server running on port 80");
    });

    // todo port to config
    const httpsListenArgs = { ...listenArgs, port: 443 };
    httpsServer.listen(httpsListenArgs, () => {
      console.log("HTTPS Server running on port 443");
    });
  } else {
    // server with http only
    const http = require("http");
    const httpServer = http.createServer(app);
    setupSocket(appargs?.subdomainOffset, pruneSessionInterval, httpServer);

    // todo timeout to config
    // todo refer in doc to httpserver doc
    // todo there can be added other parameters for httpserver
    httpServer.setTimeout(timeout * 1000);
    httpServer.listen(listenArgs, () => {
      console.log(
        `Saltcorn listening on http://${host || `localhost`}:${port}/`
      );
    });
  }
  getState().processSend("Start");
};

const tenantFromSocket = (socket, hostPartOffset) => {
  if (!db.is_it_multi_tenant()) return db.connectObj.default_schema;
  const header = socket.request.headers.host;
  const hostOnly = header?.split(":")[0];
  if (hostOnly) {
    const tenant = get_other_domain_tenant(hostOnly);
    if (tenant) return tenant;
  }
  return get_tenant_from_req(socket.request, hostPartOffset);
};

/**
 *
 * @param  {...*} servers
 */
const setupSocket = (subdomainOffset, pruneSessionInterval, ...servers) => {
  // https://socket.io/docs/v4/middlewares/
  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);

  const io = new socketio.Server({ transports: ["websocket"] });
  for (const server of servers) {
    io.attach(server);
  }

  const passportInit = passport.initialize();
  const sessionStore = getSessionStore(pruneSessionInterval);
  const setupNamespace = (namespace) => {
    //io.of(namespace).use(wrap(setTenant));
    io.of(namespace).use(wrap(sessionStore));
    io.of(namespace).use(wrap(passportInit));
    io.of(namespace).use(wrap(passport.authenticate(["jwt", "session"])));
  };
  setupNamespace("/");
  setupNamespace("/datastream");
  if (process.send && !cluster.isMaster) io.adapter(createAdapter());
  getState().setRoomEmitter((tenant, viewname, room_id, msg) => {
    io.of("/").to(`${tenant}_${viewname}_${room_id}`).emit("message", msg);
  });

  getState().setLogEmitter((tenant, level, msg) => {
    const time = new Date().valueOf();
    io.of("/")
      .to(`_logs_${tenant}_`)
      .emit("log_msg", { text: msg, time, level });
  });

  // Real-time collaboration emitter (tied to views)
  getState().setCollabEmitter((tenant, type, data) => {
    io.of("/").to(`_${tenant}_collab_room_`).emit(type, data);
  });

  // dynamic updates emitter (for run_js_actions)
  getState().setDynamicUpdateEmitter((tenant, data, userIds) => {
    if (userIds) {
      for (const userId of userIds) {
        io.of("/")
          .to(`_${tenant}:${userId}_dynamic_update_room`)
          .emit("dynamic_update", data);
      }
    } else {
      io.of("/")
        .to(`_${tenant}_dynamic_update_room`)
        .emit("dynamic_update", data);
    }
  });

  io.of("/").on("connection", (socket) => {
    socket.on("join_room", ([viewname, room_id]) => {
      const ten = tenantFromSocket(socket, subdomainOffset) || "public";
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

    socket.on("join_log_room", async (callback) => {
      const tenant = tenantFromSocket(socket, subdomainOffset) || "public";
      const f = async () => {
        try {
          const user = socket.request.user;
          if (!user || user.role_id !== 1) throw new Error("Not authorized");
          else {
            socket.join(`_logs_${tenant}_`);
            const socketIds = await getState().getConfig(
              "joined_log_socket_ids"
            );
            socketIds.push(socket.id);
            await getState().setConfig("joined_log_socket_ids", [...socketIds]);
            callback({ status: "ok" });
            setTimeout(() => {
              io.of("/")
                .to(`_logs_${tenant}_`)
                .emit("test_conn_msg", { text: "test message" });
            }, 1000);
          }
        } catch (err) {
          getState().log(1, `Socket join_logs stream: ${err.stack}`);
          callback({ status: "error", msg: err.message || "unknown error" });
        }
      };
      if (tenant && tenant !== "public") await db.runWithTenant(tenant, f);
      else await f();
    });

    // or join the room more generally and later register views ??
    socket.on("join_collab_room", async (viewname, callback) => {
      const tenant = tenantFromSocket(socket, subdomainOffset) || "public";
      const f = async () => {
        try {
          const view = View.findOne({ name: viewname });
          if (!view) throw new Error(`View ${viewname} not found`);
          const user = socket.request.user;
          const role_id = user ? user.role_id : 100;
          if (view.min_role < role_id)
            throw new Error("Not authorized to join collaboration room");
          const roomName = `_${tenant}_collab_room_`;
          if (!socket.rooms.has(roomName)) {
            socket.join(`_${tenant}_collab_room_`);
            if (typeof callback === "function") callback({ status: "ok" });
            const socketIds = await getState().getConfig(
              "joined_real_time_socket_ids",
              []
            );
            socketIds.push(socket.id);
            await getState().setConfig("joined_real_time_socket_ids", [
              ...new Set(socketIds),
            ]);
          } else if (typeof callback === "function")
            callback({ status: "already_joined" });
        } catch (err) {
          getState().log(1, `Socket join_collab_room: ${err.stack}`);
          if (typeof callback === "function")
            callback({ status: "error", msg: err.message || "unknown error" });
        }
      };
      if (tenant && tenant !== "public") await db.runWithTenant(tenant, f);
      else await f();
    });

    // join_dynamic_update_room for events emitted from run_js_actions
    socket.on("join_dynamic_update_room", async (callback) => {
      const tenant = tenantFromSocket(socket, subdomainOffset) || "public";
      const f = async () => {
        try {
          const enabled = getState().getConfig("enable_dynamic_updates", true);
          if (!enabled) throw new Error("Dynamic updates are not enabled");
          const user = socket.request.user;
          if (!user) throw new Error("Not authorized");
          socket.join(`_${tenant}_dynamic_update_room`);
          socket.join(`_${tenant}:${user.id}_dynamic_update_room`);
          const socketIds = await getState().getConfig(
            "joined_dynamic_update_socket_ids",
            []
          );
          socketIds.push(socket.id);
          await getState().setConfig("joined_dynamic_update_socket_ids", [
            ...new Set(socketIds),
          ]);
          if (typeof callback === "function") callback({ status: "ok" });
        } catch (err) {
          getState().log(1, `Socket join_dynamic_update_room: ${err.stack}`);
          if (typeof callback === "function")
            callback({ status: "error", msg: err.message || "unknown error" });
        }
      };
      if (tenant && tenant !== "public") await db.runWithTenant(tenant, f);
      else await f();
    });

    socket.on("disconnect", async () => {
      const tenant = tenantFromSocket(socket, subdomainOffset) || "public";
      const f = async () => {
        const state = getState();
        if (state) {
          const socketIds = state.getConfig("joined_log_socket_ids");
          const newSocketIds = socketIds.filter((id) => id !== socket.id);
          await state.setConfig("joined_log_socket_ids", newSocketIds);

          const dynamicSocketIds = state.getConfig(
            "joined_dynamic_update_socket_ids",
            []
          );
          const newDynamicSocketIds = dynamicSocketIds.filter(
            (id) => id !== socket.id
          );
          await state.setConfig(
            "joined_dynamic_update_socket_ids",
            newDynamicSocketIds
          );

          const realTimeSocketIds = state.getConfig(
            "joined_real_time_socket_ids",
            []
          );
          const newRealTimeSocketIds = realTimeSocketIds.filter(
            (id) => id !== socket.id
          );
          await state.setConfig(
            "joined_real_time_socket_ids",
            newRealTimeSocketIds
          );
        } else {
          console.error("No state found in socket disconnect");
          console.error("The current tenantSchema is:", db.getTenantSchema());
          console.error("The current tenant from request is:", tenant);
          console.error("node version:", process.version);
        }
      };
      if (tenant && tenant !== "public") await db.runWithTenant(tenant, f);
      else await f();
    });
  });

  io.of("/datastream").on("connection", (socket) => {
    let dataStream = null;
    let dataTarget = null;
    socket.on(
      "open_data_stream",
      async ([viewName, id, fieldName, fieldView, targetOpts], callback) => {
        const tenant = tenantFromSocket(socket, subdomainOffset) || "public";
        const f = async () => {
          try {
            const user = socket.request.user;
            const view = View.findOne({ name: viewName });
            if (view.viewtemplateObj.authorizeDataStream) {
              const authorized = await view.viewtemplateObj.authorizeDataStream(
                view,
                id,
                fieldName,
                user,
                targetOpts
              );
              if (!authorized) throw new Error("Not authorized");
            }
            const { stream, target } = await view.openDataStream(
              id,
              fieldName,
              fieldView,
              user,
              targetOpts
            );
            dataStream = stream;
            dataTarget = target;
            getState().log(
              5,
              `opened data stram to: ${JSON.stringify(dataTarget)}`
            );
            callback({ status: "ok", target });
          } catch (err) {
            getState().log(
              1,
              `Socket open_data_stream: ${err.message || "unknown error"}`
            );
            callback({ status: "error", msg: err.message || "unknown error" });
          }
        };
        if (tenant && tenant !== "public") await db.runWithTenant(tenant, f);
        else await f();
      }
    );
    socket.on("write_to_stream", async (data, callback) => {
      if (!dataStream) {
        getState().log(1, "Socket write_to_stream: No stream available");
        callback({ status: "error", msg: "No stream available" });
      } else
        dataStream.write(data, (err) => {
          if (err) {
            getState().log(1, "Socket write_to_stream: No stream available");
            callback({ status: "error", msg: err.message || "unknown error" });
          } else callback({ status: "ok" });
        });
    });

    socket.on("close_data_stream", async (callback) => {
      if (!dataStream) {
        getState().log(1, "Socket close_data_stream: No stream available");
        callback({ status: "error", msg: "No stream available" });
      } else {
        dataStream.close((err) => {
          if (err) {
            getState().log(
              1,
              `Socket close_data_stream: ${err.message || "unknown error"}`
            );
            callback({ status: "error", msg: err.message || "unknown error" });
          } else {
            getState().log(
              5,
              `closed data stram of: ${JSON.stringify(dataTarget)}`
            );
            callback({ status: "ok" });
            dataStream = null;
          }
        });
      }
    });

    socket.on("disconnect", async () => {
      const tenant = tenantFromSocket(socket, subdomainOffset) || "public";
      const f = async () => {
        if (dataStream)
          dataStream.close((err) => {
            if (err) {
              getState().log(
                1,
                `Socket disconnect close_data_stream: ${
                  err.message || "unknown error"
                }`
              );
            } else {
              getState().log(
                5,
                `closed data stram of: ${JSON.stringify(dataTarget)}`
              );
              dataStream = null;
            }
          });
      };
      if (tenant && tenant !== "public") await db.runWithTenant(tenant, f);
      else await f();
    });
  });
};
