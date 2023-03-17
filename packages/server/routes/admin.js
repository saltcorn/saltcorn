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
  get_sys_info,
} = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Plugin = require("@saltcorn/data/models/plugin");
const File = require("@saltcorn/data/models/file");
const { spawn } = require("child_process");
const User = require("@saltcorn/data/models/user");
const path = require("path");
const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
const {
  post_btn,
  renderForm,
  mkTable,
  link,
  localeDateTime,
} = require("@saltcorn/markup");
const {
  div,
  a,
  hr,
  i,
  h4,
  table,
  tbody,
  td,
  th,
  tr,
  span,
  p,
  code,
  h5,
  h3,
  pre,
  button,
  form,
  label,
  input,
  select,
  option,
  fieldset,
  ul,
  li,
  ol,
  script,
  domReady,
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const {
  getState,
  restart_tenant,
  getTenant,
  getRootState,
  //get_other_domain_tenant,
  get_process_init_time,
} = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");
const {
  create_backup,
  restore,
  auto_backup_now,
} = require("@saltcorn/admin-models/models/backup");
const { install_pack } = require("@saltcorn/admin-models/models/pack");
const Snapshot = require("@saltcorn/admin-models/models/snapshot");
const {
  runConfigurationCheck,
} = require("@saltcorn/admin-models/models/config-check");
const fs = require("fs");
const load_plugins = require("../load_plugins");
const {
  restore_backup,
  send_admin_page,
  //send_files_page,
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
const os = require("os");
const Page = require("@saltcorn/data/models/page");
const { getSafeSaltcornCmd } = require("@saltcorn/data/utils");
const stream = require("stream");
const Crash = require("@saltcorn/data/models/crash");

const router = new Router();
module.exports = router;

/**
 * Site identity form
 * @param {object} req -http request
 * @returns {Promise<Form>} form
 */
const site_id_form = (req) =>
  config_fields_form({
    req,
    field_names: [
      "site_name",
      "timezone",
      "base_url",
      ...(getConfigFile() ? ["multitenancy_enabled"] : []),
      { section_header: "Logo image" },
      "site_logo_id",
      "favicon_id",
      { section_header: "Custom code" },
      "page_custom_css",
      "page_custom_html",
      { section_header: "Extension store" },
      "plugins_store_endpoint",
      "packs_store_endpoint",
    ],
    action: "/admin",
    submitLabel: req.__("Save"),
  });
/**
 * Email settings form
 * @param {object} req request
 * @returns {Promise<Form>} form
 */
const email_form = async (req) => {
  return await config_fields_form({
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
};

const app_files_table = (files, buildDirName, req) =>
  mkTable(
    [
      {
        label: req.__("Filename"),
        key: (r) => div(r.filename),
      },
      { label: req.__("Size (KiB)"), key: "size_kb", align: "right" },
      { label: req.__("Media type"), key: (r) => r.mimetype },
      {
        label: req.__("Open"),
        key: (r) =>
          link(
            `/files/serve/mobile_app/${buildDirName}/${r.filename}`,
            req.__("Open")
          ),
      },
      {
        label: req.__("Download"),
        key: (r) =>
          link(
            `/files/download/mobile_app/${buildDirName}/${r.filename}`,
            req.__("Download")
          ),
      },
    ],
    files
  );

/**
 * Router get /
 * @name get
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await site_id_form(req);
    send_admin_page({
      res,
      req,
      active_sub: "Site identity",
      contents: {
        type: "card",
        title: req.__("Site identity settings"),
        titleAjaxIndicator: true,
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

      if (!req.xhr) {
        req.flash("success", req.__("Site identity settings updated"));
        res.redirect("/admin");
      } else res.json({ success: "ok" });
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
        titleAjaxIndicator: true,
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
      if (!req.xhr) {
        req.flash("success", req.__("Email settings updated"));
        res.redirect("/admin/email");
      } else res.json({ success: "ok" });
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
    const backupForm = autoBackupForm(req);
    backupForm.values.auto_backup_frequency = getState().getConfig(
      "auto_backup_frequency"
    );
    backupForm.values.auto_backup_destination = getState().getConfig(
      "auto_backup_destination"
    );
    backupForm.values.auto_backup_directory = getState().getConfig(
      "auto_backup_directory"
    );
    backupForm.values.auto_backup_expire_days = getState().getConfig(
      "auto_backup_expire_days"
    );
    const aSnapshotForm = snapshotForm(req);
    aSnapshotForm.values.snapshots_enabled =
      getState().getConfig("snapshots_enabled");
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

    send_admin_page({
      res,
      req,
      active_sub: "Backup",
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Manual backup"),
            contents: {
              besides: [
                div(
                  post_btn(
                    "/admin/backup",
                    i({ class: "fas fa-download me-2" }) +
                      req.__("Download a backup"),
                    req.csrfToken(),
                    {
                      btnClass: "btn-outline-primary",
                    }
                  )
                ),
                div(
                  restore_backup(req.csrfToken(), [
                    i({ class: "fas fa-2x fa-upload me-2" }),
                    "",
                    req.__("Restore a backup"),
                  ])
                ),
              ],
            },
          },
          isRoot
            ? {
                type: "card",
                title: req.__("Automated backup"),
                titleAjaxIndicator: true,
                contents: div(
                  renderForm(backupForm, req.csrfToken()),
                  a(
                    { href: "/admin/auto-backup-list" },
                    req.__("Restore/download automated backups &raquo;")
                  ),
                  script(
                    domReady(
                      `$('#btnBackupNow').prop('disabled', $('#inputauto_backup_frequency').val()==='Never');`
                    )
                  )
                ),
              }
            : { type: "blank", contents: "" },
          {
            type: "card",
            title: req.__("Snapshots"),
            titleAjaxIndicator: true,
            contents: div(
              p(
                i(
                  req.__(
                    "Snapshots store your application structure and definition, without the table data. Individual views and pages can be restored from snapshots from the <a href='/viewedit'>view</a> or <a href='/pageedit'>pages</a> overviews (\"Restore\" from individual page or view dropdowns)."
                  )
                )
              ),
              renderForm(aSnapshotForm, req.csrfToken()),
              a(
                { href: "/admin/snapshot-list" },
                req.__("List/download snapshots &raquo;")
              ),
              form(
                {
                  method: "post",
                  action: "/admin/snapshot-restore-full",
                  encType: "multipart/form-data",
                },
                input({
                  type: "hidden",
                  name: "_csrf",
                  value: req.csrfToken(),
                }),
                label(
                  {
                    class: "btn-link",
                    for: "upload_to_snapshot",
                    style: { cursor: "pointer" },
                  },
                  i({ class: "fas fa-upload me-2 mt-2" }),
                  req.__("Restore a snapshot")
                ),
                input({
                  id: "upload_to_snapshot",
                  class: "d-none",
                  name: "file",
                  type: "file",
                  accept: ".json,application/json",
                  onchange:
                    "notifyAlert('Restoring snapshot...', true);this.form.submit();",
                })
              )
            ),
          },
        ],
      },
    });
  })
);

/**
 * @name get/backup
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/auto-backup-list",
  isAdmin,
  error_catcher(async (req, res) => {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    if (!isRoot) {
      res.redirect("/admin/backup");
      return;
    }
    const auto_backup_directory = getState().getConfig("auto_backup_directory");
    const fileNms = await fs.promises.readdir(auto_backup_directory);
    const backupFiles = fileNms.filter(
      (fnm) => fnm.startsWith("sc-backup") && fnm.endsWith(".zip")
    );
    send_admin_page({
      res,
      req,
      active_sub: "Backup",
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Download automated backup"),
            contents: div(
              ul(
                backupFiles.map((fnm) =>
                  li(
                    a(
                      {
                        href: `/admin/auto-backup-download/${encodeURIComponent(
                          fnm
                        )}`,
                      },
                      fnm
                    )
                  )
                )
              )
            ),
          },
          {
            type: "card",
            title: req.__("Restoring automated backup"),
            contents: div(
              ol(
                li(req.__("Download one of the backups above")),
                li(
                  a(
                    { href: "/admin/clear-all" },
                    req.__("Clear this application")
                  ),
                  " ",
                  req.__("(tick all boxes)")
                ),
                li(
                  req.__(
                    "When prompted to create the first user, click the link to restore a backup"
                  )
                ),
                li(req.__("Select the downloaded backup file"))
              )
            ),
          },
        ],
      },
    });
  })
);

router.get(
  "/snapshot-list",
  isAdmin,
  error_catcher(async (req, res) => {
    const snaps = await Snapshot.find();
    send_admin_page({
      res,
      req,
      active_sub: "Backup",
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Download snapshots"),
            contents: div(
              ul(
                snaps.map((snap) =>
                  li(
                    a(
                      {
                        href: `/admin/snapshot-download/${encodeURIComponent(
                          snap.id
                        )}`,
                        target: "_blank",
                      },
                      `${localeDateTime(snap.created)} (${moment(
                        snap.created
                      ).fromNow()})`
                    )
                  )
                )
              )
            ),
          },
        ],
      },
    });
  })
);

router.get(
  "/snapshot-download/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const snap = await Snapshot.findOne({ id });
    const readStream = new stream.PassThrough();
    readStream.end(JSON.stringify(snap.pack));
    res.type("application/json");
    res.attachment(
      `${getState().getConfig("site_name", db.getTenantSchema())}-snapshot-${
        snap.id
      }.json`
    );
    readStream.pipe(res);
  })
);

router.get(
  "/snapshot-restore/:type/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { type, name } = req.params;
    const snaps = await Snapshot.entity_history(type, name);
    res.send(
      mkTable(
        [
          {
            label: req.__("When"),
            key: (r) =>
              `${localeDateTime(r.created)} (${moment(r.created).fromNow()})`,
          },

          {
            label: req.__("Restore"),
            key: (r) =>
              post_btn(
                `/admin/snapshot-restore/${type}/${name}/${r.id}`,
                req.__("Restore"),
                req.csrfToken()
              ),
          },
        ],
        snaps
      )
    );
  })
);

router.post(
  "/snapshot-restore/:type/:name/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { type, name, id } = req.params;
    const snap = await Snapshot.findOne({ id });
    await snap.restore_entity(type, name);
    req.flash(
      "success",
      `${type} ${name} restored to snapshot saved ${moment(
        snap.created
      ).fromNow()}`
    );
    res.redirect(/^[a-z]+$/g.test(type) ? `/${type}edit` : "/");
  })
);

/**
 * @name post/restore
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/snapshot-restore-full",
  setTenant, // TODO why is this needed?????
  isAdmin,
  error_catcher(async (req, res) => {
    if (req.files?.file?.tempFilePath) {
      try {
        const pack = JSON.parse(fs.readFileSync(req.files?.file?.tempFilePath));
        await install_pack(pack, undefined, (p) =>
          load_plugins.loadAndSaveNewPlugin(p)
        );
        req.flash("success", req.__("Snapshot restored"));
      } catch (e) {
        console.error(e);
        req.flash("error", e.message);
      }
    }
    res.redirect(`/admin/backup`);
  })
);

router.get(
  "/auto-backup-download/:filename",
  isAdmin,
  error_catcher(async (req, res) => {
    const { filename } = req.params;
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    if (
      !isRoot ||
      !(filename.startsWith("sc-backup") && filename.endsWith(".zip"))
    ) {
      res.redirect("/admin/backup");
      return;
    }
    const auto_backup_directory = getState().getConfig("auto_backup_directory");
    res.download(path.join(auto_backup_directory, filename), filename);
  })
);

/**
 * Auto backup Form
 * @param {object} req
 * @returns {Form} form
 */
const autoBackupForm = (req) =>
  new Form({
    action: "/admin/set-auto-backup",
    onChange: `saveAndContinue(this);$('#btnBackupNow').prop('disabled', $('#inputauto_backup_frequency').val()==='Never');`,
    noSubmitButton: true,
    additionalButtons: [
      {
        label: req.__("Backup now"),
        id: "btnBackupNow",
        class: "btn btn-outline-secondary",
        onclick: "ajax_post('/admin/auto-backup-now')",
      },
    ],
    fields: [
      {
        type: "String",
        label: req.__("Frequency"),
        name: "auto_backup_frequency",
        required: true,
        attributes: { options: ["Never", "Daily", "Weekly"] },
      },
      {
        type: "String",
        label: req.__("Destination"),
        name: "auto_backup_destination",
        required: true,
        showIf: { auto_backup_frequency: ["Daily", "Weekly"] },
        attributes: { options: ["Saltcorn files", "Local directory"] },
      },
      {
        type: "String",
        label: req.__("Directory"),
        name: "auto_backup_directory",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "Local directory",
        },
      },
      {
        type: "Integer",
        label: req.__("Expiration in days"),
        sublabel: req.__(
          "Delete old backup files in this directory after the set number of days"
        ),
        name: "auto_backup_expire_days",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "Local directory",
        },
      },
    ],
  });

const snapshotForm = (req) =>
  new Form({
    action: "/admin/set-snapshot",
    onChange: `saveAndContinue(this);`,
    noSubmitButton: true,
    additionalButtons: [
      {
        label: req.__("Snapshot now"),
        id: "btnSnapNow",
        class: "btn btn-outline-secondary",
        onclick: "ajax_post('/admin/snapshot-now')",
      },
    ],
    fields: [
      {
        type: "Bool",
        label: req.__("Periodic snapshots enabled"),
        name: "snapshots_enabled",
        sublabel: req.__(
          "Snapshot will be made every hour if there are changes"
        ),
      },
    ],
  });
router.post(
  "/set-snapshot",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await snapshotForm(req);
    form.validate(req.body);

    await save_config_from_form(form);

    if (!req.xhr) {
      req.flash("success", req.__("Snapshot settings updated"));
      res.redirect("/admin/backup");
    } else res.json({ success: "ok" });
  })
);
router.post(
  "/set-auto-backup",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await autoBackupForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_admin_page({
        res,
        req,
        active_sub: "Backup",
        contents: {
          type: "card",
          title: req.__("Backup settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);
      if (!req.xhr) {
        req.flash("success", req.__("Backup settings updated"));
        res.redirect("/admin/backup");
      } else res.json({ success: "ok" });
    }
  })
);
router.post(
  "/auto-backup-now",
  isAdmin,
  error_catcher(async (req, res) => {
    try {
      await auto_backup_now();
      req.flash("success", req.__("Backup successful"));
    } catch (e) {
      getState().log(1, e);
      req.flash("error", e.message);
    }
    res.json({ reload_page: true });
  })
);

router.post(
  "/snapshot-now",
  isAdmin,
  error_catcher(async (req, res) => {
    try {
      const taken = await Snapshot.take_if_changed();
      if (taken) req.flash("success", req.__("Snapshot successful"));
      else
        req.flash("success", req.__("No changes detected, snapshot skipped"));
    } catch (e) {
      req.flash("error", e.message);
    }
    res.json({ reload_page: true });
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
    const latest =
      isRoot && (await get_latest_npm_version("@saltcorn/cli", 1000));
    const is_latest = packagejson.version === latest;
    const git_commit = getGitRevision();
    const can_update =
      !is_latest && !process.env.SALTCORN_DISABLE_UPGRADE && !git_commit;
    const dbversion = await db.getVersion(true);
    const { memUsage, diskUsage, cpuUsage } = await get_sys_info();
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
                    th(req.__("Database type")),
                    td(db.isSQLite ? "SQLite " : "PostgreSQL ", dbversion)
                  ),
                  isRoot
                    ? tr(th(req.__("Database host")), td(db.connectObj.host))
                    : "",
                  isRoot
                    ? tr(th(req.__("Database port")), td(db.connectObj.port))
                    : "",
                  isRoot
                    ? tr(
                        th(req.__("Database name")),
                        td(db.connectObj.database)
                      )
                    : "",
                  isRoot
                    ? tr(th(req.__("Database user")), td(db.connectObj.user))
                    : "",
                  tr(th(req.__("Database schema")), td(db.getTenantSchema())),
                  tr(
                    th(req.__("Process uptime")),
                    td(moment(get_process_init_time()).fromNow(true))
                  ),
                  tr(
                    th(req.__("Disk usage")),
                    diskUsage > 95
                      ? td(
                          { class: "text-danger fw-bold" },
                          diskUsage,
                          "%",
                          i({ class: "fas fa-exclamation-triangle ms-1" })
                        )
                      : td(diskUsage, "%")
                  ),
                  tr(th(req.__("CPU usage")), td(cpuUsage, "%")),
                  tr(th(req.__("Mem usage")), td(memUsage, "%"))
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
          req.__(
            `Upgrade done (if it was available) with code ${code}.\n\nPress the BACK button in your browser, then RELOAD the page.`
          )
        );
        setTimeout(() => {
          if (process.send) process.send("RestartServer");
          process.exit(0);
        }, 100);
      });
    }
  })
);
/**
 * /check-for-updates
 */
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
    const file = fs.createReadStream(fileName);
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
 * Clear All Form
 * @param {object} req
 * @returns {Form} form
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
        label: req.__("Modules"),
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
        // greenlock logic
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
        // letsencrypt
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
/**
 * /configuration-check
 */
router.get(
  "/configuration-check",
  isAdmin,
  error_catcher(async (req, res) => {
    const start = new Date();
    const filename = `${moment(start).format("YYYYMMDDHHmm")}.html`;
    await File.new_folder("configuration_checks");
    const go = async () => {
      const { passes, errors, pass, warnings } = await runConfigurationCheck(
        req
      );
      const end = new Date();
      const secs = Math.round((end.getTime() - start.getTime()) / 1000);

      const mkError = (err) =>
        div(
          { class: "alert alert-danger", role: "alert" },
          pre({ class: "mb-0" }, code(err))
        );
      const mkWarning = (err) =>
        div(
          { class: "alert alert-warning", role: "alert" },
          pre({ class: "mb-0" }, code(err))
        );

      const report =
        div(
          h3("Errors"),
          pass
            ? div(req.__("No errors detected during configuration check"))
            : errors.map(mkError)
        ) +
        div(
          h3("Warnings"),
          (warnings || []).length
            ? (warnings || []).map(mkWarning)
            : "No warnings"
        ) +
        div(
          h3("Passes"),

          pre(code(passes.join("\n")))
        ) +
        p(
          `Configuration check completed in ${
            secs > 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : secs + "s"
          }`
        );
      await File.from_contents(
        filename,
        "text/html",
        report,
        req.user.id,
        1,
        "/configuration_checks"
      );
    };
    go().catch((err) => Crash.create(err, req));
    res.sendWrap(req.__(`Admin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("About application"), href: "/admin" },
            { text: req.__("System"), href: "/admin/system" },
            { text: req.__("Configuration check") },
          ],
        },

        {
          type: "card",
          title: req.__("Configuration check report"),
          contents: div(
            "When completed, the report will be ready here: ",
            a(
              { href: `/files/serve/configuration_checks/${filename}` },
              "/configuration_checks/" + filename
            )
          ),
        },
      ],
    });
  })
);

const buildDialogScript = () => {
  return `<script>
  function swapEntryInputs(activeTab, activeInput, disabledTab, disabledInput) {
    activeTab.addClass("active");
    activeInput.removeClass("d-none");
    activeInput.addClass("d-block");
    activeInput.attr("name", "entryPoint");
    disabledTab.removeClass("active");
    disabledInput.removeClass("d-block");
    disabledInput.addClass("d-none");
    disabledInput.removeAttr("name");
  }
  
  function showEntrySelect(type) {
    const viewNavLin = $("#viewNavLinkID");
    const pageNavLink = $("#pageNavLinkID");
    const viewInp = $("#viewInputID");
    const pageInp = $("#pageInputID");
    if (type === "page") {
      swapEntryInputs(pageNavLink, pageInp, viewNavLin, viewInp);
    }
    else if (type === "view") {
      swapEntryInputs(viewNavLin, viewInp, pageNavLink, pageInp);
    }
    $("#entryPointTypeID").attr("value", type);
  }
  
  function handleMessages() {
    notifyAlert("Building the app, please wait.")
    ${
      getState().getConfig("apple_team_id") &&
      getState().getConfig("apple_team_id") !== "null"
        ? ""
        : `  
    if ($("#iOSCheckboxId")[0].checked) {
      notifyAlert(
        "No 'Apple Team ID' is configured, I will try to build a project for the iOS simulator."
      );
    }`
    }
  }
  </script>`;
};
/**
 * Build mobile app
 */
router.get(
  "/build-mobile-app",
  isAdmin,
  error_catcher(async (req, res) => {
    const views = await View.find();
    const pages = await Page.find();

    send_admin_page({
      res,
      req,
      active_sub: "Mobile app",
      headers: [
        {
          headerTag: buildDialogScript(),
        },
      ],
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Build mobile app"),
            contents: form(
              {
                action: "/admin/build-mobile-app",
                method: "post",
              },

              fieldset(
                input({
                  type: "hidden",
                  name: "_csrf",
                  value: req.csrfToken(),
                }),
                input({
                  type: "hidden",
                  name: "entryPointType",
                  value: "view",
                  id: "entryPointTypeID",
                }),
                div(
                  { class: "container ps-2" },
                  div(
                    { class: "row pb-2" },
                    div({ class: "col-sm-4 fw-bold" }, req.__("Entry point")),
                    div({ class: "col-sm-4 fw-bold" }, req.__("Platform")),
                    div(
                      {
                        class: "col-sm-1 fw-bold d-flex justify-content-center",
                      },
                      req.__("docker")
                    )
                  ),
                  div(
                    { class: "row" },
                    div(
                      { class: "col-sm-4" },
                      // 'view/page' tabs
                      ul(
                        { class: "nav nav-pills" },
                        li(
                          {
                            class: "nav-item",
                            onClick: "showEntrySelect('view')",
                          },
                          div(
                            { class: "nav-link active", id: "viewNavLinkID" },
                            req.__("View")
                          )
                        ),
                        li(
                          {
                            class: "nav-item",
                            onClick: "showEntrySelect('page')",
                          },
                          div(
                            { class: "nav-link", id: "pageNavLinkID" },
                            req.__("Page")
                          )
                        )
                      ),
                      // select entry-view
                      select(
                        {
                          class: "form-control",
                          name: "entryPoint",
                          id: "viewInputID",
                        },
                        views
                          .map((view) =>
                            option({ value: view.name }, view.name)
                          )
                          .join(",")
                      ),
                      // select entry-page
                      select(
                        {
                          class: "form-control d-none",
                          id: "pageInputID",
                        },
                        pages
                          .map((page) =>
                            option({ value: page.name }, page.name)
                          )
                          .join(",")
                      )
                    ),
                    div(
                      { class: "col-sm-4" },

                      div(
                        { class: "container ps-0" },
                        div(
                          { class: "row" },
                          div({ class: "col-sm-8" }, req.__("android")),
                          div(
                            { class: "col-sm" },
                            input({
                              type: "checkbox",
                              class: "form-check-input",
                              name: "androidPlatform",
                              id: "androidCheckboxId",
                            })
                          )
                        ),
                        div(
                          { class: "row" },
                          div({ class: "col-sm-8" }, req.__("iOS")),
                          div(
                            { class: "col-sm" },
                            input({
                              type: "checkbox",
                              class: "form-check-input",
                              name: "iOSPlatform",
                              id: "iOSCheckboxId",
                            })
                          )
                        )
                      )
                    ),
                    div(
                      { class: "col-sm-1 d-flex justify-content-center" },
                      input({
                        type: "checkbox",
                        class: "form-check-input",
                        name: "useDocker",
                        id: "dockerCheckboxId",
                      })
                    )
                  ),
                  div(
                    { class: "row pb-2" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "appNameInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("App file")
                      ),
                      input({
                        type: "text",
                        class: "form-control",
                        name: "appFile",
                        id: "appFileInputId",
                        placeholder: "app-debug",
                      })
                    )
                  ),
                  div(
                    { class: "row pb-3" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "serverURLInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("Server URL")
                      ),
                      input({
                        type: "text",
                        class: "form-control",
                        name: "serverURL",
                        id: "serverURLInputId",
                        placeholder: getState().getConfig("base_url") || "",
                      })
                    )
                  )
                ),
                button(
                  {
                    id: "buildMobileAppBtnId",
                    type: "button",
                    onClick: `build_mobile_app(this);`,
                    class: "btn btn-warning",
                  },
                  i({ class: "fas fa-hammer pe-2" }),

                  req.__("Build mobile app")
                )
              )
            ),
          },
        ],
      },
    });
  })
);

const checkFiles = async (outDir, fileNames) => {
  const rootFolder = await File.rootFolder();
  const mobile_app_dir = path.join(rootFolder.location, "mobile_app", outDir);
  const unsafeFiles = await Promise.all(
    fs
      .readdirSync(mobile_app_dir)
      .map(
        async (outFile) => await File.from_file_on_disk(outFile, mobile_app_dir)
      )
  );
  const entries = unsafeFiles
    .filter(
      (file) =>
        file.user_id &&
        !isNaN(file.user_id) &&
        file.min_role_read &&
        !isNaN(file.min_role_read)
    )
    .map((file) => file.filename);
  return fileNames.some((fileName) => entries.indexOf(fileName) >= 0);
};

// check if a build has finished (poll service)
router.get(
  "/build-mobile-app/finished",
  isAdmin,
  error_catcher(async (req, res) => {
    const { build_dir } = req.query;
    res.json({
      finished: await checkFiles(build_dir, ["logs.txt", "error_logs.txt"]),
    });
  })
);

router.get(
  "/build-mobile-app/result",
  isAdmin,
  error_catcher(async (req, res) => {
    const { build_dir_name } = req.query;
    const rootFolder = await File.rootFolder();
    const buildDir = path.join(
      rootFolder.location,
      "mobile_app",
      build_dir_name
    );
    const files = await Promise.all(
      fs
        .readdirSync(buildDir)
        .map(async (outFile) => await File.from_file_on_disk(outFile, buildDir))
    );
    const resultMsg = files.find((file) => file.filename === "logs.txt")
      ? req.__("The build was successfully")
      : req.__("Unable to build the app");
    res.sendWrap(req.__(`Admin`), {
      above: [
        {
          type: "card",
          title: req.__("Build Result"),
          contents: div(resultMsg),
        },
        files.length > 0 ? app_files_table(files, build_dir_name, req) : "",
      ],
    });
  })
);

router.post(
  "/build-mobile-app",
  isAdmin,
  error_catcher(async (req, res) => {
    let {
      entryPoint,
      entryPointType,
      androidPlatform,
      iOSPlatform,
      useDocker,
      appFile,
      serverURL,
    } = req.body;
    if (!androidPlatform && !iOSPlatform) {
      return res.json({
        error: req.__("Please select at least one platform (android or iOS)."),
      });
    }
    if (!androidPlatform && useDocker) {
      return res.json({
        error: req.__("Only the android build supports docker."),
      });
    }
    if (!serverURL || serverURL.length == 0) {
      serverURL = getState().getConfig("base_url") || "";
    }
    if (!serverURL.startsWith("http")) {
      return res.json({
        error: req.__("Please enter a valid server URL."),
      });
    }
    const outDirName = `build_${new Date().valueOf()}`;
    const rootFolder = await File.rootFolder();
    const buildDir = path.join(rootFolder.location, "mobile_app", outDirName);
    await File.new_folder(outDirName, "/mobile_app");
    const spawnParams = [
      "build-app",
      "-e",
      entryPoint,
      "-t",
      entryPointType,
      "-c",
      buildDir,
      "-b",
      `${os.userInfo().homedir}/mobile_app_build`,
      "-u",
      req.user.email, // ensured by isAdmin
    ];
    if (useDocker) spawnParams.push("-d");
    if (androidPlatform) spawnParams.push("-p", "android");
    if (iOSPlatform) {
      spawnParams.push("-p", "ios");
      const teamId = getState().getConfig("apple_team_id");
      if (!teamId || teamId === "null") {
        spawnParams.push("--buildForEmulator");
      }
    }
    if (appFile) spawnParams.push("-a", appFile);
    if (serverURL) spawnParams.push("-s", serverURL);
    if (
      db.is_it_multi_tenant() &&
      db.getTenantSchema() !== db.connectObj.default_schema
    ) {
      spawnParams.push("--tenantAppName", db.getTenantSchema());
    }
    // end http call, return the out directory name
    // the gui polls for results
    res.json({ build_dir_name: outDirName });
    const child = spawn(getSafeSaltcornCmd(), spawnParams, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ".",
    });
    const childOutputs = [];
    child.stdout.on("data", (data) => {
      // console.log(data.toString());
      if (data) childOutputs.push(data.toString());
    });
    child.stderr.on("data", (data) => {
      // console.log(data.toString());
      childOutputs.push(data ? data.toString() : req.__("An error occurred"));
    });
    child.on("exit", (exitCode, signal) => {
      const logFile = exitCode === 0 ? "logs.txt" : "error_logs.txt";
      fs.writeFile(
        path.join(buildDir, logFile),
        childOutputs.join("\n"),
        async (error) => {
          if (error) {
            console.log(`unable to write '${logFile}' to '${buildDir}'`);
            console.log(error);
          } else {
            // no transaction, '/build-mobile-app/finished' filters for valid attributes
            await File.set_xattr_of_existing_file(logFile, buildDir, req.user);
          }
        }
      );
    });
    child.on("error", (msg) => {
      const message = msg.message ? msg.message : msg.code;
      const stack = msg.stack ? msg.stack : "";
      const logFile = "error_logs.txt";
      fs.writeFile(
        path.join(buildDir, "error_logs.txt"),
        [message, stack].join("\n"),
        async (error) => {
          if (error) {
            console.log(`unable to write logFile to '${buildDir}'`);
            console.log(error);
          } else {
            // no transaction, '/build-mobile-app/finished' filters for valid attributes
            await File.set_xattr_of_existing_file(logFile, buildDir, req.user);
          }
        }
      );
    });
  })
);

/**
 * Clear all
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
        // todo configurable list of mandatory plugins
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
      req.logout(function (err) {
        if (req.session.destroy)
          req.session.destroy((err) => {
            req.logout(() => {
              res.redirect(`/auth/create_first_user`);
            });
          });
        else {
          req.logout(() => {
            req.session = null; // todo make configurable - redirect to create first user
            // redirect to create first user
            res.redirect(`/auth/create_first_user`);
          });
        }
      });
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

/**
 * Developer settings form
 * @param {object} req request
 * @returns {Promise<Form>} form
 */
const dev_form = async (req) => {
  const tenants_set_npm_modules = getRootState().getConfig(
    "tenants_set_npm_modules",
    false
  );
  const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

  return await config_fields_form({
    req,
    field_names: [
      "development_mode",
      "log_sql",
      "log_client_errors",
      "log_level",
      ...(isRoot || tenants_set_npm_modules ? ["npm_available_js_code"] : []),
    ],
    action: "/admin/dev",
  });
};
/**
 * Developer Mode page
 * @name get/dev
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/dev",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await dev_form(req);
    send_admin_page({
      res,
      req,
      active_sub: "Development",
      contents: {
        type: "card",
        title: req.__("Development settings"),
        titleAjaxIndicator: true,
        contents: [
          renderForm(form, req.csrfToken()) /*,
                    a(
                        {
                            id: "testemail",
                            href: "/admin/send-test-email",
                            class: "btn btn-primary",
                        },
                        req.__("Send test email")
                    ),*/,
        ],
      },
    });
  })
);

/**
 * Development mode
 * @name post/email
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/dev",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await dev_form(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_admin_page({
        res,
        req,
        active_sub: "Development",
        contents: {
          type: "card",
          title: req.__("Development settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);
      if (!req.xhr) {
        req.flash("success", req.__("Development mode settings updated"));
        res.redirect("/admin/dev");
      } else res.json({ success: "ok" });
    }
  })
);
