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
  admin_config_route,
  get_sys_info,
  tenant_letsencrypt_name,
} = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const Plugin = require("@saltcorn/data/models/plugin");
const File = require("@saltcorn/data/models/file");
const { spawn, exec } = require("child_process");
const User = require("@saltcorn/data/models/user");
const Trigger = require("@saltcorn/data/models/trigger");
const path = require("path");
const { X509Certificate } = require("crypto");
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
  text,
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
const PageGroup = require("@saltcorn/data/models/page_group");
const { getConfigFile } = require("@saltcorn/data/db/connect");
const os = require("os");
const Page = require("@saltcorn/data/models/page");
const {
  getSafeSaltcornCmd,
  getFetchProxyOptions,
} = require("@saltcorn/data/utils");
const stream = require("stream");
const Crash = require("@saltcorn/data/models/crash");
const { get_help_markup } = require("../help/index.js");
const Docker = require("dockerode");
const npmFetch = require("npm-registry-fetch");
const Tag = require("@saltcorn/data/models/tag");

const router = new Router();
module.exports = router;

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
const intermediate_build_result = (outDirName, buildDir, req) => {
  return div(
    h3("Intermediate build result"),
    div(
      button(
        {
          id: "finishMobileAppBtnId",
          type: "button",
          onClick: `finish_mobile_app(this, '${outDirName}', '${buildDir}');`,
          class: "btn btn-warning",
        },
        i({ class: "fas fa-hammer pe-2" }),

        req.__("Finish the build")
      )
    )
  );
};

admin_config_route({
  router,
  path: "/",
  super_path: "/admin",
  flash: "Site identity settings updated",
  field_names: [
    "site_name",
    "timezone",
    "default_locale",
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
  response(form, req, res) {
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
  },
});

admin_config_route({
  router,
  path: "/email",
  super_path: "/admin",
  flash: "Email settings updated",
  field_names: [
    "smtp_host",
    "smtp_username",
    "smtp_password",
    "smtp_port",
    "smtp_secure",
    "smtp_allow_self_signed",
    "email_from",
  ],
  response(form, req, res) {
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
  },
});

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
 * @name get/send-test-email
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/help/:topic",
  isAdmin,
  error_catcher(async (req, res) => {
    const { topic } = req.params;
    const { markup } = await get_help_markup(topic, req.query, req);

    res.sendWrap(`Help: ${topic}`, { above: [markup] });
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
    //
    const aBackupFilePrefixForm = backupFilePrefixForm(req);
    aBackupFilePrefixForm.values.backup_file_prefix =
      getState().getConfig("backup_file_prefix");
    aBackupFilePrefixForm.values.backup_history =
      getState().getConfig("backup_history");
    //
    const backupForm = autoBackupForm(req);
    backupForm.values.auto_backup_frequency = getState().getConfig(
      "auto_backup_frequency"
    );
    backupForm.values.auto_backup_destination = getState().getConfig(
      "auto_backup_destination"
    );
    backupForm.values.auto_backup_tenants = getState().getConfig(
      "auto_backup_tenants"
    );
    backupForm.values.auto_backup_directory = getState().getConfig(
      "auto_backup_directory"
    );
    backupForm.values.auto_backup_retain_local_directory = getState().getConfig(
      "auto_backup_retain_local_directory"
    );
    backupForm.values.auto_backup_username = getState().getConfig(
      "auto_backup_username"
    );
    backupForm.values.auto_backup_server =
      getState().getConfig("auto_backup_server");
    backupForm.values.auto_backup_password = getState().getConfig(
      "auto_backup_password"
    );
    backupForm.values.auto_backup_port =
      getState().getConfig("auto_backup_port");

    backupForm.values.auto_backup_expire_days = getState().getConfig(
      "auto_backup_expire_days"
    );
    aBackupFilePrefixForm.values.backup_with_event_log = getState().getConfig(
      "backup_with_event_log"
    );
    aBackupFilePrefixForm.values.backup_with_system_zip = getState().getConfig(
      "backup_with_system_zip"
    );
    aBackupFilePrefixForm.values.backup_system_zip_level = getState().getConfig(
      "backup_system_zip_level"
    );
    //
    const aSnapshotForm = snapshotForm(req);
    aSnapshotForm.values.snapshots_enabled =
      getState().getConfig("snapshots_enabled");
    //
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    //
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
            title:
              req.__("Snapshots") +
              `<a href="javascript:ajax_modal('/admin/help/Snapshots?')"><i class="fas fa-question-circle ms-1"></i></a>`,
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
          {
            type: "card",
            title: req.__("Backup settings"),
            titleAjaxIndicator: true,
            contents: div(renderForm(aBackupFilePrefixForm, req.csrfToken())),
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

    const backup_file_prefix = getState().getConfig("backup_file_prefix");

    const fileNms = auto_backup_directory
      ? await fs.promises.readdir(auto_backup_directory)
      : [];

    const backupFiles = fileNms.filter(
      (fnm) => fnm.startsWith(backup_file_prefix) && fnm.endsWith(".zip")
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
              backupFiles.length > 0
                ? ul(
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
                : p(req.__("No files"))
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
    const snaps = await Snapshot.find(
      {},
      { orderBy: "created", orderDesc: true, fields: ["id", "created", "hash"] }
    );
    const locale = getState().getConfig("default_locale", "en");
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
              snaps.length > 0
                ? ul(
                    snaps.map((snap) =>
                      li(
                        a(
                          {
                            href: `/admin/snapshot-download/${encodeURIComponent(
                              snap.id
                            )}`,
                            target: "_blank",
                          },
                          `${localeDateTime(
                            snap.created,
                            {},
                            locale
                          )} (${moment(snap.created).fromNow()})`
                        )
                      )
                    )
                  )
                : p(req.__("No files"))
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
    const locale = getState().getConfig("default_locale", "en");
    res.set("Page-Title", `Restore ${text(name)}`);
    res.send(
      mkTable(
        [
          {
            label: req.__("When"),
            key: (r) =>
              `${localeDateTime(r.created, {}, locale)} (${moment(
                r.created
              ).fromNow()})`,
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
    res.redirect(
      type === "trigger"
        ? `/actions`
        : /^[a-z]+$/g.test(type)
        ? `/${type}edit`
        : "/"
    );
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
    const backup_file_prefix = getState().getConfig("backup_file_prefix");
    if (
      !isRoot ||
      !(
        path.resolve(filename).startsWith(backup_file_prefix) &&
        filename.endsWith(".zip")
      )
    ) {
      res.redirect("/admin/backup");
      return;
    }
    const auto_backup_directory = getState().getConfig("auto_backup_directory");
    res.download(path.join(auto_backup_directory, filename), filename);
  })
);

/**
 * Set Backup File Prefix Form
 * @param req
 * @returns {Form}
 */
const backupFilePrefixForm = (req) =>
  new Form({
    action: "/admin/set-backup-prefix",
    onChange: `saveAndContinue(this);`,
    noSubmitButton: true,
    fields: [
      {
        type: "String",
        label: req.__("Backup file prefix"),
        name: "backup_file_prefix",
        sublabel: req.__("Backup file prefix"),
        default: "sc-backup-",
      },
      {
        type: "Bool",
        label: req.__("History"),
        name: "backup_history",
        sublabel: req.__("Include table history in backup"),
        default: true,
      },
      {
        type: "Bool",
        label: req.__("Include Event Logs"),
        sublabel: req.__("Backup with event logs"),
        name: "backup_with_event_log",
      },
      {
        type: "Bool",
        label: req.__("Use system zip"),
        sublabel: req.__(
          "Recommended. Executable <code>zip</code> must be installed"
        ),
        name: "backup_with_system_zip",
      },
      {
        type: "Integer",
        label: req.__("Zip compression level"),
        sublabel: req.__("1=Fast, larger file, 9=Slow, smaller files"),
        name: "backup_system_zip_level",
        attributes: {
          min: 1,
          max: 9,
        },
        showIf: {
          backup_with_system_zip: true,
        },
      },
    ],
  });

/**
 * Auto backup Form
 * @param {object} req
 * @returns {Form} form
 */
const autoBackupForm = (req) => {
  const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

  return new Form({
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
        attributes: {
          auto_backup_frequency: ["Daily", "Weekly"],
          options: ["Saltcorn files", "Local directory", "SFTP server"],
        },
      },
      {
        type: "String",
        label: req.__("Server host"),
        name: "auto_backup_server",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "SFTP server",
        },
      },
      {
        type: "String",
        label: req.__("Username"),
        name: "auto_backup_username",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "SFTP server",
        },
      },
      {
        type: "String",
        label: req.__("Password"),
        fieldview: "password",
        name: "auto_backup_password",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "SFTP server",
        },
      },
      {
        type: "Integer",
        label: req.__("Port"),
        name: "auto_backup_port",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "SFTP server",
        },
      },
      {
        type: "String",
        label: req.__("Directory"),
        name: "auto_backup_directory",
        sublabel: req.__("Directory for backup files"),
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          //auto_backup_destination: "Local directory",
        },
      },
      {
        type: "String",
        label: req.__("Retain local directory"),
        name: "auto_backup_retain_local_directory",
        sublabel: req.__(
          "Retain a local backup copy in this directory (optional)"
        ),
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "SFTP server",
          //auto_backup_destination: "Local directory",
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
      ...(isRoot
        ? [
            {
              type: "Bool",
              label: req.__("All tenants"),
              sublabel: req.__("Also backup all tenants"),
              name: "auto_backup_tenants",
              showIf: {
                auto_backup_frequency: ["Daily", "Weekly"],
              },
            },
          ]
        : []),
    ],
  });
};

/**
 * Snapshot Form
 * @param req
 * @returns {Form}
 */
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
/**
 * Do Set snapshot
 */
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
/**
 * Do Set Backup Prefix
 */
router.post(
  "/set-backup-prefix",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await backupFilePrefixForm(req);
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
/**
 * Do Set auto backup
 */
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

/**
 * Do Auto backup now
 */
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
/**
 * Do Snapshot now
 */
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
 * Show System page
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
    const custom_ssl_certificate = getRootState().getConfig(
      "custom_ssl_certificate",
      false
    );
    const rndid = `bs${Math.round(Math.random() * 100000)}`;
    let expiry = "";
    if (custom_ssl_certificate && X509Certificate) {
      const { validTo } = new X509Certificate(custom_ssl_certificate);
      const diffTime = Math.abs(new Date(validTo) - new Date());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      expiry = tr(
        th(req.__("SSL expiry")),
        diffDays < 14
          ? td(
              { class: "text-danger fw-bold" },
              moment(new Date(validTo)).fromNow(),
              i({ class: "fas fa-exclamation-triangle ms-1" })
            )
          : td(moment(new Date(validTo)).fromNow())
      );
    }
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
              ),
              hr()
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
                      packagejson.version,
                      isRoot && can_update
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
                            req.__("Check updates"),
                            req.csrfToken(),
                            {
                              btnClass: "btn-primary btn-sm px-1 py-0",
                              formClass: "d-inline",
                            }
                          )
                        : "",
                      !git_commit &&
                        a(
                          {
                            id: rndid,
                            class: "btn btn-sm btn-secondary ms-1 px-1 py-0",
                            onClick: "press_store_button(this, true)",
                            href:
                              `javascript:ajax_modal('/admin/install_dialog', ` +
                              `{ onOpen: () => { restore_old_button('${rndid}'); }, ` +
                              ` onError: (res) => { selectVersionError(res, '${rndid}') } });`,
                          },
                          req.__("Choose version")
                        )
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
                    ? tr(
                        th(req.__("Database host")),
                        td(
                          db.connectObj.host +
                            (db.connectObj.port ? ":" + db.connectObj.port : "")
                        )
                      )
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
                  tr(th(req.__("Mem usage")), td(memUsage, "%")),
                  expiry
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
 * Do Restart
 * @name post/restart
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/restart",
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() === db.connectObj.default_schema) {
      if (process.send) getState().processSend("RestartServer");
      else process.exit(0);
    } else {
      await restart_tenant(loadAllPlugins);
      getState().processSend({
        restart_tenant: true,
        tenant: db.getTenantSchema(),
      });
      req.flash("success", req.__("Restart complete"));
      res.redirect("/admin");
    }
  })
);

const pullCapacitorBuilder = (req, res, version) => {
  const child = spawn(
    "docker",
    ["pull", `saltcorn/capacitor-builder:${version}`],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      res.write(data);
    });
    child.stderr?.on("data", (data) => {
      res.write(data);
    });
    child.on("exit", function (code, signal) {
      resolve(code);
    });
    child.on("error", (msg) => {
      const message = msg.message ? msg.message : msg.code;
      res.write(req.__("Error: ") + message + "\n");
      resolve(msg.code);
    });
  });
};

const tryInstallSdNotify = (req, res) => {
  const child = spawn("npm", ["install", "-g", "sd-notify"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      res.write(data);
    });
    child.stderr?.on("data", (data) => {
      res.write(data);
    });
    child.on("exit", function (code, signal) {
      resolve(code);
    });
    child.on("error", (msg) => {
      const message = msg.message ? msg.message : msg.code;
      res.write(req.__("Error: ") + message + "\n");
      resolve(msg.code);
    });
  });
};

const pruneDocker = (req, res) => {
  const child = spawn("docker", ["image", "prune", "-f"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      res.write(data);
    });
    child.stderr?.on("data", (data) => {
      res.write(data);
    });
    child.on("exit", function (code, signal) {
      resolve(code);
    });
    child.on("error", (msg) => {
      const message = msg.message ? msg.message : msg.code;
      res.write(req.__("Error: ") + message + "\n");
      resolve(msg.code);
    });
  });
};

/*
 * fetch available saltcorn versions and show a dialog to select one
 */
router.get(
  "/install_dialog",
  isAdmin,
  error_catcher(async (req, res) => {
    try {
      const pkgInfo = await npmFetch.json(
        "https://registry.npmjs.org/@saltcorn/cli",
        getFetchProxyOptions()
      );
      if (!pkgInfo?.versions)
        throw new Error(req.__("Unable to fetch versions"));
      const versions = Object.keys(pkgInfo.versions);
      if (versions.length === 0) throw new Error(req.__("No versions found"));
      const tags = pkgInfo["dist-tags"] || {};
      res.set("Page-Title", req.__("%s versions", "Saltcorn"));
      let selected = packagejson.version;
      res.send(
        form(
          {
            action: `/admin/install`,
            method: "post",
          },
          input({ type: "hidden", name: "_csrf", value: req.csrfToken() }),
          // version select
          div(
            { class: "form-group" },
            label(
              {
                for: "version_select",
                class: "form-label fw-bold",
              },
              req.__("Version")
            ),
            select(
              {
                id: "version_select",
                class: "form-control form-select",
                name: "version",
              },
              versions.map((version) =>
                option({
                  id: `${version}_opt`,
                  value: version,
                  label: version,
                  selected: version === selected,
                })
              )
            )
          ),
          // tag select
          div(
            { class: "form-group" },
            label(
              {
                for: "tag_select",
                class: "form-label fw-bold",
              },
              req.__("Tags")
            ),
            select(
              {
                id: "tag_select",
                class: "form-control form-select",
              },
              option({
                id: "empty_opt",
                value: "",
                label: req.__("Select tag"),
                selected: true,
              }),
              Object.keys(tags).map((tag) =>
                option({
                  id: `${tag}_opt`,
                  value: tags[tag],
                  label: `${tag} (${tags[tag]})`,
                })
              )
            )
          ),
          // deep clean checkbox
          div(
            { class: "form-group" },
            input({
              id: "deep_clean",
              class: "form-check-input",
              type: "checkbox",
              name: "deep_clean",
              checked: false,
            }),
            label(
              {
                for: "deep_clean",
                class: "form-label ms-2",
              },
              req.__("clean node_modules")
            )
          ),
          div(
            { class: "d-flex justify-content-end" },
            button(
              {
                type: "button",
                class: "btn btn-secondary me-2",
                "data-bs-dismiss": "modal",
              },
              req.__("Close")
            ),
            button(
              {
                type: "submit",
                class: "btn btn-primary",
                onClick: "press_store_button(this)",
              },
              req.__("Install")
            )
          )
        ) +
          script(
            domReady(`
document.getElementById('tag_select').addEventListener('change', () => {
  const version = document.getElementById('tag_select').value;
  if (version) document.getElementById('version_select').value = version;
});
document.getElementById('version_select').addEventListener('change', () => {
  document.getElementById('tag_select').value = '';
});
`)
          )
      );
    } catch (error) {
      getState().log(
        2,
        `GET /install_dialog: ${error.message || "unknown error"}`
      );
      return res.status(500).json({ error: error.message || "unknown error" });
    }
  })
);

const cleanNodeModules = async () => {
  const topSaltcornDir = path.join(__dirname, "..", "..", "..", "..", "..");
  if (path.basename(topSaltcornDir) === "@saltcorn")
    await fs.promises.rm(topSaltcornDir, { recursive: true, force: true });
  else
    throw new Error(
      `'${topSaltcornDir}' is not a Saltcorn installation directory`
    );
};

const doInstall = async (req, res, version, deepClean, runPull) => {
  if (db.getTenantSchema() !== db.connectObj.default_schema) {
    req.flash("error", req.__("Not possible for tenant"));
    res.redirect("/admin");
  } else {
    res.write(
      version === "latest"
        ? req.__("Starting upgrade, please wait...\n")
        : req.__("Installing %s, please wait...\n", version)
    );
    if (deepClean) {
      res.write(req.__("Cleaning node_modules...\n"));
      try {
        await cleanNodeModules();
      } catch (e) {
        res.write(req.__("Error cleaning node_modules: %s\n", e.message));
      }
    }
    const child = spawn(
      "npm",
      ["install", "-g", `@saltcorn/cli@${version}`, "--unsafe"],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    child.stdout.on("data", (data) => {
      res.write(data);
    });
    child.stderr?.on("data", (data) => {
      res.write(data);
    });
    child.on("exit", async function (code, signal) {
      if (code === 0) {
        if (deepClean) {
          res.write(req.__("Installing sd-notify") + "\n");
          const sdNotifyCode = await tryInstallSdNotify(req, res);
          res.write(
            req.__("sd-notify install done with code %s", sdNotifyCode) + "\n"
          );
        }
        if (runPull) {
          res.write(
            req.__("Pulling the capacitor-builder docker image...") + "\n"
          );
          const pullCode = await pullCapacitorBuilder(req, res, version);
          res.write(req.__("Pull done with code %s", pullCode) + "\n");
          if (pullCode === 0) {
            res.write(req.__("Pruning docker...") + "\n");
            const pruneCode = await pruneDocker(req, res);
            res.write(req.__("Prune done with code %s", pruneCode) + "\n");
          }
        }
      }
      res.end(
        version === "latest"
          ? req.__(
              `Upgrade done (if it was available) with code ${code}.\n\nPress the BACK button in your browser, then RELOAD the page.`
            )
          : req.__(
              `Install done with code ${code}.\n\nPress the BACK button in your browser, then RELOAD the page.`
            )
      );
      setTimeout(() => {
        getState().processSend("RestartServer");
        process.exit(0);
      }, 100);
    });
  }
};

router.post("/install", isAdmin, async (req, res) => {
  const { version, deep_clean } = req.body;
  await doInstall(req, res, version, deep_clean === "on", false);
});

/**
 * Do Upgrade
 * @name post/upgrade
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/upgrade",
  isAdmin,
  error_catcher(async (req, res) => {
    await doInstall(req, res, "latest", false, true);
  })
);
/**
 * Do Check for Update
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
 * Do Manual Backup
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
 * Do Restore from Backup
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
        name: "page_groups",
        label: req.__("Page groups"),
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

router.post(
  "/acq-ssl-tenant/:subdomain",
  isAdmin,
  error_catcher(async (req, res) => {
    if (
      db.is_it_multi_tenant() &&
      db.getTenantSchema() === db.connectObj.default_schema
    ) {
      const { subdomain } = req.params;

      const domain = getBaseDomain();

      let altname = await tenant_letsencrypt_name(subdomain);

      if (!altname || !domain) {
        res.json({ error: "Set Base URL for both tenant and root first." });
        return;
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

        await greenlock.sites.add({
          subject: altname,
          altnames: [altname],
        });
        // letsencrypt
        const tenant_letsencrypt_sites = getState().getConfig(
          "tenant_letsencrypt_sites",
          []
        );
        await getState().setConfig("tenant_letsencrypt_sites", [
          altname,
          ...tenant_letsencrypt_sites,
        ]);

        res.json({
          success: true,
          notify: "Certificate added, please restart server",
        });
      } catch (e) {
        res.json({ error: e.message });
      }
    } else {
      res.json({ error: req.__("Not possible for tenant") });
    }
  })
);

/**
 * Do Enable letsencrypt
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
        const tenant_letsencrypt_sites = getState().getConfig(
          "tenant_letsencrypt_sites",
          []
        );
        await getState().setConfig("tenant_letsencrypt_sites", [
          ...altnames,
          ...tenant_letsencrypt_sites,
        ]);

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
 * Do Clear All
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
 * Do Configuration Check
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
const buildDialogScript = (capacitorBuilderAvailable, isSbadmin2) =>
  `<script>
  var capacitorBuilderAvailable = ${capacitorBuilderAvailable};
  var isSbadmin2 = ${isSbadmin2};
  function showEntrySelect(type) {
    for( const currentType of ["view", "page", "pagegroup"]) {
      const tab = $('#' + currentType + 'NavLinkID');
      const input = $('#' + currentType + 'InputID');
      if (currentType === type) {
        tab.addClass("active");
        input.removeClass("d-none");
        input.addClass("d-block");
        input.attr("name", "entryPoint");
      }
      else {
        tab.removeClass("active");
        input.removeClass("d-block");
        input.addClass("d-none");
        input.removeAttr("name");
      }
    }
    $("#entryPointTypeID").attr("value", type);
  }
  
  const versionPattern = /^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$/;
  ${domReady(`
  const versionInput = document.getElementById('appVersionInputId');
  if (versionInput) {
    versionInput.addEventListener('change', () => {
      const version = versionInput.value;
      if ((version !== '0.0.0' && versionPattern.test(version)) || version === "")
        versionInput.classList.remove('is-invalid');
      else
        versionInput.classList.add('is-invalid');
    });
  }
  else
    console.error('versionInput not found');
`)}
  </script>`;

const imageAvailable = async () => {
  try {
    const image = new Docker().getImage("saltcorn/capacitor-builder");
    await image.inspect();
    return true;
  } catch (e) {
    return false;
  }
};

const checkXcodebuild = () => {
  return new Promise((resolve) => {
    exec("xcodebuild -version", (error, stdout, stderr) => {
      if (error) {
        resolve({ installed: false });
      } else {
        const tokens = stdout.split(" ");
        resolve({
          installed: true,
          version: tokens.length > 1 ? tokens[1] : undefined,
        });
      }
    });
  });
};

const versionMarker = (version) => {
  const tokens = version.split(".");
  const majVers = parseInt(tokens[0]);
  return i({
    id: "versionMarkerId",
    class: `fas ${
      majVers >= 11 ? "fa-check text-success" : "fa-times text-danger"
    }`,
  });
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
    const pageGroups = await PageGroup.find();
    const images = (await File.find({ mime_super: "image" })).filter((image) =>
      image.filename?.endsWith(".png")
    );
    const keystoreFiles = await File.find({ folder: "keystore_files" });
    const provisioningFiles = await File.find({ folder: "provisioning_files" });
    const withSyncInfo = await Table.find({ has_sync_info: true });
    const plugins = (await Plugin.find()).filter(
      (plugin) => ["base", "sbadmin2"].indexOf(plugin.name) < 0
    );
    const pluginsReadyForMobile = plugins
      .filter((plugin) => plugin.ready_for_mobile())
      .map((plugin) => plugin.name);
    const builderSettings =
      getState().getConfig("mobile_builder_settings") || {};
    const dockerAvailable = await imageAvailable();
    const xcodeCheckRes = await checkXcodebuild();
    const xcodebuildAvailable = xcodeCheckRes.installed;
    const xcodebuildVersion = xcodeCheckRes.version;
    const layout = getState().getLayout(req.user);
    const isSbadmin2 = layout === getState().layouts.sbadmin2;
    send_admin_page({
      res,
      req,
      active_sub: "Mobile app",
      headers: [
        {
          headerTag: buildDialogScript(dockerAvailable, isSbadmin2),
        },
        {
          headerTag: `<script>var pluginsReadyForMobile = ${JSON.stringify(
            pluginsReadyForMobile
          )}</script>`,
        },
      ],
      contents: {
        above: [
          {
            type: "card",
            titleAjaxIndicator: true,
            title: req.__("Build mobile app"),
            contents: form(
              {
                action: "/admin/build-mobile-app",
                method: "post",
                onchange: "builderMenuChanged(this)",
                id: "buildMobileAppForm",
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
                  value: builderSettings.entryPointType || "view",
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
                        class: `col-sm-1 fw-bold d-flex justify-content-center ${
                          builderSettings.androidPlatform !== "on"
                            ? "d-none"
                            : ""
                        }`,
                        id: "dockerLabelId",
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
                            {
                              class: `nav-link ${
                                !builderSettings.entryPointType ||
                                builderSettings.entryPointType === "view"
                                  ? "active"
                                  : ""
                              }`,
                              id: "viewNavLinkID",
                            },
                            req.__("View")
                          )
                        ),
                        li(
                          {
                            class: "nav-item",
                            onClick: "showEntrySelect('page')",
                          },
                          div(
                            {
                              class: `nav-link ${
                                builderSettings.entryPointType === "page"
                                  ? "active"
                                  : ""
                              }`,
                              id: "pageNavLinkID",
                            },
                            req.__("Page")
                          ),
                          li(
                            {
                              class: "nav-item",
                              onClick: "showEntrySelect('pagegroup')",
                            },
                            div(
                              {
                                class: `nav-link ${
                                  builderSettings.entryPointType === "pagegroup"
                                    ? "active"
                                    : ""
                                }`,
                                id: "pagegroupNavLinkID",
                              },
                              req.__("Pagegroup")
                            )
                          )
                        )
                      ),
                      // select entry-view
                      select(
                        {
                          class: `form-select ${
                            builderSettings.entryPointType === "page" ||
                            builderSettings.entryPointType === "pagegroup"
                              ? "d-none"
                              : ""
                          }`,
                          ...(!builderSettings.entryPointType ||
                          builderSettings.entryPointType === "view"
                            ? { name: "entryPoint" }
                            : {}),
                          id: "viewInputID",
                        },
                        views
                          .map((view) =>
                            option(
                              {
                                value: view.name,
                                selected:
                                  builderSettings.entryPointType === "view" &&
                                  builderSettings.entryPoint === view.name,
                              },
                              view.name
                            )
                          )
                          .join(",")
                      ),
                      // select entry-page
                      select(
                        {
                          class: `form-select ${
                            !builderSettings.entryPointType ||
                            builderSettings.entryPointType === "view" ||
                            builderSettings.entryPointType === "pagegroup"
                              ? "d-none"
                              : ""
                          }`,
                          ...(builderSettings.entryPointType === "page"
                            ? { name: "entryPoint" }
                            : {}),
                          id: "pageInputID",
                        },
                        pages
                          .map((page) =>
                            option(
                              {
                                value: page.name,
                                selected:
                                  builderSettings.entryPointType === "page" &&
                                  builderSettings.entryPoint === page.name,
                              },
                              page.name
                            )
                          )
                          .join("")
                      ),
                      // select entry-pagegroup
                      select(
                        {
                          class: `form-select ${
                            !builderSettings.entryPointType ||
                            builderSettings.entryPointType === "view" ||
                            builderSettings.entryPointType === "page"
                              ? "d-none"
                              : ""
                          }`,
                          ...(builderSettings.entryPointType === "pagegroup"
                            ? { name: "entryPoint" }
                            : {}),
                          id: "pagegroupInputID",
                        },
                        pageGroups
                          .map((group) =>
                            option(
                              {
                                value: group.name,
                                selected:
                                  builderSettings.entryPointType ===
                                    "pagegroup" &&
                                  builderSettings.entryPoint === group.name,
                              },
                              group.name
                            )
                          )
                          .join("")
                      )
                    ),
                    div(
                      { class: "col-sm-4" },
                      // android
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
                              onClick: "toggle_android_platform()",
                              checked: builderSettings.androidPlatform === "on",
                            })
                          )
                        ),
                        // iOS
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
                              checked: builderSettings.iOSPlatform === "on",
                            })
                          )
                        )
                      )
                    ),
                    // android with docker
                    div(
                      { class: "col-sm-1 d-flex justify-content-center" },
                      input({
                        type: "checkbox",
                        class: "form-check-input",
                        name: "useDocker",
                        id: "dockerCheckboxId",
                        hidden: builderSettings.androidPlatform !== "on",
                        checked: builderSettings.useDocker === "on",
                      })
                    )
                  ),
                  // app name
                  div(
                    { class: "row pb-2" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "appFileInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("App name")
                      ),
                      input({
                        type: "text",
                        class: "form-control",
                        name: "appName",
                        id: "appNameInputId",
                        placeholder: "SaltcornMobileApp",
                        value: builderSettings.appName || "",
                      })
                    )
                  ),
                  // app id
                  div(
                    { class: "row pb-2" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "appIdInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("App ID")
                      ),
                      input({
                        type: "text",
                        class: "form-control",
                        name: "appId",
                        id: "appIdInputId",
                        placeholder: "com.saltcorn.app",
                        value: builderSettings.appId || "",
                      })
                    )
                  ),
                  // app version
                  div(
                    { class: "row pb-2" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "appVersionInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("App version")
                      ),
                      input({
                        type: "text",
                        class: "form-control",
                        name: "appVersion",
                        id: "appVersionInputId",
                        placeholder: "0.0.1",
                        value: builderSettings.appVersion || "",
                      }),
                      div(
                        { class: "invalid-feedback" },
                        req.__(
                          "Please enter a version in the format 'x.y.z' (e.g. 0.0.1 with numbers from 0 to 999) or leave it empty."
                        )
                      )
                    )
                  ),
                  // server url
                  div(
                    { class: "row pb-2" },
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
                        value: builderSettings.serverURL || "",
                        placeholder: getState().getConfig("base_url") || "",
                      })
                    )
                  ),
                  // app icon
                  div(
                    { class: "row pb-2" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "appIconInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("App icon")
                      ),
                      select(
                        {
                          class: "form-select",
                          name: "appIcon",
                          id: "appIconInputId",
                        },
                        [
                          option({ value: "" }, ""),
                          ...images.map((image) =>
                            option(
                              {
                                value: image.location,
                                selected:
                                  builderSettings.appIcon === image.location,
                              },
                              image.filename
                            )
                          ),
                        ].join("")
                      )
                    )
                  ),
                  div(
                    { class: "row pb-3" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "splashPageInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("Splash Page")
                      ),
                      select(
                        {
                          class: "form-select",
                          name: "splashPage",
                          id: "splashPageInputId",
                        },
                        [
                          option({ value: "" }, ""),
                          ...pages.map((page) =>
                            option(
                              {
                                value: page.name,
                                selected:
                                  builderSettings.splashPage === page.name,
                              },
                              page.name
                            )
                          ),
                        ].join("")
                      )
                    )
                  ),
                  // auto public login box
                  div(
                    { class: "row pb-2" },
                    div(
                      { class: "col-sm-4" },
                      input({
                        type: "checkbox",
                        id: "autoPublLoginId",
                        class: "form-check-input me-2",
                        name: "autoPublicLogin",
                        checked: builderSettings.autoPublicLogin === "on",
                      }),
                      label(
                        {
                          for: "autoPublLoginId",
                          class: "form-label",
                        },
                        req.__("Auto public login")
                      )
                    )
                  ),
                  // allow offline mode box
                  div(
                    { class: "row pb-2" },
                    div(
                      { class: "col-sm-4" },
                      input({
                        type: "checkbox",
                        id: "offlineModeBoxId",
                        class: "form-check-input me-2",
                        name: "allowOfflineMode",
                        onClick: "toggle_tbl_sync()",
                        checked: builderSettings.allowOfflineMode === "on",
                      }),
                      label(
                        {
                          for: "offlineModeBoxId",
                          class: "form-label",
                        },
                        req.__("Allow offline mode")
                      )
                    )
                  ),
                  // synched/unsynched tables
                  div(
                    {
                      id: "tblSyncSelectorId",
                      class: "row pb-3",
                      hidden: builderSettings.allowOfflineMode !== "on",
                    },
                    div(
                      label(
                        { class: "form-label fw-bold" },
                        req.__("Table Synchronization")
                      )
                    ),
                    div(
                      { class: "container" },
                      div(
                        { class: "row" },
                        div(
                          { class: "col-sm-4 text-center" },
                          req.__("unsynched")
                        ),
                        div({ class: "col-sm-1" }),
                        div(
                          { class: "col-sm-4 text-center" },
                          req.__("synched")
                        )
                      ),
                      div(
                        { class: "row" },
                        div(
                          { class: "col-sm-4" },
                          select(
                            {
                              id: "unsynched-tbls-select-id",
                              class: "form-control form-select",
                              multiple: true,
                            },
                            withSyncInfo
                              .filter(
                                (table) =>
                                  !builderSettings.synchedTables ||
                                  builderSettings.synchedTables.indexOf(
                                    table.name
                                  ) < 0
                              )
                              .map((table) =>
                                option({
                                  id: `${table.name}_unsynched_opt`,
                                  value: table.name,
                                  label: table.name,
                                })
                              )
                          )
                        ),
                        div(
                          { class: "col-sm-1 d-flex justify-content-center" },
                          div(
                            div(
                              button(
                                {
                                  id: "move-right-btn-id",
                                  type: "button",
                                  onClick: `move_to_synched()`,
                                  class: "btn btn-light pt-1 mb-1",
                                },
                                i({ class: "fas fa-arrow-right" })
                              )
                            ),
                            div(
                              button(
                                {
                                  id: "move-left-btn-id",
                                  type: "button",
                                  onClick: `move_to_unsynched()`,
                                  class: "btn btn-light pt-1",
                                },
                                i({ class: "fas fa-arrow-left" })
                              )
                            )
                          )
                        ),
                        div(
                          { class: "col-sm-4" },
                          select(
                            {
                              id: "synched-tbls-select-id",
                              class: "form-control form-select",
                              multiple: true,
                            },
                            withSyncInfo
                              .filter(
                                (table) =>
                                  builderSettings.synchedTables?.indexOf(
                                    table.name
                                  ) >= 0
                              )
                              .map((table) =>
                                option({
                                  id: `${table.name}_synched_opt`,
                                  value: table.name,
                                  label: table.name,
                                })
                              )
                          )
                        )
                      )
                    )
                  ),
                  // included/excluded plugins
                  div(
                    {
                      id: "pluginsSelectorId",
                      class: "row pb-2",
                    },
                    div(
                      label({ class: "form-label fw-bold" }, req.__("Plugins"))
                    ),
                    div(
                      { class: "container" },
                      div(
                        { class: "row" },
                        div(
                          { class: "col-sm-4 text-center" },
                          req.__("exclude")
                        ),
                        div({ class: "col-sm-1" }),
                        div(
                          { class: "col-sm-4 text-center" },
                          req.__("include")
                        )
                      ),
                      div(
                        { class: "row" },
                        div(
                          { class: "col-sm-4" },
                          select(
                            {
                              id: "excluded-plugins-select-id",
                              class: "form-control form-select",
                              multiple: true,
                            },
                            plugins
                              .filter(
                                (plugin) =>
                                  builderSettings.excludedPlugins?.indexOf(
                                    plugin.name
                                  ) >= 0
                              )
                              .map((plugin) =>
                                option({
                                  id: `${plugin.name}_excluded_opt`,
                                  value: plugin.name,
                                  label: plugin.name,
                                })
                              )
                          )
                        ),
                        div(
                          { class: "col-sm-1 d-flex justify-content-center" },
                          div(
                            div(
                              button(
                                {
                                  id: "move-plugin-right-btn-id",
                                  type: "button",
                                  onClick: `move_plugin_to_included()`,
                                  class: "btn btn-light pt-1 mb-1",
                                },
                                i({ class: "fas fa-arrow-right" })
                              )
                            ),
                            div(
                              button(
                                {
                                  id: "move-plugin-left-btn-id",
                                  type: "button",
                                  onClick: `move_plugin_to_excluded()`,
                                  class: "btn btn-light pt-1",
                                },
                                i({ class: "fas fa-arrow-left" })
                              )
                            )
                          )
                        ),
                        div(
                          { class: "col-sm-4" },
                          select(
                            {
                              id: "included-plugins-select-id",
                              class: "form-control form-select",
                              multiple: true,
                            },
                            plugins
                              .filter(
                                (plugin) =>
                                  !builderSettings.excludedPlugins ||
                                  builderSettings.excludedPlugins.indexOf(
                                    plugin.name
                                  ) < 0
                              )
                              .map((plugin) =>
                                option({
                                  id: `${plugin.name}_included_opt`,
                                  value: plugin.name,
                                  label: plugin.name,
                                })
                              )
                          )
                        )
                      )
                    )
                  ),
                  // build type
                  div(
                    { class: "row pb-3 pt-2" },
                    div(
                      { class: "col-sm-8" },
                      label(
                        {
                          for: "splashPageInputId",
                          class: "form-label fw-bold",
                        },
                        req.__("Build type")
                      ),

                      div(
                        { class: "form-check" },
                        input({
                          type: "radio",
                          id: "debugBuildTypeId",
                          class: "form-check-input me-2",
                          name: "buildType",
                          value: "debug",
                          checked: builderSettings.buildType === "debug",
                        }),
                        label(
                          {
                            for: "debugBuildTypeId",
                            class: "form-label",
                          },
                          req.__("debug")
                        )
                      ),
                      div(
                        { class: "form-check" },
                        input({
                          type: "radio",
                          id: "releaseBuildTypeId",
                          class: "form-check-input me-2",
                          name: "buildType",
                          value: "release",
                          checked:
                            builderSettings.buildType === "release" ||
                            !builderSettings.buildType,
                        }),
                        label(
                          {
                            for: "releaseBuildTypeId",
                            class: "form-label",
                          },
                          req.__("release")
                        )
                      )
                    )
                  ),
                  div(
                    { class: "mt-3 mb-3" },
                    p({ class: "h3 ps-3" }, "Android configuration"),
                    div(
                      { class: "form-group border border-2 p-3 rounded" },

                      div(
                        { class: "row pb-3 pt-2" },
                        div(
                          label(
                            { class: "form-label fw-bold" },
                            req.__("Capacitor builder") +
                              a(
                                {
                                  href: "javascript:ajax_modal('/admin/help/Capacitor Builder?')",
                                },
                                i({ class: "fas fa-question-circle ps-1" })
                              )
                          )
                        ),
                        div(
                          { class: "col-sm-4" },
                          div(
                            {
                              id: "dockerBuilderStatusId",
                              class: "",
                            },
                            dockerAvailable
                              ? span(
                                  req.__("installed"),
                                  i({ class: "ps-2 fas fa-check text-success" })
                                )
                              : span(
                                  req.__("not available"),
                                  i({ class: "ps-2 fas fa-times text-danger" })
                                )
                          )
                        ),
                        div(
                          { class: "col-sm-4" },
                          button(
                            {
                              type: "button",
                              onClick: `pull_capacitor_builder(this);`,
                              class: "btn btn-warning",
                            },
                            req.__("pull")
                          ),
                          span(
                            {
                              role: "button",
                              onClick: "check_capacitor_builder()",
                            },
                            span({ class: "ps-3" }, req.__("refresh")),
                            i({ class: "ps-2 fas fa-undo" })
                          )
                        )
                      ),
                      // keystore file
                      div(
                        { class: "row pb-3" },
                        div(
                          { class: "col-sm-8" },
                          label(
                            {
                              for: "keystoreInputId",
                              class: "form-label fw-bold",
                            },
                            req.__("Keystore File"),
                            a(
                              {
                                href: "javascript:ajax_modal('/admin/help/Android App Signing?')",
                              },
                              i({ class: "fas fa-question-circle ps-1" })
                            )
                          ),
                          select(
                            {
                              class: "form-select",
                              name: "keystoreFile",
                              id: "keystoreInputId",
                            },
                            [
                              option({ value: "" }, ""),
                              ...keystoreFiles.map((file) =>
                                option(
                                  {
                                    value: file.location,
                                    selected:
                                      builderSettings.keystoreFile ===
                                      file.location,
                                  },
                                  file.filename
                                )
                              ),
                            ].join("")
                          )
                        )
                      ),
                      // keystore alias
                      div(
                        { class: "row pb-2" },
                        div(
                          { class: "col-sm-8" },
                          label(
                            {
                              for: "keystoreAliasInputId",
                              class: "form-label fw-bold",
                            },
                            req.__("Keystore Alias")
                          ),
                          input({
                            type: "text",
                            class: "form-control",
                            name: "keystoreAlias",
                            id: "keystoreAliasInputId",
                            value: builderSettings.keystoreAlias || "",
                            placeholder: "",
                          })
                        )
                      ),
                      // keystore password
                      div(
                        { class: "row pb-2" },
                        div(
                          { class: "col-sm-8" },
                          label(
                            {
                              for: "keystorePasswordInputId",
                              class: "form-label fw-bold",
                            },
                            req.__("Keystore Password")
                          ),
                          input({
                            type: "password",
                            class: "form-control",
                            name: "keystorePassword",
                            id: "keystorePasswordInputId",
                            value: "",
                            placeholder: "",
                          })
                        )
                      )
                    )
                  ),
                  div(
                    { class: "mt-3" },
                    p({ class: "h3 ps-3 mt-3" }, "iOS Configuration"),
                    div(
                      { class: "form-group border border-2 p-3 rounded" },
                      div(
                        { class: "mb-3" },
                        div(
                          { class: "row pb-3 pt-2" },
                          div(
                            label(
                              { class: "form-label fw-bold" },
                              req.__("xcodebuild") +
                                a(
                                  {
                                    href: "javascript:ajax_modal('/admin/help/xcodebuild?')",
                                  },
                                  i({ class: "fas fa-question-circle ps-1" })
                                )
                            )
                          ),
                          div(
                            { class: "col-sm-4" },
                            div(
                              {
                                id: "xcodebuildStatusId",
                                class: "",
                              },
                              xcodebuildAvailable
                                ? span(
                                    req.__("installed"),
                                    i({
                                      class: "ps-2 fas fa-check text-success",
                                    })
                                  )
                                : span(
                                    req.__("not available"),
                                    i({
                                      class: "ps-2 fas fa-times text-danger",
                                    })
                                  )
                            )
                          ),
                          div(
                            { class: "col-sm-4" },
                            // not sure if we should provide this
                            // button(
                            //   {
                            //     id: "installXCodeBtnId",
                            //     type: "button",
                            //     onClick: `install_xcode(this);`,
                            //     class: "btn btn-warning",
                            //   },
                            //   req.__("install")
                            // ),
                            span(
                              {
                                role: "button",
                                onClick: "check_xcodebuild()",
                              },
                              span({ class: "ps-3" }, req.__("refresh")),
                              i({ class: "ps-2 fas fa-undo" })
                            )
                          )
                        ),
                        div(
                          {
                            class: `row mb-3 pb-3 ${
                              xcodebuildAvailable ? "" : "d-none"
                            }`,
                            id: "xcodebuildVersionBoxId",
                          },
                          div(
                            { class: "col-sm-4" },
                            span(
                              req.__("Version") +
                                span(
                                  { id: "xcodebuildVersionId", class: "pe-2" },
                                  `: ${xcodebuildVersion || "unknown"}`
                                ),
                              versionMarker(xcodebuildVersion || "0")
                            )
                          )
                        )
                      ),
                      // provisioning profile file
                      div(
                        { class: "row pb-3" },
                        div(
                          { class: "col-sm-8" },
                          label(
                            {
                              for: "provisioningProfileInputId",
                              class: "form-label fw-bold",
                            },
                            req.__("Provisioning Profile"),
                            a(
                              {
                                href: "javascript:ajax_modal('/admin/help/Provisioning Profile?')",
                              },
                              i({ class: "fas fa-question-circle ps-1" })
                            )
                          ),
                          select(
                            {
                              class: "form-select",
                              name: "provisioningProfile",
                              id: "provisioningProfileInputId",
                            },
                            [
                              option({ value: "" }, ""),
                              ...provisioningFiles.map((file) =>
                                option(
                                  {
                                    value: file.location,
                                    selected:
                                      builderSettings.provisioningProfile ===
                                      file.location,
                                  },
                                  file.filename
                                )
                              ),
                            ].join("")
                          )
                        )
                      )
                      // Share Extension provisioning profile
                      // disabled for now
                      // div(
                      //   { class: "row pb-3" },
                      //   div(
                      //     { class: "col-sm-8" },
                      //     label(
                      //       {
                      //         for: "shareProvisioningProfileInputId",
                      //         class: "form-label fw-bold",
                      //       },
                      //       req.__("Share Extension Provisioning Profile"),
                      //       a(
                      //         {
                      //           href: "javascript:ajax_modal('/admin/help/Provisioning Profile?')",
                      //         },
                      //         i({ class: "fas fa-question-circle ps-1" })
                      //       )
                      //     ),
                      //     select(
                      //       {
                      //         class: "form-select",
                      //         name: "shareProvisioningProfile",
                      //         id: "shareProvisioningProfileInputId",
                      //       },
                      //       [
                      //         option({ value: "" }, ""),
                      //         ...provisioningFiles.map((file) =>
                      //           option(
                      //             {
                      //               value: file.location,
                      //               selected:
                      //                 builderSettings.shareProvisioningProfile ===
                      //                 file.location,
                      //             },
                      //             file.filename
                      //           )
                      //         ),
                      //       ].join("")
                      //     )
                      //   )
                      // )
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

const checkFiles = async (outDirName, fileNames) => {
  const rootFolder = await File.rootFolder();
  const outDir = path.join(rootFolder.location, "mobile_app", outDirName);
  const unsafeFiles = await Promise.all(
    fs
      .readdirSync(outDir)
      .map(async (outFile) => await File.from_file_on_disk(outFile, outDir))
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
    const { out_dir_name, mode } = req.query;
    const stepDesc =
      mode === "prepare"
        ? "_prepare_step"
        : mode === "finish"
        ? "_finish_step"
        : "";
    res.json({
      finished: await checkFiles(out_dir_name, [
        `logs${stepDesc}.txt`,
        `error_logs${stepDesc}.txt`,
      ]),
    });
  })
);

const validateBuildDirName = (buildDirName) => {
  // ensure characters
  if (!/^[a-zA-Z0-9_-]+$/.test(buildDirName)) {
    getState().log(
      4,
      `Invalid characters in build directory name '${buildDirName}'`
    );
    return false;
  }
  // ensure format is 'build_1234567890'
  if (!/^build_\d+$/.test(buildDirName)) {
    getState().log(4, `Invalid build directory name format '${buildDirName}'`);
    return false;
  }
  return true;
};

const validateBuildDir = (buildDir, rootPath) => {
  const resolvedBuildDir = path.resolve(buildDir);
  if (!resolvedBuildDir.startsWith(path.join(rootPath, "mobile_app"))) {
    getState().log(4, `Invalid build directory path '${buildDir}'`);
    return false;
  }
  return true;
};

router.get(
  "/build-mobile-app/result",
  isAdmin,
  error_catcher(async (req, res) => {
    const { out_dir_name, build_dir, mode } = req.query;
    if (!validateBuildDirName(out_dir_name)) {
      return res.sendWrap(req.__(`Admin`), {
        above: [
          {
            type: "card",
            title: req.__("Build Result"),
            contents: div(req.__("Invalid build directory name")),
          },
        ],
      });
    }
    const rootFolder = await File.rootFolder();
    const buildDir = path.join(rootFolder.location, "mobile_app", out_dir_name);
    if (!validateBuildDir(buildDir, rootFolder.location)) {
      return res.sendWrap(req.__(`Admin`), {
        above: [
          {
            type: "card",
            title: req.__("Build Result"),
            contents: div(req.__("Invalid build directory path")),
          },
        ],
      });
    }

    const files = await Promise.all(
      fs
        .readdirSync(buildDir)
        .map(async (outFile) => await File.from_file_on_disk(outFile, buildDir))
    );
    const stepDesc =
      mode === "prepare"
        ? "_prepare_step"
        : mode === "finish"
        ? "_finish_step"
        : "";
    const resultMsg = files.find(
      (file) => file.filename === `logs${stepDesc}.txt`
    )
      ? req.__("The build was successfully")
      : req.__("Unable to build the app");
    res.sendWrap(req.__(`Admin`), {
      above: [
        {
          type: "card",
          title: req.__("Build Result"),
          contents: div(resultMsg),
        },
        files.length > 0 ? app_files_table(files, out_dir_name, req) : "",
        mode === "prepare"
          ? intermediate_build_result(out_dir_name, build_dir, req)
          : "",
      ],
    });
  })
);

router.post(
  "/build-mobile-app/finish",
  isAdmin,
  error_catcher(async (req, res) => {
    const { out_dir_name, build_dir } = req.body;
    const content = await fs.promises.readFile(
      path.join(build_dir, "spawnParams.json")
    );
    const spawnParams = JSON.parse(content);
    const rootFolder = await File.rootFolder();
    const outDirFullPath = path.join(
      rootFolder.location,
      "mobile_app",
      out_dir_name
    );
    res.json({
      success: true,
    });
    const child = spawn(
      getSafeSaltcornCmd(),
      [...spawnParams, "-m", "finish"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: ".",
      }
    );
    const childOutputs = [];
    child.stdout.on("data", (data) => {
      const outMsg = data.toString();
      getState().log(5, outMsg);
      if (data) childOutputs.push(outMsg);
    });
    child.stderr.on("data", (data) => {
      const errMsg = data ? data.toString() : req.__("An error occurred");
      getState().log(5, errMsg);
      childOutputs.push(errMsg);
    });
    child.on("exit", async (exitCode, signal) => {
      const logFile =
        exitCode === 0 ? "logs_finish_step.txt" : "error_logs_finish_step.txt";
      try {
        const exitMsg = childOutputs.join("\n");
        await fs.promises.writeFile(
          path.join(outDirFullPath, logFile),
          exitMsg
        );
        await File.set_xattr_of_existing_file(
          logFile,
          outDirFullPath,
          req.user
        );
      } catch (error) {
        console.log(`unable to write '${logFile}' to '${outDirFullPath}'`);
        console.log(error);
      }
    });
    child.on("error", (msg) => {
      const message = msg.message ? msg.message : msg.code;
      const stack = msg.stack ? msg.stack : "";
      const logFile = "error_logs.txt";
      const errMsg = [message, stack].join("\n");
      getState().log(5, msg);
      fs.writeFile(
        path.join(outDirFullPath, "error_logs.txt"),
        errMsg,
        async (error) => {
          if (error) {
            console.log(`unable to write logFile to '${outDirFullPath}'`);
            console.log(error);
          } else {
            // no transaction, '/build-mobile-app/finished' filters for valid attributes
            await File.set_xattr_of_existing_file(
              logFile,
              outDirFullPath,
              req.user
            );
          }
        }
      );
    });
  })
);

/**
 * Do Build Mobile App
 */
router.post(
  "/build-mobile-app",
  isAdmin,
  error_catcher(async (req, res) => {
    getState().log(2, `starting mobile build: ${JSON.stringify(req.body)}`);
    const msgs = [];
    let mode = "full";
    let {
      entryPoint,
      entryPointType,
      androidPlatform,
      iOSPlatform,
      useDocker,
      appName,
      appId,
      appVersion,
      appIcon,
      serverURL,
      splashPage,
      autoPublicLogin,
      allowOfflineMode,
      synchedTables,
      includedPlugins,
      provisioningProfile,
      shareProvisioningProfile,
      buildType,
      keystoreFile,
      keystoreAlias,
      keystorePassword,
    } = req.body;
    // const receiveShareTriggers = Trigger.find({
    //   when_trigger: "ReceiveMobileShareData",
    // });
    // disabeling share to support for now
    let allowShareTo = false; // receiveShareTriggers.length > 0;
    if (allowShareTo && iOSPlatform && !shareProvisioningProfile) {
      allowShareTo = false;
      msgs.push({
        type: "warning",
        text: req.__(
          "A ReceiveMobileShareData trigger exists, but no Share Extension Provisioning Profile is provided. " +
            "Building without share to support."
        ),
      });
    }
    if (!includedPlugins) includedPlugins = [];
    if (!synchedTables) synchedTables = [];
    if (!entryPoint) {
      return res.json({
        error: req.__("Please select an entry point."),
      });
    }
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
    if (!serverURL || serverURL.length === 0) {
      serverURL = getState().getConfig("base_url") || "";
    }
    if (!serverURL.startsWith("http")) {
      return res.json({
        error: req.__("Please enter a valid server URL."),
      });
    }
    if (
      (appVersion && !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(appVersion)) ||
      appVersion === "0.0.0"
    ) {
      return res.json({
        error: req.__(
          "Please enter a version in the format 'x.y.z' (e.g. 0.0.1 with numbers from 0 to 999) or leave it empty."
        ),
      });
    }
    if (iOSPlatform) {
      if (!provisioningProfile)
        return res.json({
          error: req.__(
            "Please provide a Provisioning Profile for the iOS build."
          ),
        });
    }
    if (buildType === "debug" && keystoreFile) {
      msgs.push({
        type: "warning",
        text: req.__("Keystore file is not applied for debug builds."),
      });
    }

    if (
      buildType === "release" &&
      keystoreFile &&
      (!keystoreAlias || !keystorePassword)
    ) {
      return res.json({
        error: req.__(
          "Please provide the keystore alias and password for the android build."
        ),
      });
    }
    const outDirName = `build_${new Date().valueOf()}`;
    const buildDir = `${os.userInfo().homedir}/mobile_app_build`;
    const rootFolder = await File.rootFolder();
    const outDir = path.join(rootFolder.location, "mobile_app", outDirName);
    await File.new_folder(outDirName, "/mobile_app");
    const spawnParams = [
      "build-app",
      "-e",
      entryPoint,
      "-t",
      entryPointType === "pagegroup" ? "page" : entryPointType,
      "-c",
      outDir,
      "-b",
      buildDir,
      "-u",
      req.user.email, // ensured by isAdmin
    ];
    if (useDocker) spawnParams.push("-d");
    if (androidPlatform) spawnParams.push("-p", "android");
    if (iOSPlatform) {
      spawnParams.push(
        "-p",
        "ios",
        "--provisioningProfile",
        provisioningProfile
      );
      if (allowShareTo) {
        mode = "prepare";
        spawnParams.push(
          "--shareExtensionProvisioningProfile",
          shareProvisioningProfile
        );
      }
    }
    if (appName) spawnParams.push("--appName", appName);
    if (appId) spawnParams.push("--appId", appId);
    if (appVersion) spawnParams.push("--appVersion", appVersion);
    if (appIcon) spawnParams.push("--appIcon", appIcon);
    if (serverURL) spawnParams.push("-s", serverURL);
    if (splashPage) spawnParams.push("--splashPage", splashPage);
    if (allowOfflineMode) spawnParams.push("--allowOfflineMode");
    if (allowShareTo) spawnParams.push("--allowShareTo");
    if (autoPublicLogin) spawnParams.push("--autoPublicLogin");
    if (synchedTables.length > 0)
      spawnParams.push("--synchedTables", ...synchedTables.map((tbl) => tbl));
    if (includedPlugins.length > 0)
      spawnParams.push(
        "--includedPlugins",
        ...includedPlugins.map((pluginName) => pluginName)
      );
    if (
      db.is_it_multi_tenant() &&
      db.getTenantSchema() !== db.connectObj.default_schema
    ) {
      spawnParams.push("--tenantAppName", db.getTenantSchema());
    }

    if (buildType) spawnParams.push("--buildType", buildType);
    if (keystoreFile) spawnParams.push("--androidKeystore", keystoreFile);
    if (keystoreAlias)
      spawnParams.push("--androidKeyStoreAlias", keystoreAlias);
    if (keystorePassword)
      spawnParams.push("--androidKeystorePassword", keystorePassword);
    // end http call, return the out directory name, the build directory path and the mode
    // the gui polls for results
    res.json({
      out_dir_name: outDirName,
      build_dir: buildDir,
      mode: mode,
      msgs,
    });
    const child = spawn(getSafeSaltcornCmd(), [...spawnParams, "-m", mode], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ".",
    });
    const childOutputs = [];
    child.stdout.on("data", (data) => {
      const outMsg = data.toString();
      getState().log(5, outMsg);
      if (data) childOutputs.push(outMsg);
    });
    child.stderr.on("data", (data) => {
      const errMsg = data ? data.toString() : req.__("An error occurred");
      getState().log(5, errMsg);
      childOutputs.push(errMsg);
    });
    child.on("exit", async (exitCode, signal) => {
      if (mode === "prepare" && exitCode === 0) {
        try {
          fs.promises.writeFile(
            path.join(buildDir, "spawnParams.json"),
            JSON.stringify(spawnParams)
          );
        } catch (error) {
          console.log(`unable to write spawnParams to '${buildDir}'`);
          console.log(error);
        }
      }
      const stepDesc = mode === "prepare" ? "_prepare_step" : "";
      const logFile =
        exitCode === 0 ? `logs${stepDesc}.txt` : `error_logs${stepDesc}.txt`;
      try {
        const exitMsg = childOutputs.join("\n");
        await fs.promises.writeFile(path.join(outDir, logFile), exitMsg);
        await File.set_xattr_of_existing_file(logFile, outDir, req.user);
      } catch (error) {
        console.log(`unable to write '${logFile}' to '${outDir}'`);
        console.log(error);
      }
    });
    child.on("error", (msg) => {
      const message = msg.message ? msg.message : msg.code;
      const stack = msg.stack ? msg.stack : "";
      const logFile = "error_logs.txt";
      const errMsg = [message, stack].join("\n");
      getState().log(5, msg);
      fs.writeFile(
        path.join(outDir, "error_logs.txt"),
        errMsg,
        async (error) => {
          if (error) {
            console.log(`unable to write logFile to '${outDir}'`);
            console.log(error);
          } else {
            // no transaction, '/build-mobile-app/finished' filters for valid attributes
            await File.set_xattr_of_existing_file(logFile, outDir, req.user);
          }
        }
      );
    });
  })
);

router.post(
  "/mobile-app/pull-capacitor-builder",
  isAdmin,
  error_catcher(async (req, res) => {
    const state = getState();
    const child = spawn(
      `${process.env.DOCKER_BIN ? `${process.env.DOCKER_BIN}/` : ""}docker`,
      ["pull", `saltcorn/capacitor-builder:${state.scVersion}`],
      {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: ".",
      }
    );
    child.stdout.on("data", (data) => {
      state.log(5, data.toString());
    });
    child.stderr.on("data", (data) => {
      state.log(1, data.toString());
    });
    child.on("exit", (exitCode, signal) => {
      state.log(
        2,
        `"pull capacitor-builder exit with code: ${exitCode} and signal: ${signal}`
      );
    });
    child.on("error", (msg) => {
      state.log(1, `pull capacitor-builder error: ${msg}`);
    });

    res.json({});
  })
);

router.get(
  "/mobile-app/check-capacitor-builder",
  isAdmin,
  error_catcher(async (req, res) => {
    const installed = await imageAvailable();
    res.json({ installed });
  })
);

router.get(
  "/mobile-app/check-xcodebuild",
  isAdmin,
  error_catcher(async (req, res) => {
    res.json(await checkXcodebuild());
  })
);

router.post(
  "/mobile-app/save-config",
  isAdmin,
  error_catcher(async (req, res) => {
    try {
      const newCfg = { ...req.body };
      const excludedPlugins = (await Plugin.find())
        .filter(
          (plugin) =>
            ["base", "sbadmin2"].indexOf(plugin.name) < 0 &&
            (newCfg.includedPlugins || []).indexOf(plugin.name) < 0
        )
        .map((plugin) => plugin.name);
      newCfg.excludedPlugins = excludedPlugins;
      await getState().setConfig("mobile_builder_settings", newCfg);
      res.json({ success: true });
    } catch (e) {
      getState().log(1, `Unable to save mobile builder config: ${e.message}`);
      res.json({ error: e.message });
    }
  })
);

/**
 * Do Clear All
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/clear-all",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = clearAllForm(req);
    form.validate(req.body);
    //order: page_groups, pages, views, user fields, tableconstraints, fields, table triggers, table history, tables, plugins, config+crashes+nontable triggers, users
    if (form.values.page_groups) {
      await PageGroup.delete({});
    }
    if (form.values.pages) {
      await db.deleteWhere("_sc_tag_entries", { not: { page_id: null } });
      await db.deleteWhere("_sc_pages");
    }
    if (form.values.views) {
      await View.delete({});
    }
    //user fields
    const users = Table.findOne({ name: "users" });
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
    if (form.values.triggers) {
      await db.deleteWhere("_sc_tag_entries", { not: { trigger_id: null } });
      await db.deleteWhere("_sc_triggers");
      await getState().refresh_triggers();
    }
    if (form.values.tables) {
      await db.deleteWhere("_sc_table_constraints");
      await db.deleteWhere("_sc_model_instances");
      await db.deleteWhere("_sc_models");

      const tables = await Table.find();

      for (const table of tables) {
        await db.deleteWhere("_sc_triggers", {
          table_id: table.id,
        });
        await table.update({ ownership_field_id: null });
        const fields = table.getFields();
        if (!table.extername && !table.provider_name)
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
      await db.deleteWhere("_sc_notifications");

      const users1 = Table.findOne({ name: "users" });
      const userfields1 = await users1.getFields();

      for (const f of userfields1) {
        if (f.name !== "email" && f.name !== "id" && f.name !== "role_id")
          await f.delete();
      }
      await db.deleteWhere("users");
      await db.deleteWhere("_sc_roles", {
        not: { id: { in: [1, 40, 80, 100] } },
      });
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

router.get(
  "/dev/logs_viewer",
  isAdmin,
  error_catcher(async (req, res) => {
    return send_admin_page({
      res,
      req,
      active_sub: "Development",
      contents: {
        above: [
          {
            type: "card",
            id: "server-logs-card-id",
            title: req.__("Server logs"),
            titleErrorInidicator: true,
            contents: mkTable(
              [
                {
                  label: req.__("Timestamp"),
                  width: "15%",
                },
                { label: req.__("Message") },
              ],
              [],
              {
                pagination: {
                  current_page: 1,
                  pages: 1,
                  get_page_link: () => "logViewerHelpers.goToLogsPage(1)",
                },
                tableId: "_sc_logs_tbl_id_",
              }
            ),
          },
          script({
            src: `/static_assets/${db.connectObj.version_tag}/socket.io.min.js`,
          }),
          script({ src: "/log_viewer_utils.js" }),
          script(domReady(`logViewerHelpers.init_log_socket();`)),
        ],
      },
    });
  })
);

/**
 * Dev / Admin
 */
admin_config_route({
  router,
  path: "/dev",
  super_path: "/admin",
  flash: "Development mode settings updated",
  async get_form(req) {
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
        "log_ip_address",
        "log_level",
        ...(isRoot || tenants_set_npm_modules ? ["npm_available_js_code"] : []),
      ],
      action: "/admin/dev",
    });
  },
  response(form, req, res) {
    const code_pages = getState().getConfig("function_code_pages", {});
    send_admin_page({
      res,
      req,
      active_sub: "Development",
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Development settings"),
            titleAjaxIndicator: true,
            contents: [renderForm(form, req.csrfToken())],
          },
          {
            type: "card",
            title: req.__("Runtime informations"),
            contents: [
              div(
                { class: "row form-group" },
                a(
                  { class: "d-block", href: "dev/logs_viewer" },
                  req.__("open logs viewer")
                ),
                i("Open a log viewer for the current server messages")
              ),
            ],
          },
          {
            type: "card",
            title: req.__("Constants and function code"),
            contents: [
              div(
                Object.keys(code_pages)
                  .map((k) =>
                    a(
                      {
                        href: `/admin/edit-codepage/${encodeURIComponent(k)}`,
                        class: "",
                      },
                      k
                    )
                  )
                  .join(" | "),
                button(
                  {
                    class: "btn btn-secondary btn-sm d-block mt-2",
                    onclick: `location.href='/admin/edit-codepage/'+prompt('Name of the new page')`,
                  },
                  i({ class: "fas fa-plus me-1" }),
                  "Add page"
                )
              ),
            ],
          },
        ],
      },
    });
  },
});

router.get(
  "/edit-codepage/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const code_pages = getState().getConfig("function_code_pages", {});
    const existing = code_pages[name] || "";
    const form = new Form({
      action: `/admin/edit-codepage/${encodeURIComponent(name)}`,
      onChange: "saveAndContinue(this)",
      values: { code: existing },
      noSubmitButton: true,
      labelCols: 0,
      additionalButtons: [
        {
          label: req.__("Delete code page"),
          class: "btn btn-outline-danger btn-sm",
          onclick: `if(confirm('Are you sure you would like to delete this code page?'))ajax_post('/admin/delete-codepage/${encodeURIComponent(
            name
          )}')`,
        },
      ],
      fields: [
        {
          name: "code",
          form_name: "code",
          label: "Code",
          sublabel:
            "Only functions declared as <code>function name(...) {...}</code> or <code>async function name(...) {...}</code> will be available in formulae and code actions. Declare a constant <code>k</code> as <code>globalThis.k = ...</code> In scope: " +
            a(
              {
                href: "https://saltcorn.github.io/saltcorn/classes/_saltcorn_data.models.Table-1.html",
                target: "_blank",
              },
              "Table"
            ),
          input_type: "code",
          attributes: { mode: "text/javascript" },
          class: "validate-statements",
          validator(s) {
            try {
              let AsyncFunction = Object.getPrototypeOf(
                async function () {}
              ).constructor;
              AsyncFunction(s);
              return true;
            } catch (e) {
              return e.message;
            }
          },
        },
      ],
    });
    const function_code_pages_tags = getState().getConfigCopy(
      "function_code_pages_tags",
      {}
    );
    const tags = await Tag.find();
    const tagMarkup = div(
      "Tags:",
      (function_code_pages_tags[name] || []).map((tagnm) =>
        span(
          {
            class: ["ms-2 badge bg-secondary"],
          },
          tagnm,
          a(
            {
              onclick: `rm_cp_tag('${tagnm}')`,
            },
            i({ class: "ms-1 fas fa-lg fa-times" })
          )
        )
      ),
      span(
        { class: "dropdown", id: `ddcodetags` },
        span(
          {
            class: ["ms-2 badge", "bg-secondary", "dropdown-toggle"],
            "data-bs-toggle": "dropdown",
            "aria-haspopup": "true",
            "aria-expanded": "false",
          },
          i({ class: "fas fa-lg fa-plus" })
        ),
        div(
          { class: "dropdown-menu", "aria-labelledby": "ddcodetags" },
          tags
            .map((t) =>
              a(
                {
                  class: "dropdown-item",
                  onclick: `add_cp_tag('${t.name}')`,
                },
                t.name
              )
            )
            .join("")
        )
      ),
      script(`function add_cp_tag(nm) {
        ajax_post("/admin/add-codepage-tag/${encodeURIComponent(
          name
        )}/"+encodeURIComponent(nm))
      }
      function rm_cp_tag(nm) {
        ajax_post("/admin/rm-codepage-tag/${encodeURIComponent(
          name
        )}/"+encodeURIComponent(nm))
      }`)
    );
    send_admin_page({
      res,
      req,
      page_title: req.__(`%s code page`, name),
      active_sub: "Development",
      sub2_page: req.__(`%s code page`, name),
      contents: {
        type: "card",
        title: req.__(`%s code page`, name),
        contents: [renderForm(form, req.csrfToken()), tagMarkup],
      },
    });
  })
);

router.post(
  "/edit-codepage/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const code_pages = getState().getConfigCopy("function_code_pages", {});

    const code = req.body.code;
    await getState().setConfig("function_code_pages", {
      ...code_pages,
      [name]: code,
    });
    await getState().refresh_codepages();

    res.json({ success: true });
  })
);
router.post(
  "/delete-codepage/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const code_pages = getState().getConfigCopy("function_code_pages", {});
    delete code_pages[name];
    await getState().setConfig("function_code_pages", code_pages);
    await getState().refresh_codepages();

    res.json({ goto: `/admin/dev` });
  })
);
router.post(
  "/add-codepage-tag/:cpname/:tagnm",
  isAdmin,
  error_catcher(async (req, res) => {
    const { cpname, tagnm } = req.params;
    const function_code_pages_tags = getState().getConfigCopy(
      "function_code_pages_tags",
      {}
    );

    function_code_pages_tags[cpname] = [
      ...(function_code_pages_tags[cpname] || []),
      tagnm,
    ];
    await getState().setConfig(
      "function_code_pages_tags",
      function_code_pages_tags
    );

    res.json({ reload_page: true });
  })
);
router.post(
  "/rm-codepage-tag/:cpname/:tagnm",
  isAdmin,
  error_catcher(async (req, res) => {
    const { cpname, tagnm } = req.params;
    const function_code_pages_tags = getState().getConfigCopy(
      "function_code_pages_tags",
      {}
    );

    function_code_pages_tags[cpname] = (
      function_code_pages_tags[cpname] || []
    ).filter((t) => t != tagnm);

    await getState().setConfig(
      "function_code_pages_tags",
      function_code_pages_tags
    );

    res.json({ reload_page: true });
  })
);
/**
 * Notifications
 */
admin_config_route({
  router,
  path: "/notifications",
  super_path: "/admin",
  field_names: [
    "notification_in_menu",
    { section_header: "Progressive Web Application" },
    "pwa_enabled",
    { name: "pwa_display", showIf: { pwa_enabled: true } },
    {
      name: "pwa_share_to_enabled",
      showIf: { pwa_enabled: true },
    },
    { name: "pwa_set_colors", showIf: { pwa_enabled: true } },
    {
      name: "pwa_theme_color",
      showIf: { pwa_enabled: true, pwa_set_colors: true },
    },
    {
      name: "pwa_background_color",
      showIf: { pwa_enabled: true, pwa_set_colors: true },
    },
    {
      name: "pwa_icons",
      showIf: { pwa_enabled: true },
    },
  ],
  response(form, req, res) {
    send_admin_page({
      res,
      req,
      active_sub: "Notifications",
      contents: {
        type: "card",
        title: req.__("Notification settings"),
        titleAjaxIndicator: true,
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  },
});
