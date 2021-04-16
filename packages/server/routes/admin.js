const Router = require("express-promise-router");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Plugin = require("@saltcorn/data/models/plugin");
const File = require("@saltcorn/data/models/file");
const { spawn } = require("child_process");
const User = require("@saltcorn/data/models/user");
const path = require("path");
const { getAllTenants } = require("@saltcorn/data/models/tenant");
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
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const { getState, restart_tenant } = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");
const { create_backup, restore } = require("@saltcorn/data/models/backup");
const fs = require("fs");
const load_plugins = require("../load_plugins");
const {
  restore_backup,
  send_admin_page,
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
const router = new Router();
module.exports = router;

const site_id_form = (req) =>
  config_fields_form({
    req,
    field_names: [
      "site_name",
      "site_logo_id",
      "favicon_id",
      "base_url",
      "page_custom_css",
      "page_custom_html",
      "development_mode",
      "log_sql",
      "multitenancy_enabled",
    ],
    action: "/admin",
  });

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
  form.onChange =
    "remove_outline(this);$('#testemail').attr('href','#').removeClass('btn-primary').addClass('btn-outline-primary')";
  return form;
};
router.get(
  "/",
  setTenant,
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
router.post(
  "/",
  setTenant,
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
router.get(
  "/email",
  setTenant,
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
            "Send test email"
          ),
        ],
      },
    });
  })
);

router.get(
  "/send-test-email",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const from = getState().getConfig("email_from");
    const email = {
      from,
      to: req.user.email,
      subject: "Saltcorn test email",
      html: "Hello from Saltcorn",
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
router.post(
  "/email",
  setTenant,
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
router.get(
  "/backup",
  setTenant,
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
              td(p({ class: "ml-4 pt-2" }, req.__("Download a backup")))
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
              td(p({ class: "ml-4" }, req.__("Restore a backup")))
            )
          )
        ),
      },
    });
  })
);

router.get(
  "/system",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    const latest = isRoot && (await get_latest_npm_version("@saltcorn/cli"));
    const is_latest = packagejson.version === latest;
    const can_update = !is_latest && !process.env.SALTCORN_DISABLE_UPGRADE;
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
                              { class: "badge badge-primary ml-2" },
                              req.__("Latest")
                            )
                          : "")
                    )
                  ),
                  tr(th(req.__("Node.js version")), td(process.version)),
                  tr(
                    th(req.__("Database")),
                    td(db.isSQLite ? "SQLite" : "PostgreSQL")
                  )
                )
              ),
              p(
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

router.post(
  "/restart",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() === db.connectObj.default_schema) {
      process.exit(0);
    } else {
      await restart_tenant(loadAllPlugins);
      req.flash("success", req.__("Restart complete"));
      res.redirect("/admin");
    }
  })
);

router.post(
  "/upgrade",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() !== db.connectObj.default_schema) {
      req.flash("error", req.__("Not possible for tenant"));
      res.redirect("/admin");
    } else {
      res.write("Starting upgrade, please wait...\n");
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
          process.exit(0);
        }, 100);
      });
    }
  })
);

router.post(
  "/backup",
  setTenant,
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

router.post(
  "/restore",
  setTenant,
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

const clearAllForm = (req) =>
  new Form({
    action: "/admin/clear-all",
    labelCols: 0,
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
      ,
      {
        type: "Bool",
        name: "plugins",
        label: req.__("Plugins"),
        default: true,
      },
    ],
  });

router.post(
  "/enable-letsencrypt",
  setTenant,
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
      const domain_in_redirect =
        !hostname_matches_baseurl(req, domain) && is_hsts_tld(domain);
      const allTens = await getAllTenants();
      if (allTens.length > 0) {
        req.flash(
          "error",
          req.__("Cannot enable LetsEncrypt as there are subdomain tenants")
        );
        res.redirect("/useradmin/ssl");
        return;
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
          altnames: [domain, `www.${domain}`],
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
        if (domain_in_redirect) res.redirect("https://" + domain);
        else res.redirect("/useradmin/ssl");
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

router.get(
  "/clear-all",
  setTenant,
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
router.post(
  "/clear-all",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = clearAllForm(req);
    form.validate(req.body);
    //order: pages, views, user fields, tableconstraints, fields, table triggers, table history, tables, plugins, config+crashes+nontable triggers, users
    if (form.values.pages) {
      await db.deleteWhere("_sc_pages");
    }
    if (form.values.views) {
      await db.deleteWhere("_sc_views");
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
    }
    if (form.values.plugins) {
      const ps = await Plugin.find();
      for (const p of ps) {
        if (!["base", "sbadmin2"].includes(p.name)) await p.delete();
      }
      getState().refresh();
    }
    if (form.values.config) {
      //config+crashes+nontable triggers
      await db.deleteWhere("_sc_triggers");
      await db.deleteWhere("_sc_errors");
      await db.deleteWhere("_sc_config");
      getState().refresh();
    }
    if (form.values.users) {
      await db.deleteWhere("_sc_config");
      const users1 = await Table.findOne({ name: "users" });
      const userfields1 = await users1.getFields();

      for (const f of userfields1) {
        if (f.name !== "email" && f.name !== "id") await f.delete();
      }
      await db.deleteWhere("users");
      if (db.reset_sequence) await db.reset_sequence("users");
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
