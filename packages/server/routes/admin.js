/**
 * @category server
 * @module routes/admin
 * @subcategory routes
 */
const Router = require("express-promise-router");

const {
  isAdmin,
  error_catcher,
  getGitRevision,
  setTenant,
} = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Plugin = require("@saltcorn/data/models/plugin");
const File = require("@saltcorn/data/models/file");
const { spawn } = require("child_process");
const User = require("@saltcorn/data/models/user");
const path = require("path");
const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
const { post_btn, renderForm } = require("@saltcorn/markup");
const {
  div,
  a,
  hr,
  form,
  input,
  label,
  i,
  h4,
  table,
  tbody,
  td,
  th,
  tr,
  button,
  span,
  p,
  code,
  h5,
  pre,
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const {
  getState,
  restart_tenant,
  getTenant,
  get_other_domain_tenant,
  get_process_init_time,
} = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");
const {
  create_backup,
  restore,
} = require("@saltcorn/admin-models/models/backup");
const {
  runConfigurationCheck,
} = require("@saltcorn/admin-models/models/config-check");
const fs = require("fs");
const load_plugins = require("../load_plugins");
const {
  restore_backup,
  send_admin_page,
  send_files_page,
  config_fields_form,
  save_config_from_form,
  flash_restart_if_required,
} = require("../markup/admin.js");
const packagejson = require("../package.json");
const Form = require("@saltcorn/data/models/form");
const { get_latest_npm_version } = require("@saltcorn/data/models/config");
const { getMailTransport } = require("@saltcorn/data/models/email");
const {
  getBaseDomain,
  hostname_matches_baseurl,
  is_hsts_tld,
} = require("../markup/admin");
const moment = require("moment");
const View = require("@saltcorn/data/models/view");
const { getConfigFile } = require("@saltcorn/data/db/connect");

/**
 * @type {object}
 * @const
 * @namespace routes/adminRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @param {object} req
 * @returns {Promise<Form>}
 */
const site_id_form = (req) =>
  config_fields_form({
    req,
    field_names: [
      "site_name",
      "timezone",
      "site_logo_id",
      "favicon_id",
      "base_url",
      "page_custom_css",
      "page_custom_html",
      "development_mode",
      "log_sql",
      ...(getConfigFile() ? ["multitenancy_enabled"] : []),
    ],
    action: "/admin",
    submitLabel: req.__("Save"),
  });
/**
 * Email settings form definition
 * @param {object} req request
 * @returns {Promise<Form>} form
 */
const email_form = async (req) => {
  const form = await config_fields_form({
    req,
    field_names: [
      "smtp_host",
      "smtp_username",
      "smtp_password",
      "smtp_port",
      "smtp_secure",
      "email_from",
    ],
    action: "/admin/email",
  });
  form.submitButtonClass = "btn-outline-primary";
  form.submitLabel = req.__("Save");
  form.onChange =
    "remove_outline(this);$('#testemail').attr('href','#').removeClass('btn-primary').addClass('btn-outline-primary')";
  return form;
};

/**
 * @name get
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    const form = await site_id_form(req);
    send_admin_page({
      res,
      req,
      active_sub: "Site identity",
      contents: {
        type: "card",
        title: req.__("Site identity settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * @name post
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await site_id_form(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_admin_page({
        res,
        req,
        active_sub: "Site identity",
        contents: {
          type: "card",
          title: req.__("Site identity settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      flash_restart_if_required(form, req);
      await save_config_from_form(form);

      req.flash("success", req.__("Site identity settings updated"));
      res.redirect("/admin");
    }
  })
);

/**
 * @name get/email
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/email",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await email_form(req);
    send_admin_page({
      res,
      req,
      active_sub: "Email",
      contents: {
        type: "card",
        title: req.__("Email settings"),
        contents: [
          renderForm(form, req.csrfToken()),
          a(
            {
              id: "testemail",
              href: "/admin/send-test-email",
              class: "btn btn-primary",
            },
            req.__("Send test email")
          ),
        ],
      },
    });
  })
);

/**
 * @name get/send-test-email
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/send-test-email",
  isAdmin,
  error_catcher(async (req, res) => {
    const from = getState().getConfig("email_from");
    const email = {
      from,
      to: req.user.email,
      subject: req.__("Saltcorn test email"),
      html: req.__("Hello from Saltcorn"),
    };
    try {
      await getMailTransport().sendMail(email);
      req.flash(
        "success",
        req.__("Email sent to %s with no errors", req.user.email)
      );
    } catch (e) {
      req.flash("error", e.message);
    }

    res.redirect("/admin/email");
  })
);

/**
 * @name post/email
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/email",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await email_form(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_admin_page({
        res,
        req,
        active_sub: "Email",
        contents: {
          type: "card",
          title: req.__("Email settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);
      req.flash("success", req.__("Email settings updated"));
      res.redirect("/admin/email");
    }
  })
);

/**
 * @name get/backup
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/backup",
  isAdmin,
  error_catcher(async (req, res) => {
    send_admin_page({
      res,
      req,
      active_sub: "Backup",
      contents: {
        type: "card",
        title: req.__("Backup"),
        contents: table(
          tbody(
            tr(
              td(
                div(
                  post_btn("/admin/backup", req.__("Backup"), req.csrfToken())
                )
              ),
              td(p({ class: "ms-4 pt-2" }, req.__("Download a backup")))
            ),
            tr(td(div({ class: "my-4" }))),
            tr(
              td(
                restore_backup(req.csrfToken(), [
                  i({ class: "fas fa-2x fa-upload" }),
                  "<br/>",
                  req.__("Restore"),
                ])
              ),
              td(p({ class: "ms-4" }, req.__("Restore a backup")))
            )
          )
        ),
      },
    });
  })
);

/**
 * @name get/system
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/system",
  isAdmin,
  error_catcher(async (req, res) => {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    const latest = isRoot && (await get_latest_npm_version("@saltcorn/cli"));
    const is_latest = packagejson.version === latest;
    const git_commit = getGitRevision();
    const can_update =
      !is_latest && !process.env.SALTCORN_DISABLE_UPGRADE && !git_commit;
    const dbversion = await db.getVersion(true);

    send_admin_page({
      res,
      req,
      active_sub: "System",
      contents: {
        breakpoint: "md",
        besides: [
          {
            type: "card",
            title: req.__("System operations"),
            contents: div(
              div(
                post_btn(
                  "/admin/restart",
                  req.__("Restart server"),
                  req.csrfToken(),
                  {
                    ajax: true,
                    reload_delay: 4000,
                    spinner: true,
                  }
                )
              ),
              hr(),

              a(
                {
                  href: "/admin/configuration-check",
                  class: "btn btn-info",
                  onClick: "press_store_button(this)",
                },
                i({ class: "fas fa-stethoscope" }),
                " ",
                req.__("Configuration check")
              ),
              hr(),

              a(
                { href: "/admin/clear-all", class: "btn btn-danger" },
                i({ class: "fas fa-trash-alt" }),
                " ",
                req.__("Clear all"),
                " &raquo;"
              )
            ),
          },
          {
            type: "card",
            title: req.__("About the system"),
            contents: div(
              h4(req.__("About Saltcorn")),
              table(
                tbody(
                  tr(
                    th(req.__("Saltcorn version")),
                    td(
                      packagejson.version +
                        (isRoot && can_update
                          ? post_btn(
                              "/admin/upgrade",
                              req.__("Upgrade"),
                              req.csrfToken(),
                              {
                                btnClass: "btn-primary btn-sm",
                                formClass: "d-inline",
                              }
                            )
                          : isRoot && is_latest
                          ? span(
                              { class: "badge bg-primary ms-2" },
                              req.__("Latest")
                            ) +
                            post_btn(
                              "/admin/check-for-upgrade",
                              req.__("Check for updates"),
                              req.csrfToken(),
                              {
                                btnClass: "btn-primary btn-sm px-1 py-0",
                                formClass: "d-inline",
                              }
                            )
                          : "")
                    )
                  ),
                  git_commit &&
                    tr(
                      th(req.__("git commit")),
                      td(
                        a(
                          {
                            href:
                              "https://github.com/saltcorn/saltcorn/commit/" +
                              git_commit,
                          },
                          git_commit.substring(0, 6)
                        )
                      )
                    ),
                  tr(th(req.__("Node.js version")), td(process.version)),
                  tr(
                    th(req.__("Database")),
                    td(db.isSQLite ? "SQLite " : "PostgreSQL ", dbversion)
                  ),
                  tr(
                    th(req.__("Process uptime")),
                    td(moment(get_process_init_time()).fromNow(true))
                  )
                )
              ),
              p(
                { class: "mt-3" },
                req.__(
                  `Saltcorn is <a href="https://www.gnu.org/philosophy/free-sw.en.html">Free</a> and <a href="https://opensource.org/">Open Source</a> Software, <a href="https://github.com/saltcorn/saltcorn/">released</a> under the <a href="https://github.com/saltcorn/saltcorn/blob/master/LICENSE">MIT license</a>.`
                )
              )
            ),
          },
        ],
      },
    });
  })
);

/**
 * @name post/restart
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/restart",
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() === db.connectObj.default_schema) {
      if (process.send) process.send("RestartServer");
      else process.exit(0);
    } else {
      await restart_tenant(loadAllPlugins);
      process.send &&
        process.send({ restart_tenant: true, tenant: db.getTenantSchema() });
      req.flash("success", req.__("Restart complete"));
      res.redirect("/admin");
    }
  })
);

/**
 * @name post/upgrade
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/upgrade",
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() !== db.connectObj.default_schema) {
      req.flash("error", req.__("Not possible for tenant"));
      res.redirect("/admin");
    } else {
      res.write(req.__("Starting upgrade, please wait...\n"));
      const child = spawn(
        "npm",
        ["install", "-g", "@saltcorn/cli@latest", "--unsafe"],
        {
          stdio: ["ignore", "pipe", process.stderr],
        }
      );
      child.stdout.on("data", (data) => {
        res.write(data);
      });
      child.on("exit", function (code, signal) {
        res.end(
          `Upgrade done (if it was available) with code ${code}.\n\nPress the BACK button in your browser, then RELOAD the page.`
        );
        setTimeout(() => {
          if (process.send) process.send("RestartServer");
          process.exit(0);
        }, 100);
      });
    }
  })
);
router.post(
  "/check-for-upgrade",
  isAdmin,
  error_catcher(async (req, res) => {
    await getState().deleteConfig("latest_npm_version");
    req.flash("success", req.__(`Versions refreshed`));
    res.redirect(`/admin/system`);
  })
);
/**
 * @name post/backup
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/backup",
  isAdmin,
  error_catcher(async (req, res) => {
    const fileName = await create_backup();
    res.type("application/zip");
    res.attachment(fileName);
    var file = fs.createReadStream(fileName);
    file.on("end", function () {
      fs.unlink(fileName, function () {});
    });
    file.pipe(res);
  })
);

/**
 * @name post/restore
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/restore",
  setTenant, // TODO why is this needed?????
  isAdmin,
  error_catcher(async (req, res) => {
    const newPath = File.get_new_path();
    await req.files.file.mv(newPath);
    const err = await restore(newPath, (p) =>
      load_plugins.loadAndSaveNewPlugin(p)
    );
    if (err) req.flash("error", err);
    else req.flash("success", req.__("Successfully restored backup"));
    fs.unlink(newPath, function () {});
    res.redirect(`/admin`);
  })
);

/**
 * @param {object} req
 * @returns {Form}
 */
const clearAllForm = (req) =>
  new Form({
    action: "/admin/clear-all",
    submitLabel: "Delete",
    blurb: req.__(
      "This will delete <strong>EVERYTHING</strong> in the selected categories"
    ),
    fields: [
      {
        type: "Bool",
        label: req.__("Tables"),
        name: "tables",
        default: true,
      },
      {
        type: "Bool",
        label: req.__("Views"),
        name: "views",
        default: true,
      },
      {
        type: "Bool",
        name: "pages",
        label: req.__("Pages"),
        default: true,
      },
      {
        type: "Bool",
        name: "files",
        label: req.__("Files"),
        default: true,
      },
      {
        type: "Bool",
        name: "triggers",
        label: req.__("Triggers"),
        default: true,
      },
      {
        type: "Bool",
        name: "eventlog",
        label: req.__("Event log"),
        default: true,
      },
      {
        type: "Bool",
        name: "library",
        label: req.__("Library"),
        default: true,
      },
      {
        type: "Bool",
        name: "users",
        label: req.__("Users"),
        default: true,
      },
      {
        name: "config",
        type: "Bool",
        label: req.__("Configuration"),
        default: true,
      },
      {
        type: "Bool",
        name: "plugins",
        label: req.__("Plugins"),
        default: true,
      },
    ],
  });

/**
 * @name post/enable-letsencrypt
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/enable-letsencrypt",
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() === db.connectObj.default_schema) {
      const domain = getBaseDomain();
      if (!domain) {
        req.flash("error", req.__("Set Base URL configuration first"));
        res.redirect("/useradmin/ssl");
        return;
      }
      if (!hostname_matches_baseurl(req, domain) && !is_hsts_tld(domain)) {
        req.flash(
          "error",
          req.__(
            "Base URL domain %s does not match hostname %s",
            domain,
            req.hostname
          )
        );
        res.redirect("/useradmin/ssl");
        return;
      }
      let altnames = [domain];
      const allTens = await getAllTenants();
      for (const ten of allTens) {
        const ten0 = getTenant(ten);
        const ten_domain = (ten0.configs.base_url.value || "")
          .replace("https://", "")
          .replace("http://", "")
          .replace("/", "");
        if (ten_domain) altnames.push(ten_domain);
      }
      try {
        const file_store = db.connectObj.file_store;
        const admin_users = await User.find({ role_id: 1 }, { orderBy: "id" });
        const Greenlock = require("greenlock");
        const greenlock = Greenlock.create({
          packageRoot: path.resolve(__dirname, ".."),
          configDir: path.join(file_store, "greenlock.d"),
          maintainerEmail: admin_users[0].email,
        });

        await greenlock.manager.defaults({
          subscriberEmail: admin_users[0].email,
          agreeToTerms: true,
        });
        await greenlock.sites.add({
          subject: domain,
          altnames,
        });
        await getState().setConfig("letsencrypt", true);
        req.flash(
          "success",
          req.__(
            "LetsEncrypt SSL enabled. Restart for changes to take effect."
          ) +
            " " +
            a({ href: "/admin/system" }, req.__("Restart here"))
        );
        res.redirect("/useradmin/ssl");
      } catch (e) {
        req.flash("error", e.message);
        res.redirect("/useradmin/ssl");
      }
    } else {
      req.flash("error", req.__("Not possible for tenant"));
      res.redirect("/useradmin/ssl");
    }
  })
);

/**
 * @name get/clear-all
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/clear-all",
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__(`Admin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Admin"), href: "/admin" },
            { text: req.__("Clear all") },
          ],
        },
        {
          type: "card",
          title: req.__("Clear all"),
          contents: div(renderForm(clearAllForm(req), req.csrfToken())),
        },
      ],
    });
  })
);

router.get(
  "/configuration-check",
  isAdmin,
  error_catcher(async (req, res) => {
    const { passes, errors, pass } = await runConfigurationCheck(req);
    const mkError = (err) =>
      div(
        { class: "alert alert-danger", role: "alert" },
        pre({ class: "mb-0" }, code(err))
      );
    res.sendWrap(req.__(`Admin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Admin"), href: "/admin" },
            { text: req.__("Configuration check") },
          ],
        },
        {
          type: "card",
          title: req.__("Configuration errors"),
          contents: div(
            pass
              ? div(
                  { class: "alert alert-success", role: "alert" },
                  i({ class: "fas fa-check-circle fa-lg me-2" }),
                  h5({ class: "d-inline" }, "No errors detected")
                )
              : errors.map(mkError)
          ),
        },
        {
          type: "card",
          title: req.__("Configuration checks passed"),
          contents: div(pre(code(passes.join("\n")))),
        },
      ],
    });
  })
);

/**
 * @name post/clear-all
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/clear-all",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = clearAllForm(req);
    form.validate(req.body);
    //order: pages, views, user fields, tableconstraints, fields, table triggers, table history, tables, plugins, config+crashes+nontable triggers, users
    if (form.values.pages) {
      await db.deleteWhere("_sc_pages");
    }
    if (form.values.views) {
      await View.delete({});
    }
    //user fields
    const users = await Table.findOne({ name: "users" });
    const userfields = await users.getFields();
    for (const f of userfields) {
      if (f.is_fkey) {
        if (f.reftable_name === "_sc_files" && form.values.files) {
          await f.delete();
        } else if (f.reftable_name !== "users" && form.values.tables) {
          await f.delete();
        }
      }
    }
    if (form.values.tables) {
      await db.deleteWhere("_sc_table_constraints");

      const tables = await Table.find();

      for (const table of tables) {
        await db.deleteWhere("_sc_triggers", {
          table_id: table.id,
        });
        await table.update({ ownership_field_id: null });
        const fields = await table.getFields();
        for (const f of fields) {
          if (f.is_fkey) {
            await f.delete();
          }
        }
      }
      for (const table of tables) {
        if (table.name !== "users") await table.delete();
      }
    }
    if (form.values.files) {
      const files = await File.find();
      for (const file of files) {
        await file.delete();
      }
      if (db.reset_sequence) await db.reset_sequence("_sc_files");
    }
    if (form.values.plugins) {
      const ps = await Plugin.find();
      for (const p of ps) {
        if (!["base", "sbadmin2"].includes(p.name)) await p.delete();
      }
      await getState().refresh_plugins();
    }
    if (form.values.triggers) {
      await db.deleteWhere("_sc_triggers");
      await getState().refresh_triggers();
    }
    if (form.values.library) {
      await db.deleteWhere("_sc_library");
    }
    if (form.values.eventlog) {
      await db.deleteWhere("_sc_event_log");
    }
    if (form.values.config) {
      //config+crashes
      await db.deleteWhere("_sc_errors");
      await db.deleteWhere("_sc_config", { not: { key: "letsencrypt" } });
      await getState().refresh();
    }
    if (form.values.users) {
      const users1 = await Table.findOne({ name: "users" });
      const userfields1 = await users1.getFields();

      for (const f of userfields1) {
        if (f.name !== "email" && f.name !== "id") await f.delete();
      }
      await db.deleteWhere("users");
      await db.deleteWhere("_sc_roles", { not: { id: { in: [1, 4, 8, 10] } } });
      if (db.reset_sequence) await db.reset_sequence("users");
      req.logout();
      if (req.session.destroy)
        req.session.destroy((err) => {
          req.logout();
        });
      else {
        req.logout();
        req.session = null;
      }
      res.redirect(`/auth/create_first_user`);
    } else {
      req.flash(
        "success",
        req.__(
          "Deleted all %s",
          Object.entries(form.values)
            .filter(([k, v]) => v)
            .map(([k, v]) => k)
            .join(", ")
        )
      );
      res.redirect(`/admin`);
    }
  })
);
