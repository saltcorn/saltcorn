const Router = require("express-promise-router");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Plugin = require("@saltcorn/data/models/plugin");
const File = require("@saltcorn/data/models/file");
const { spawn } = require("child_process");
const User = require("@saltcorn/data/models/user");
const path = require("path");

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
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const { getState, restart_tenant } = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");
const { create_backup, restore } = require("@saltcorn/data/models/backup");
const fs = require("fs");
const load_plugins = require("../load_plugins");
const { restore_backup } = require("../markup/admin.js");
var packagejson = require("../package.json");
const Form = require("@saltcorn/data/models/form");
const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    const letsencrypt = getState().getConfig("letsencrypt", false);
    console.log({ letsencrypt });
    res.sendWrap(req.__(`Admin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Settings") }, { text: req.__("Admin") }],
        },
        {
          type: "card",
          title: req.__("Admin"),
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

            post_btn("/admin/backup", req.__("Backup"), req.csrfToken()),
            hr(),
            restore_backup(req.csrfToken(), [
              i({ class: "fas fa-2x fa-upload" }),
              "<br/>",
              req.__("Restore"),
            ]),
            !letsencrypt && hr(),
            !letsencrypt &&
              post_btn(
                "/admin/enable-letsencrypt",
                req.__("Enable LetsEncrypt HTTPS"),
                req.csrfToken()
              ),
            hr(),
            a(
              { href: "/admin/clear-all", class: "btn btn-danger" },
              i({ class: "fas fa-trash-alt" }),
              " ",
              req.__("Clear all"),
              " &raquo;"
            ),
            hr(),

            h4(req.__("About Saltcorn")),
            table(
              tbody(
                tr(
                  th(req.__("Saltcorn version")),
                  td(
                    packagejson.version +
                      (isRoot
                        ? post_btn(
                            "/admin/upgrade",
                            req.__("Upgrade"),
                            req.csrfToken(),
                            {
                              btnClass: "btn-primary btn-sm",
                              formClass: "d-inline",
                            }
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
            )
          ),
        },
      ],
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
      const base_url = getState().getConfig("base_url");
      if (!base_url) {
        req.flash("error", req.__("Set Base URL first"));
        res.redirect("/admin");
      }
      const domain = base_url
        .toLowerCase()
        .replace("https://", "")
        .replace("http://", "")
        .replace(/^(www\.)/, "")
        .replace(/\//g, "");
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
          req.__("LetsEncrypt SSL enabled. Restart for changes to take effect.")
        );
        res.redirect("/admin");
      } catch (e) {
        req.flash("error", e.message);
        res.redirect("/admin");
      }
    } else {
      req.flash("error", req.__("Not possible for tenant"));
      res.redirect("/admin");
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
      await db.deleteWhere("_sc_triggers", {
        table_id: { sql: "is not null" },
      });
      const tables = await Table.find();
      for (const table of tables) {
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
      for (const f of userfields) {
        if (f.name !== "email") await f.delete();
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
