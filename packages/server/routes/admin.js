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
  isAdminOrHasConfigMinRole,
  checkEditPermission,
  addOnDoneRedirect,
  is_relative_url,
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
const { identifiersInCodepage } = require("@saltcorn/data/models/expression");
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
  img,
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
const {
  getMailTransport,
  getOauth2Client,
} = require("@saltcorn/data/models/email");
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
  sleep,
  dataModulePath,
  imageAvailable,
} = require("@saltcorn/data/utils");
const stream = require("stream");
const Crash = require("@saltcorn/data/models/crash");
const { get_help_markup } = require("../help/index.js");
const npmFetch = require("npm-registry-fetch");
const Tag = require("@saltcorn/data/models/tag");
const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer.js");
const TableConstraint = require("@saltcorn/data/models/table_constraints");
const MarkdownIt = require("markdown-it"),
  md = new MarkdownIt();
const semver = require("semver");
const { dbCommonModulePath } = require("@saltcorn/db-common/internal");

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

const tutorial_step = (
  stepNumber,
  headline,
  description,
  imageName,
  imageWidth = "100%",
  footer = ""
) => {
  return div(
    {
      class: "tutorial-step mb-4 p-3",
      style: "border:1px solid #ddd; border-radius:8px; background:#fafafa;",
    },
    h5({ style: "margin-bottom:10px;" }, `Step ${stepNumber}: ${headline}`),
    p(description),
    img({
      src: `/static_assets/${db.connectObj.version_tag}/ios_share_tutorial/${imageName}`,
      style: `max-width:${imageWidth}; border:1px solid #ccc; border-radius:6px;`,
    }),
    footer ? p({ class: "fst-italic mt-3 mb-1" }, footer) : ""
  );
};

const intermediate_build_result = (outDirName, buildDir, req, appFilesTbl) => {
  return div(
    h3("Intermediate build result"),
    div(
      { class: "mb-3" },
      "The build has paused because the Share To feature is enabled for iOS. " +
        "Before continuing, a few additional configurations must be completed in the Xcode IDE. " +
        "Please follow the steps shown in the screenshots below."
    ),

    p(
      { class: "h5 ps-1 mt-3" },
      button(
        {
          class: "btn btn-outline-secondary p-1 me-2",
          type: "button",
          "data-bs-toggle": "collapse",
          "data-bs-target": "#xCodeStepsId",
          "aria-expanded": "true",
          "aria-controls": "xCodeStepsId",
        },
        i({ class: "fas fa-chevron-down" })
      ) + "Steps to configure the Xcode project"
    ),

    div(
      {
        class: "form-group border border-2 p-3 rounded collapse show",
        id: "xCodeStepsId",
      },

      tutorial_step(
        1,
        "Open existing Xcode project",
        "Open Xcode and click 'Open Existing Project':",
        "01_xcode_open_exisiting.png",
        "50%"
      ),
      tutorial_step(
        2,
        "Locate xcworkspace file",
        "Open the 'App.xcworkspace' file. It should be located in <code>/YOUR_HOME_DIR/mobile_app_build/ios/App/App</code>:",
        "02_open_xc_ws_file.png",
        "50%"
      ),
      tutorial_step(
        3,
        "Open add share extension target",
        "In Xcode, click <strong>File → New → Target</strong>. " +
          "In the dialog that appears, select <strong>Share Extension</strong> and proceed:",
        "03_share_extension_dialog.png",
        "50%"
      ),
      tutorial_step(
        4,
        "Add share extension target",
        "Enter <strong>share-ext</strong> as the product name, select your your Team Id and proceed:",
        "04_share_extension_dialog_b.png",
        "50%"
      ),
      tutorial_step(
        5,
        "Activate the new target",
        "Click <strong>Activate</strong>:",
        "05_activate.png",
        "50%"
      ),
      tutorial_step(
        6,
        "Locate target in project navigator",
        "The <strong>share-ext</strong> target should be visible in the navigator on the left:",
        "06_show_new_share_ext_target.png",
        "50%"
      ),
      tutorial_step(
        7,
        "Convert the extension target to a group",
        "Right-click on the <strong>share-ext</strong> target and click <strong>Convert to Group</strong>:",
        "07_convert_to_group.png",
        "50%",
        "Now close Xcode and click <strong>Finish the build</strong>."
      )
    ),
    appFilesTbl,
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
    { section_header: "Updates and module store" },
    "airgap",
    "plugins_store_endpoint",
    "packs_store_endpoint",
    { section_header: "Maintenance mode" },
    "maintenance_mode_enabled",
    "maintenance_mode_page",
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
    "smtp_auth_method",
    "smtp_username",
    { name: "smtp_password", showIf: { smtp_auth_method: "password" } },
    {
      name: "smtp_api_option",
      showIf: {
        smtp_host: "outlook.office365.com",
        smtp_auth_method: "oauth2",
      },
    },
    { name: "smtp_authorize_url", showIf: { smtp_auth_method: "oauth2" } },
    { name: "smtp_token_url", showIf: { smtp_auth_method: "oauth2" } },
    { name: "smtp_redirect_uri", showIf: { smtp_auth_method: "oauth2" } },
    { name: "smtp_client_id", showIf: { smtp_auth_method: "oauth2" } },
    { name: "smtp_client_secret", showIf: { smtp_auth_method: "oauth2" } },
    { name: "smtp_outh_scopes", showIf: { smtp_auth_method: "oauth2" } },
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
              onclick: "spin_action_link(this)",
            },
            req.__("Send test email")
          ),
          a(
            {
              id: "authenticate_oauth",
              href: "/admin/authorize-mail-oauth",
              class: "btn btn-primary ms-2",
              onclick: "spin_action_link(this)",
            },
            req.__("Authorize")
          ),
          script(`
  function authMethodChange(method) {
    const btn = document.getElementById("authenticate_oauth");
    if (method === "oauth2") {
      btn.classList.remove("d-none");
      btn.classList.add("d-inline");
      // get 
    }
    else {
      btn.classList.add("d-none");
      btn.classList.remove("d-inline");
    }

  }
  ${domReady(`
  const authMethod = document.getElementById('inputsmtp_auth_method');
  if (authMethod) {
    const authMethodValue = authMethod.value;
    authMethodChange(authMethodValue);
    authMethod.addEventListener('change', (e) => {
      const authMethod = e.target.value;
      authMethodChange(authMethod);
    });
  }`)}
`),
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
      const sendres = await (await getMailTransport()).sendMail(email);
      getState().log(6, sendres);
      req.flash(
        "success",
        req.__("Email sent to %s with no errors", req.user.email)
      );
    } catch (e) {
      console.error(e);
      req.flash("error", e.message);
    }

    res.redirect("/admin/email");
  })
);

/**
 * do the redirect to the oauth2 provider
 */
router.get(
  "/authorize-mail-oauth",
  isAdmin,
  error_catcher(async (req, res) => {
    const client = getOauth2Client();
    const smtpRedirectUri = getState().getConfig("smtp_redirect_uri");
    const scopes = getState().getConfig("smtp_outh_scopes");
    const scopeArray = scopes.split(" ").map((s) => s.trim());
    const smtpHost = getState().getConfig("smtp_host");

    // Mail.Send SMTP.Send profile openid email https://outlook.office365.com/IMAP.AccessAsUser.All
    const authorizeUrl = client.authorizeURL({
      redirect_uri: smtpRedirectUri,
      scope: scopeArray,
      ...(smtpHost === "smtp.gmail.com"
        ? { access_type: "offline", prompt: "consent" }
        : {}),
    });
    res.redirect(authorizeUrl);
  })
);

/**
 * @name get/send-test-email
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/help/:topic",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_inspect_tables",
    "min_role_edit_views",
    "min_role_edit_pages",
    "min_role_edit_triggers",
    "min_role_edit_search",
    "min_role_edit_menu",
    "min_role_edit_files",
  ]),
  error_catcher(async (req, res) => {
    const { topic } = req.params;
    const { markup } = await get_help_markup(topic, req.query, req);

    res.sendWrap(`Help: ${topic}`, { above: [markup] });
  })
);

router.get(
  "/help-plugin/:plugin/:topic",
  isAdmin,
  error_catcher(async (req, res) => {
    const { plugin, topic } = req.params;
    const location = getState().plugin_locations[plugin];
    if (location) {
      const safeFile = path
        .normalize(topic + ".tmd")
        .replace(/^(\.\.(\/|\\|$))+/, "");
      const fullpath = path.join(location, "help", safeFile);
      if (fs.existsSync(fullpath)) {
        const { markup } = await get_help_markup(
          fullpath,
          req.query,
          req,
          true
        );

        res.sendWrap(`Help: ${topic}`, { above: [markup] });
      } else {
        getState().log(6, `Plugin serve help: file not found ${fullpath}`);
        res.status(404).send(req.__("Not found"));
      }
    } else {
      getState().log(6, `Plugin serve heko: plogin not found ${plugin}`);
      res.status(404).send(req.__("Not found"));
    }
  })
);

router.get(
  "/jsdoc/*filepath",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const fullPath = File.normalise_in_base(
      path.join(__dirname, "..", "docs"),
      ...req.params.filepath
    );
    if (fs.existsSync(fullPath)) res.sendFile(fullPath, { dotfiles: "allow" });
    else {
      res.status(404);
      res.sendWrap(`File not found`, { above: ["Help file not found"] });
    }
  })
);

router.get(
  "/whatsnew",
  isAdmin,
  error_catcher(async (req, res) => {
    const fp = path.join(__dirname, "..", "CHANGELOG.md");
    const fileBuf = await fs.promises.readFile(fp);
    const mdContents = fileBuf.toString().replace("# Notable changes\n", "");
    const markup = md.render(mdContents);
    res.sendWrap(`What's new in Saltcorn`, { above: [markup] });
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
    backupForm.values.backup_s3_bucket =
      getState().getConfig("backup_s3_bucket");
    backupForm.values.backup_s3_endpoint =
      getState().getConfig("backup_s3_endpoint");
    backupForm.values.backup_s3_access_key = getState().getConfig(
      "backup_s3_access_key"
    );
    backupForm.values.backup_s3_access_secret = getState().getConfig(
      "backup_s3_access_secret"
    );
    backupForm.values.backup_s3_region =
      getState().getConfig("backup_s3_region");
    aBackupFilePrefixForm.values.backup_with_event_log = getState().getConfig(
      "backup_with_event_log"
    );
    aBackupFilePrefixForm.values.backup_password =
      getState().getConfig("backup_password");
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
                      klass: "backupadminbtn",
                      //TODO not sure how to tell when backup done
                      onClick:
                        "spin_action_link($('.backupadminbtn'));setTimeout(()=> reset_spinners($('.backupadminbtn')), 3000)",
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
      {
        orderBy: "created",
        orderDesc: true,
        fields: ["id", "created", "hash", "name"],
      }
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
                          )} (${moment(snap.created).fromNow()})${
                            snap.name ? ` [${snap.name}]` : ""
                          }`
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
  isAdminOrHasConfigMinRole([
    "min_role_edit_views",
    "min_role_edit_pages",
    "min_role_edit_triggers",
  ]),
  error_catcher(async (req, res) => {
    const { type, name } = req.params;
    const snaps = await Snapshot.entity_history(type, name);
    const locale = getState().getConfig("default_locale", "en");
    const auth = checkEditPermission(type + "s", req.user);
    if (!auth) {
      res.send("Not authorized");
      return;
    }
    res.set("Page-Title", `Restore ${text(name)}`);
    res.send(
      mkTable(
        [
          {
            label: req.__("When"),
            key: (r) =>
              `${moment(r.created).fromNow()}<br><small>${localeDateTime(
                r.created,
                {},
                locale
              )}</small>`,
          },
          {
            label: req.__("Name"),
            key: (r) => r.name || "",
          },
          {
            label: req.__("Restore"),
            key: (r) =>
              post_btn(
                addOnDoneRedirect(
                  `/admin/snapshot-restore/${type}/${name}/${r.id}`,
                  req
                ),
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
  isAdminOrHasConfigMinRole([
    "min_role_edit_views",
    "min_role_edit_pages",
    "min_role_edit_triggers",
  ]),
  error_catcher(async (req, res) => {
    const { type, name, id } = req.params;
    const auth = checkEditPermission(type + "s", req.user);
    if (!auth) {
      req.flash("error", "Not authorized");
    } else {
      const snap = await db.withTransaction(async () => {
        const snap = await Snapshot.findOne({ id });
        await snap.restore_entity(type, name);
        return snap;
      });
      req.flash(
        "success",
        `${type} ${name} restored to snapshot saved ${moment(
          snap.created
        ).fromNow()}`
      );
    }
    await getState().refresh();
    res.redirect(
      req.query.on_done_redirect &&
        is_relative_url("/" + req.query.on_done_redirect)
        ? `/${req.query.on_done_redirect}`
        : type == "codepage"
          ? `/admin/edit-codepage/${name}`
          : type === "trigger"
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
        await db.withTransaction(async () => {
          await install_pack(pack, undefined, (p) =>
            load_plugins.loadAndSaveNewPlugin(p)
          );
        });
        await getState().refresh();
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
    const auto_backup_directory = getState().getConfig("auto_backup_directory");
    const fp = File.normalise_in_base(auto_backup_directory, filename);

    if (
      !isRoot ||
      !(filename.startsWith(backup_file_prefix) && filename.endsWith(".zip")) ||
      !fp
    ) {
      res.redirect("/admin/backup");
      return;
    }

    res.download(fp, filename, {
      dotfiles: "allow",
    });
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
        type: "String",
        label: "Backup password",
        fieldview: "password",
        name: "backup_password",
        sublabel: req.__(
          "Password to encrypt the backup file. Leave empty for no encryption"
        ),
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
        onclick:
          "ajax_post('/admin/auto-backup-now');press_store_button(this);",
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
          options: ["Saltcorn files", "Local directory", "SFTP server", "S3"],
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
      {
        type: "String",
        label: req.__("S3 Endpoint"),
        name: "backup_s3_endpoint",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "S3",
        },
      },
      {
        type: "String",
        label: req.__("S3 Bucket Name"),
        name: "backup_s3_bucket",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "S3",
        },
      },
      {
        type: "String",
        label: req.__("S3 Access Key"),
        name: "backup_s3_access_key",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "S3",
        },
      },
      {
        type: "String",
        label: req.__("S3 Secret Key"),
        fieldview: "password",
        name: "backup_s3_access_secret",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "S3",
        },
      },
      {
        type: "String",
        label: req.__("S3 Region"),
        name: "backup_s3_region",
        showIf: {
          auto_backup_frequency: ["Daily", "Weekly"],
          auto_backup_destination: "S3",
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
          auto_backup_destination: ["Local directory", "S3"],
        },
      },
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
        onclick:
          "ajax_post('/admin/snapshot-now/'+prompt('Name of snapshot (optional)'))",
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
    form.validate(req.body || {});

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
    form.validate(req.body || {});
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
    form.validate(req.body || {});
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
  "/snapshot-now{/:snapshotname}",
  isAdmin,
  error_catcher(async (req, res) => {
    const { snapshotname } = req.params;
    if (snapshotname == "null") {
      //user clicked cancel on prompt
      res.json({ success: true });
      return;
    }

    try {
      const taken = await Snapshot.take_if_changed(snapshotname);
      if (taken) req.flash("success", req.__("Snapshot successful"));
      else
        req.flash("success", req.__("No changes detected, snapshot skipped"));
    } catch (e) {
      console.error(e);
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
                    th({ valign: "top" }, req.__("Saltcorn version")),
                    td(
                      packagejson.version,
                      isRoot && can_update
                        ? post_btn(
                            "/admin/upgrade",
                            req.__("Upgrade") + " (latest)",
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
                      isRoot &&
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
                        ),
                      "<br>",
                      a(
                        {
                          onclick: "ajax_modal('/admin/whatsnew')",
                          href: `javascript:void(0)`,
                        },
                        "What's new?"
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
      const versions = Object.keys(pkgInfo.versions)
        .filter((v) => !!semver.valid(v))
        .sort(semver.rcompare);

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
  await PluginInstaller.cleanPluginsDirectory();
};

const doInstall = async (req, res, version, deepClean, runPull) => {
  const state = getState();
  let res_write = (s) => {
    try {
      res.write(s);
      state.log(5, s);
    } catch (e) {
      console.error("Install write error: ", e?.message || e);
    }
  };
  if (db.getTenantSchema() !== db.connectObj.default_schema) {
    req.flash("error", req.__("Not possible for tenant"));
    res.redirect("/admin");
  } else {
    res_write(
      version === "latest"
        ? req.__("Starting upgrade, please wait...\n")
        : req.__("Installing %s, please wait...\n", version)
    );
    if (deepClean) {
      res_write(req.__("Cleaning node_modules...\n"));
      try {
        await cleanNodeModules();
      } catch (e) {
        console.error(e);
        res_write(req.__("Error cleaning node_modules: %s\n", e.message));
      }
    }
    const child = spawn(
      "npm",
      ["install", "-g", `@saltcorn/cli@${version}`, "--omit=dev"],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    child.stdout.on("data", (data) => {
      res_write(data);
    });
    child.stderr?.on("data", (data) => {
      res_write(data);
    });
    child.on("exit", async function (code, signal) {
      if (code === 0) {
        if (deepClean) {
          res_write(req.__("Installing sd-notify") + "\n");
          const sdNotifyCode = await tryInstallSdNotify(req, res);
          res_write(
            req.__("sd-notify install done with code %s", sdNotifyCode) + "\n"
          );
        }
        if (runPull) {
          res_write(
            req.__("Pulling the capacitor-builder docker image...") + "\n"
          );
          const pullCode = await pullCapacitorBuilder(req, res, version);
          res_write(req.__("Pull done with code %s", pullCode) + "\n");
          if (pullCode === 0) {
            res_write(req.__("Pruning docker...") + "\n");
            const pruneCode = await pruneDocker(req, res);
            res_write(req.__("Prune done with code %s", pruneCode) + "\n");
          }
        }
      }
      setTimeout(() => {
        getState().processSend("RestartServer");
        process.exit(0);
      }, 200);
      res.end(
        version === "latest"
          ? req.__(
              `Upgrade done (if it was available) with code ${code}.\n\nPress the BACK button in your browser, then RELOAD the page.`
            )
          : req.__(
              `Install done with code ${code}.\n\nPress the BACK button in your browser, then RELOAD the page.`
            )
      );
    });
  }
};

router.post("/install", isAdmin, async (req, res) => {
  const { version, deep_clean } = req.body || {};
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
    await getState().refresh_plugins();
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
        console.error(e);
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
        console.error(e);
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
      const { passes, errors, pass, warnings } =
        await runConfigurationCheck(req);
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
  var capacitorBuilderAvailable = ${capacitorBuilderAvailable.installed};
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

  const entryByRoleBox = document.getElementById('entryPointByRoleBoxId');
  if (entryByRoleBox) {
    entryByRoleBox.addEventListener('change', () => {
      const entryByRole = entryByRoleBox.checked;
      const entryRow = document.getElementById('entryPointRowId');
      const selector = document.getElementById('entrySelectorsId');
      if (entryByRole) {
        entryRow.classList.remove('border', 'border-2', 'p-3', 'rounded');
        selector.classList.add('d-none');
      }
      else {
        entryRow.classList.add('border', 'border-2', 'p-3', 'rounded');
        selector.classList.remove('d-none');
      }
    });
  } else
    console.error('entryByRoleBox not found');
`)}
  </script>`;

const checkXcodebuild = () => {
  return new Promise((resolve) => {
    exec("xcodebuild -version", (error, stdout, stderr) => {
      if (error) {
        resolve({ installed: false });
      } else {
        const tokens = stdout.split(" ");
        const version = tokens.length > 1 ? tokens[1] : undefined;
        resolve({
          installed: true,
          version: version,
          fullfilled: version ? versFullfilled(version, 11) : false,
        });
      }
    });
  });
};

const checkCocoaPods = () => {
  return new Promise((resolve) => {
    exec("pod --version", (error, stdout, stderr) => {
      if (error) {
        resolve({ installed: false });
      } else {
        const version = stdout?.length > 1 ? stdout : undefined;
        resolve({
          installed: true,
          version: version,
          fullfilled: version ? versFullfilled(version, 1) : false,
        });
      }
    });
  });
};

const versFullfilled = (version, minMajVersion) => {
  const vTokens = version.split(".");
  const majVers = parseInt(vTokens[0]);
  return majVers >= minMajVersion;
};

/**
 * iOS Config Box
 * @param {any} param0
 */
const buildIosConfigBox = ({
  req,
  isMac,
  xcodebuildAvailable,
  xcodebuildVersion,
  cocoaPodsAvailable,
  cocoaPodsVersion,
  provisioningFiles,
  allAppCfgFiles,
  builderSettings,
}) => {
  const xCodeFullfilled = versFullfilled(xcodebuildVersion || "0.0.0", 11);
  const cocoaPodsFullfilled = versFullfilled(cocoaPodsVersion || "0.0.0", 1);
  const keyCfg = getState().getConfig("apn_signing_key", "");
  const apnSigningKey = keyCfg ? path.basename(keyCfg) : null;

  // xcodebuild and cocoapods infos
  const toolsInfoBox = () => {
    return div(
      { class: "row pb-3 pt-2" },
      div(
        h5(
          { class: "form-label mb-3" },
          req.__("Build tools") +
            a(
              {
                href: "javascript:ajax_modal('/admin/help/iOS Build tools?')",
              },
              i({ class: "fas fa-question-circle ps-1" })
            )
        )
      ),
      div(
        { class: "col-sm-12" },
        isMac
          ? div(
              div(
                {
                  id: "iosBuilderStatusId",
                  class: "row",
                },
                // xcodebuild status
                div(
                  { class: "col-sm-4" },
                  div({ class: "fw-bold form-label label" }, "xcodebuild"),
                  span(
                    { id: "xcodebuildStatusId" },
                    xcodebuildAvailable
                      ? xcodebuildVersion
                      : req.__("not available"),
                    i({
                      class: `fas p-2 ${
                        xCodeFullfilled
                          ? "fa-check text-success"
                          : "fa-times text-danger"
                      }`,
                    })
                  )
                ),
                // refresh button
                div(
                  { class: "col-sm-4" },
                  span(
                    {
                      role: "button",
                      onClick: "check_ios_build_deps()",
                    },
                    span({ class: "ps-3" }, req.__("refresh")),
                    i({ class: "ps-2 fas fa-undo" })
                  )
                )
              ),
              div(
                {
                  class: "row",
                },
                // cocoapods status
                div(
                  { class: "col-sm-4" },
                  div({ class: "fw-bold form-label label" }, "cocoapods"),
                  span(
                    { id: "cocoapodsStatusId" },
                    cocoaPodsAvailable
                      ? span(cocoaPodsVersion)
                      : span(req.__("not available")),
                    i({
                      class: `fas p-2 ${
                        cocoaPodsFullfilled
                          ? "fa-check text-success"
                          : "fa-times text-danger"
                      }`,
                    })
                  )
                )
              )
            )
          : span(
              req.__("Not a Mac OS system"),
              i({
                class: "ps-2 fas",
              })
            )
      )
    );
  };

  const provisioningFilesBox = () => {
    return (
      div(
        h5(
          { class: "form-label mb-3" },
          req.__("Provisioning profiles"),

          a(
            {
              href: "javascript:ajax_modal('/admin/help/Provisioning Profile?')",
            },
            i({ class: "fas fa-question-circle ps-1" })
          )
        )
      ) +
      // Build without provisioning profile
      div(
        { class: "row pb-2 my-2" },
        div(
          { class: "col-sm-10" },
          input({
            type: "checkbox",
            id: "buildWithoutProfileId",
            class: "form-check-input me-2 mb-0 ",
            name: "noProvisioningProfile",
            checked: builderSettings.noProvisioningProfile === "on",
          }),
          label(
            {
              for: "buildWithoutProfileId",
              class: "form-label fw-bold mb-0",
            },
            req.__("No Provisioning Profile")
          ),
          div(),
          i(
            req.__(
              "Only create the project directory without building an .ipa file. " +
                "This can be useful if you want to open the project in Xcode and run it in the Simulator."
            )
          )
        )
      ) +
      // App Provisioning profile
      div(
        { class: "row pb-3" },
        div(
          { class: "col-sm-10" },
          label(
            {
              for: "provisioningProfileInputId",
              class: "form-label fw-bold",
            },
            req.__("Provisioning Profile")
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
                      builderSettings.provisioningProfile === file.location,
                  },
                  file.filename
                )
              ),
            ].join("")
          )
        )
      ) +
      // Share Extension provisioning profile
      div(
        { class: "row pb-3" },
        div(
          { class: "col-sm-10" },
          label(
            {
              for: "shareProvisioningProfileInputId",
              class: "form-label fw-bold",
            },
            req.__("Share Extension Provisioning Profile")
          ),
          select(
            {
              class: "form-select",
              name: "shareProvisioningProfile",
              id: "shareProvisioningProfileInputId",
            },
            [
              option({ value: "" }, ""),
              ...provisioningFiles.map((file) =>
                option(
                  {
                    value: file.location,
                    selected:
                      builderSettings.shareProvisioningProfile ===
                      file.location,
                  },
                  file.filename
                )
              ),
            ].join("")
          ),
          div(),
          i(req.__("This is a Share extension profile"))
        )
      ) +
      // App-Group-Id
      div(
        { class: "row pb-3" },
        div(
          { class: "col-sm-10" },
          label(
            {
              for: "appGroupIdInputId",
              class: "form-label fw-bold",
            },
            req.__("App Group ID")
          ),
          input({
            type: "text",
            class: "form-control",
            name: "appGroupId",
            id: "appGroupIdInputId",
            value: builderSettings.appGroupId || "",
          }),
          div(),
          i(
            req.__(
              "The App Group ID is used to share data between the main app and the Share extension."
            )
          )
        )
      )
    );
  };

  const iosPushConfigBox = () => {
    return (
      // APN Signing Key
      div(
        { class: "row pb-3" },
        div(
          { class: "col-sm-10" },
          label(
            {
              for: "apnSigningKeyInputId",
              class: "form-label fw-bold",
            },
            req.__("APN Signing Key (.p8 file)")
          ),
          select(
            {
              class: "form-select",
              name: "apnSigningKey",
              id: "apnSigningKeyInputId",
            },
            [
              option({ value: "" }, ""),
              ...allAppCfgFiles.map((file) =>
                option(
                  {
                    value: file.path_to_serve,
                    selected: apnSigningKey === file.filename,
                  },
                  file.filename
                )
              ),
            ].join("")
          ),
          div(),
          i(req.__("This is a private key file"))
        )
      ) +
      // APN Signing Key ID
      div(
        { class: "row pb-3" },
        div(
          { class: "col-sm-10" },
          label(
            {
              for: "apnSigningKeyIdInputId",
              class: "form-label fw-bold",
            },
            req.__("APN Signing Key ID")
          ),
          input({
            type: "text",
            class: "form-control",
            name: "apnSigningKeyId",
            id: "apnSigningKeyIdInputId",
            value: builderSettings.apnSigningKeyId || "",
          }),
          div(),
          i(
            req.__(
              "The 10-character Key ID obtained from Apple developer account"
            )
          )
        )
      )
    );
  };

  return div(
    { class: "my-3" },
    p(
      { class: "h3 ps-1 mt-3" },
      button(
        {
          class: "btn btn-outline-secondary p-1 me-2",
          type: "button",
          "data-bs-toggle": "collapse",
          "data-bs-target": "#iOSConfigFormGroupId",
          "aria-expanded": "false",
          "aria-controls": "iOSConfigFormGroupId",
        },
        i({ class: "fas fa-chevron-down" })
      ) + "iOS Configuration"
    ),
    div(
      {
        id: "iOSConfigFormGroupId",
        class: "form-group border border-2 p-3 rounded collapse",
      },
      toolsInfoBox(),
      provisioningFilesBox(),
      // Push Notifications section
      div(
        { class: "form-group row my-3" },
        div(
          { class: "col-sm-12 mt-2 fw-bold" },
          h5(
            { class: "" },
            req.__("Push Notifications"),
            a(
              {
                href: "javascript:ajax_modal('/admin/help/APN Signing Key?')",
              },
              i({ class: "fas fa-question-circle ps-1" })
            )
          )
        )
      ),
      iosPushConfigBox()
    )
  );
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
    const pushCfgFiles = await File.find({
      folder: "/mobile-app-configurations",
      mime_super: "application",
      min_role_read: 100,
    });
    const allAppCfgFiles = await File.find({
      folder: "mobile-app-configurations",
    });
    const keystoreFiles = [
      ...(await File.find({ folder: "keystore_files" })),
      ...allAppCfgFiles,
    ];
    const provisioningFiles = [
      ...(await File.find({ folder: "provisioning_files" })),
      ...allAppCfgFiles,
    ];
    const withSyncInfo = await Table.find({ has_sync_info: true });
    const plugins = (await Plugin.find()).filter(
      (plugin) =>
        ["base", "sbadmin2"].indexOf(plugin.name) < 0 &&
        !plugin.exclude_from_mobile()
    );
    const pluginsReadyForMobile = plugins
      .filter((plugin) => plugin.ready_for_mobile())
      .map((plugin) => plugin.name);
    const builderSettings =
      getState().getConfig("mobile_builder_settings") || {};
    const scVersion = getState().scVersion;
    const dockerAvailable = await imageAvailable(
      "saltcorn/capacitor-builder",
      scVersion
    );
    const xcodeCheckRes = await checkXcodebuild();
    const xcodebuildAvailable = xcodeCheckRes.installed;
    const xcodebuildVersion = xcodeCheckRes.version;
    const isMac = process.platform === "darwin";
    const cocoaPodCheckRes = await checkCocoaPods();
    const cocoaPodsAvailable = cocoaPodCheckRes.installed;
    const cocoaPodsVersion = cocoaPodCheckRes.version;
    const layout = getState().getLayout(req.user);
    const isSbadmin2 = layout === getState().layouts.sbadmin2;
    const isEntrypointByRole = builderSettings.entryPointByRole === "on";

    const keyCfg = getState().getConfig("firebase_json_key");
    const fbJSONKey = keyCfg ? path.basename(keyCfg) : null;
    const servicesCfg = getState().getConfig("firebase_app_services");
    const fbAppServices = servicesCfg ? path.basename(servicesCfg) : null;

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
              p(
                "This menu allows building Android or iOS apps for your web app. " +
                  "On Android, installing the capacitor-builder Docker image is recommended, for iOS, an Apple machine is required. "
              ),
              p(
                "To select files (like an Android keystore or iOS provisioning profile), " +
                  "upload them to the 'mobile-app-configurations' folder (create it if it not yet exists). " +
                  "Results are shown once on completion, and the builder adds a result folder to the 'mobile_app' directory."
              ),
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
                  p(
                    { class: "h3 ps-1" },
                    button(
                      {
                        class: "btn btn-outline-secondary p-1 me-2",
                        type: "button",
                        "data-bs-toggle": "collapse",
                        "data-bs-target": "#commonSettingsContainerId",
                        "aria-expanded": "true",
                        "aria-controls": "commonSettingsContainerId",
                      },
                      i({ class: "fas fa-chevron-down" })
                    ) + "Common configuration"
                  ),
                  div(
                    {
                      id: "commonSettingsContainerId",
                      class:
                        "form-group border border-2 p-3 rounded collapse show",
                    },
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
                      { class: "row mb-3" },
                      div(
                        {
                          class: `col-sm-4 mt-2 ms-3 me-2 ${isEntrypointByRole ? "" : "border border-2 p-3 rounded"}`,
                          id: "entryPointRowId",
                        },
                        div(
                          { class: "row pb-2" },
                          div(
                            { class: "col-sm-6" },
                            input({
                              type: "checkbox",
                              id: "entryPointByRoleBoxId",
                              class: "form-check-input me-2",
                              name: "entryPointByRole",
                              checked: isEntrypointByRole,
                            }),
                            label(
                              {
                                for: "entryPointByRole",
                                class: "form-label",
                              },
                              req.__("Entry point by role"),
                              a(
                                {
                                  href: "javascript:ajax_modal('/admin/help/Entry point by role?')",
                                },
                                i({ class: "fas fa-question-circle ps-1" })
                              )
                            )
                          )
                        ),
                        // 'view/page/pagegroup' tabs
                        div(
                          {
                            id: "entrySelectorsId",
                            class: isEntrypointByRole ? "d-none" : "",
                          },
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
                                      builderSettings.entryPointType ===
                                      "pagegroup"
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
                                      builderSettings.entryPointType ===
                                        "view" &&
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
                                      builderSettings.entryPointType ===
                                        "page" &&
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
                                checked:
                                  builderSettings.androidPlatform === "on",
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
                        { class: "col-sm-10" },
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
                        { class: "col-sm-10" },
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
                          placeholder: "com.saltcorn.mobile.app",
                          value: builderSettings.appId || "",
                        })
                      )
                    ),
                    // app version
                    div(
                      { class: "row pb-2" },
                      div(
                        { class: "col-sm-10" },
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
                        { class: "col-sm-10" },
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
                        { class: "col-sm-10" },
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
                        { class: "col-sm-10" },
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
                        { class: "col-sm-10" },
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
                            class: "form-label fw-bold  mb-0",
                          },
                          req.__("Auto public login")
                        ),
                        div(),
                        i(
                          req.__(
                            "When enabled, you will be logged in as a public user without any login screen."
                          )
                        )
                      )
                    ),
                    // show continue as public user link
                    div(
                      { class: "row pb-2" },
                      div(
                        { class: "col-sm-10" },
                        input({
                          type: "checkbox",
                          id: "showContAsPublId",
                          class: "form-check-input me-2",
                          name: "showContinueAsPublicUser",
                          checked:
                            builderSettings.showContinueAsPublicUser === "on",
                        }),
                        label(
                          {
                            for: "showContAsPublId",
                            class: "form-label fw-bold mb-0",
                          },
                          req.__("Show 'Continue as public user' link")
                        ),
                        div(),
                        i(
                          req.__(
                            "When enabled, the login screen shows you a link to login as public user."
                          )
                        )
                      )
                    ),

                    // allow clear text traffic
                    div(
                      { class: "row pb-2" },
                      div(
                        { class: "col-sm-10" },
                        input({
                          type: "checkbox",
                          id: "allowClearTextTrafficId",
                          class: "form-check-input me-2 mb-0 ",
                          name: "allowClearTextTraffic",
                          checked:
                            builderSettings.allowClearTextTraffic === "on",
                        }),
                        label(
                          {
                            for: "allowClearTextTrafficId",
                            class: "form-label fw-bold mb-0",
                          },
                          req.__("Allow clear text traffic")
                        ),
                        div(),
                        i(
                          req.__(
                            "Enable this to allow unsecure HTTP connections. Useful for local testing."
                          )
                        )
                      )
                    ),

                    // build type
                    div(
                      { class: "row pb-3 pt-2" },
                      div(
                        { class: "col-sm-10" },
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
                    // included/excluded plugins
                    div(
                      {
                        id: "pluginsSelectorId",
                        class: "row pb-4",
                      },
                      div(
                        label(
                          { class: "form-label fw-bold" },
                          req.__("Plugins")
                        )
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

                    // allow offline mode box
                    div(
                      { class: "row pb-2 mt-2" },
                      div(
                        { class: "col-sm-10" },
                        input({
                          type: "checkbox",
                          id: "offlineModeBoxId",
                          class: "form-check-input me-2 mb-0 ",
                          name: "allowOfflineMode",
                          onClick: "toggle_tbl_sync()",
                          checked: builderSettings.allowOfflineMode === "on",
                        }),
                        label(
                          {
                            for: "offlineModeBoxId",
                            class: "form-label fw-bold mb-0",
                          },
                          req.__("Allow offline mode")
                        ),
                        div(),
                        i(
                          req.__(
                            "Enable this to integrate offline/online Synchronization into your app."
                          )
                        )
                      )
                    ),

                    div(
                      {
                        id: "tblSyncSelectorId",
                        class: "mb-3 mt-1",
                        hidden: builderSettings.allowOfflineMode !== "on",
                      },
                      p({ class: "h3 ps-3" }, "Synchronization settings"),
                      div(
                        { class: "form-group border border-2 p-3 rounded" },

                        div(
                          div(
                            {
                              class: "row pb-3",
                            },
                            div(
                              label(
                                { class: "form-label fw-bold" },
                                req.__("Tables to synchronize") +
                                  a(
                                    {
                                      href: "javascript:ajax_modal('/admin/help/Capacitor Builder?')",
                                    },
                                    i({ class: "fas fa-question-circle ps-1" })
                                  )
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
                                  {
                                    class:
                                      "col-sm-1 d-flex justify-content-center",
                                  },
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
                          )
                        ),

                        // sync when connection restored
                        div(
                          { class: "row pb-2 my-2" },
                          div(
                            { class: "col-sm-10" },
                            input({
                              type: "checkbox",
                              id: "connRestoredBoxId",
                              class: "form-check-input me-2 mb-0 ",
                              name: "syncOnReconnect",
                              checked: builderSettings.syncOnReconnect === "on",
                            }),
                            label(
                              {
                                for: "connRestoredBoxId",
                                class: "form-label fw-bold mb-0",
                              },
                              req.__("Sync on reconnect")
                            ),
                            div(),
                            i(
                              req.__(
                                "Run Synchronizations when the network connection is restored."
                              )
                            )
                          )
                        ),

                        // sync when the app resumes
                        div(
                          { class: "row pb-2 my-2" },
                          div(
                            { class: "col-sm-10" },
                            input({
                              type: "checkbox",
                              id: "appResumeSyncBoxId",
                              class: "form-check-input me-2 mb-0 ",
                              name: "syncOnAppResume",
                              checked: builderSettings.syncOnAppResume === "on",
                            }),
                            label(
                              {
                                for: "appResumeSyncBoxId",
                                class: "form-label fw-bold mb-0",
                              },
                              req.__("Sync on app resume")
                            ),
                            div(),
                            i(
                              req.__(
                                "Run Synchronizations when the app is resumed from background."
                              )
                            )
                          )
                        ),

                        // push sync
                        div(
                          { class: "row pb-2 my-2" },
                          div(
                            { class: "col-sm-10" },
                            input({
                              type: "checkbox",
                              id: "pushSyncBoxId",
                              class: "form-check-input me-2 mb-0 ",
                              name: "pushSync",
                              checked: builderSettings.pushSync === "on",
                            }),
                            label(
                              {
                                for: "pushSyncBoxId",
                                class: "form-label fw-bold mb-0",
                              },
                              req.__("Push sync")
                            ),
                            div(),
                            i(
                              req.__(
                                "Run Synchronizations when the server sends a push notification. " +
                                  "On Android, this requires a Firebase JSON key and a Google Services File (see below)."
                              )
                            )
                          )
                        ),

                        // periodic sync interval
                        div(
                          { class: "row pb-2 mt-2" },
                          div(
                            { class: "col-sm-10" },
                            label(
                              {
                                for: "syncIntervalInputId",
                                class: "form-label fw-bold mb-0 ",
                              },
                              req.__("Background Sync interval")
                            ),
                            input({
                              type: "text",
                              class: "form-control mb-0",
                              name: "syncInterval",
                              id: "syncIntervalInputId",
                              value: builderSettings.syncInterval || "",
                            }),
                            div(),
                            i(
                              req.__(
                                "Perdiodic interval (in minutes) to run synchronizations in the background. " +
                                  "This is just a min interval, depending on system conditions, the actual time may be longer."
                              )
                            )
                          )
                        )
                      )
                    )
                  ),
                  div(
                    { class: "mt-3 mb-3" },
                    p(
                      { class: "h3 ps-1" },
                      button(
                        {
                          class: "btn btn-outline-secondary p-1 me-2",
                          type: "button",
                          "data-bs-toggle": "collapse",
                          "data-bs-target": "#androidConfigFormGroupId",
                          "aria-expanded": "false",
                          "aria-controls": "androidConfigFormGroupId",
                        },
                        i({ class: "fas fa-chevron-down" })
                      ) + "Android configuration"
                    ),
                    div(
                      {
                        id: "androidConfigFormGroupId",
                        class:
                          "form-group border border-2 p-3 rounded collapse",
                      },

                      div(
                        { class: "row pb-3 pt-2" },
                        div(
                          h5(
                            { class: "form-label mb-3" },
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
                            dockerAvailable.installed &&
                              dockerAvailable.version === scVersion
                              ? span(
                                  req.__("installed"),
                                  i({ class: "ps-2 fas fa-check text-success" })
                                )
                              : dockerAvailable.installed
                                ? div(
                                    {
                                      id: "mismatchBoxId",
                                      class: "mt-3 p-3 border rounded",
                                    },
                                    div(
                                      {
                                        class: "d-flex align-items-center mb-2",
                                      },
                                      req.__("installed"),
                                      i({
                                        title: req.__("Information"),
                                        class:
                                          "ps-2 fas fa-info-circle text-warning",
                                      })
                                    ),
                                    div(
                                      { class: "fw-bold text-danger mb-1" },
                                      "Version Mismatch:"
                                    ),

                                    ul(
                                      { class: "list-unstyled mb-0" },
                                      li(
                                        span(
                                          { class: "fw-semibold text-muted" },
                                          req.__("Docker tag:")
                                        ),
                                        dockerAvailable.version
                                      ),
                                      li(
                                        span(
                                          { class: "fw-semibold text-muted" },
                                          req.__("SC version:")
                                        ),
                                        scVersion
                                      )
                                    )
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

                      div(
                        { class: "form-group row" },
                        div(
                          { class: "col-sm-12" },
                          h5({ class: "" }, req.__("Release Signing"))
                        )
                      ),

                      // keystore file
                      div(
                        { class: "row pb-3" },
                        div(
                          { class: "col-sm-10" },
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
                          { class: "col-sm-10" },
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
                          { class: "col-sm-10" },
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
                      ),

                      // Push Notifications section
                      div(
                        { class: "form-group row my-3" },
                        div(
                          { class: "col-sm-12 mt-2 fw-bold" },
                          h5({ class: "" }, req.__("Push Notifications"))
                        )
                      ),

                      // firebase JSON key file
                      div(
                        { class: "row pb-3" },
                        div(
                          { class: "col-sm-10" },
                          label(
                            {
                              for: "fireBaseJSONKeyInputId",
                              class: "form-label fw-bold",
                            },
                            req.__("Firebase JSON Key"),
                            a(
                              {
                                href: "javascript:ajax_modal('/admin/help/Firebase Configurations?')",
                              },
                              i({ class: "fas fa-question-circle ps-1" })
                            )
                          ),
                          select(
                            {
                              class: "form-select",
                              name: "firebaseJSONKey",
                              id: "fireBaseJSONKeyInputId",
                            },
                            [
                              option({ value: "" }, ""),
                              ...pushCfgFiles.map((file) =>
                                option(
                                  {
                                    value: file.path_to_serve,
                                    selected: fbJSONKey === file.filename,
                                  },
                                  file.filename
                                )
                              ),
                            ].join("")
                          ),
                          div(),
                          i(
                            req.__(
                              "This is a private key file for your Firebase project. " +
                                "Your Saltcorn server uses it to send push notifications or push-based synchronizations to your Android mobile app. " +
                                "Upload it to the '/mobile-app-configurations' directory (if it does not exist, create it). " +
                                "You can configure it here or in the 'Notifications' Menu."
                            )
                          )
                        )
                      ),
                      // google-services.json file
                      div(
                        { class: "row pb-3" },
                        div(
                          { class: "col-sm-10" },
                          label(
                            {
                              for: "googleServicesInputId",
                              class: "form-label fw-bold",
                            },
                            req.__("Google Services File"),
                            a(
                              {
                                href: "javascript:ajax_modal('/admin/help/Firebase Configurations?')",
                              },
                              i({ class: "fas fa-question-circle ps-1" })
                            )
                          ),
                          select(
                            {
                              class: "form-select",
                              name: "googleServicesFile",
                              id: "googleServicesInputId",
                            },
                            [
                              option({ value: "" }, ""),
                              ...pushCfgFiles.map((file) =>
                                option(
                                  {
                                    value: file.path_to_serve,
                                    selected: fbAppServices === file.filename,
                                  },
                                  file.filename
                                )
                              ),
                            ].join("")
                          ),
                          div(),
                          i(
                            req.__(
                              "This is a configuration file specific to your mobile app. " +
                                "It contains, among other things, your App ID, the Firebase project ID, and an API key. " +
                                "The file gets bundled into the client and will be used to subscribe to push notifications or push-based synchronizations from the server. " +
                                "Upload it to the '/mobile-app-configurations' directory (if it does not exist, create it). " +
                                "You can configure it here or in the 'Notifications' Menu."
                            )
                          )
                        )
                      )
                    )
                  ),

                  buildIosConfigBox({
                    req,
                    isMac,
                    xcodebuildAvailable,
                    xcodebuildVersion,
                    cocoaPodsAvailable,
                    cocoaPodsVersion,
                    provisioningFiles,
                    allAppCfgFiles,
                    builderSettings,
                  })
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
    const appFilesTbl =
      files.length > 0 ? app_files_table(files, out_dir_name, req) : "";
    res.sendWrap(req.__(`Admin`), {
      above: [
        mode !== "prepare"
          ? [
              {
                type: "card",
                title: req.__("Build Result"),
                contents: div(resultMsg),
              },
              appFilesTbl,
            ]
          : "",

        mode === "prepare"
          ? intermediate_build_result(out_dir_name, build_dir, req, appFilesTbl)
          : "",
      ],
    });
  })
);

router.post(
  "/build-mobile-app/finish",
  isAdmin,
  error_catcher(async (req, res) => {
    const { out_dir_name, build_dir } = req.body || {};
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
    getState().log(
      2,
      `starting mobile build: ${JSON.stringify(req.body || {})}`
    );
    const msgs = [];
    let mode = "full";
    let {
      entryPoint,
      entryPointType,
      entryPointByRole,
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
      showContinueAsPublicUser,
      allowOfflineMode,
      syncOnReconnect,
      syncOnAppResume,
      pushSync,
      syncInterval,
      synchedTables,
      includedPlugins,
      noProvisioningProfile,
      provisioningProfile,
      shareProvisioningProfile,
      appGroupId,
      apnSigningKey,
      apnSigningKeyId,
      buildType,
      allowClearTextTraffic,
      keystoreFile,
      keystoreAlias,
      keystorePassword,
      firebaseJSONKey,
      googleServicesFile,
    } = req.body || {};
    const receiveShareTriggers = Trigger.find({
      when_trigger: "ReceiveMobileShareData",
    });
    let allowShareTo = receiveShareTriggers.length > 0;
    if (allowShareTo && iOSPlatform) {
      if (!shareProvisioningProfile) {
        allowShareTo = false;
        msgs.push({
          type: "warning",
          text: req.__(
            "A ReceiveMobileShareData trigger exists, but no Share Extension Provisioning Profile is provided. " +
              "Building without share to support."
          ),
        });
      }
      // if (!appGroupId) {
      //   msgs.push({
      //     type: "warning",
      //     text: req.__(
      //       "A ReceiveMobileShareData trigger exists, but no App Group ID is provided. " +
      //         "Only simple data like links will be supported"
      //     ),
      //   });
      // }
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
      if (!provisioningProfile && !noProvisioningProfile)
        return res.json({
          error: req.__(
            "Please provide a Provisioning Profile for the iOS build."
          ),
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
    if (
      pushSync &&
      androidPlatform &&
      (!firebaseJSONKey || !googleServicesFile)
    ) {
      return res.json({
        error: req.__(
          "To use the push sync please provide a Firebase JSON Key and a Google Services File."
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
      "-t",
      entryPointByRole
        ? "byrole"
        : entryPointType === "pagegroup"
          ? "page"
          : entryPointType,
      "-c",
      outDir,
      "-b",
      buildDir,
      "-u",
      req.user.email, // ensured by isAdmin
    ];
    if (!entryPointByRole) spawnParams.push("-e", entryPoint);
    if (useDocker) spawnParams.push("-d");
    if (androidPlatform) spawnParams.push("-p", "android");
    if (iOSPlatform) spawnParams.push("-p", "ios");
    if (noProvisioningProfile) spawnParams.push("--noProvisioningProfile");
    if (provisioningProfile)
      spawnParams.push("--provisioningProfile", provisioningProfile);
    if (allowShareTo && iOSPlatform) {
      mode = "prepare";
      spawnParams.push(
        "--shareExtensionProvisioningProfile",
        shareProvisioningProfile
      );
      if (appGroupId) spawnParams.push("--appGroupId", appGroupId);
    }
    if (appName) spawnParams.push("--appName", appName);
    if (appId) spawnParams.push("--appId", appId);
    if (appVersion) spawnParams.push("--appVersion", appVersion);
    if (appIcon) spawnParams.push("--appIcon", appIcon);
    if (serverURL) spawnParams.push("-s", serverURL);
    if (splashPage) spawnParams.push("--splashPage", splashPage);
    if (allowOfflineMode) spawnParams.push("--allowOfflineMode");
    if (syncInterval) spawnParams.push("--syncInterval", syncInterval);
    if (pushSync) spawnParams.push("--pushSync");
    if (syncOnReconnect) spawnParams.push("--syncOnReconnect");
    if (syncOnAppResume) spawnParams.push("--syncOnAppResume");
    if (allowShareTo) spawnParams.push("--allowShareTo");
    if (autoPublicLogin) spawnParams.push("--autoPublicLogin");
    if (showContinueAsPublicUser)
      spawnParams.push("--showContinueAsPublicUser");
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
    if (allowClearTextTraffic) spawnParams.push("--allowClearTextTraffic");
    if (keystoreFile) spawnParams.push("--androidKeystore", keystoreFile);
    if (keystoreAlias)
      spawnParams.push("--androidKeyStoreAlias", keystoreAlias);
    if (keystorePassword)
      spawnParams.push("--androidKeystorePassword", keystorePassword);
    if (googleServicesFile)
      spawnParams.push("--googleServicesFile", googleServicesFile);

    // if builDir exists, remove it
    if (
      await fs.promises
        .access(buildDir)
        .then(() => true)
        .catch(() => false)
    ) {
      try {
        await fs.promises.rm(buildDir, { recursive: true, force: true });
        getState().log(5, `Removed existing build directory: ${buildDir}`);
      } catch (error) {
        getState().log(4, `Error removing build directory: ${error.message}`);
      }
    }

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
    const state = getState();
    const { installed, version } = await imageAvailable(
      "saltcorn/capacitor-builder",
      state.scVersion
    );
    res.json({ installed, version, sc_version: state.scVersion });
  })
);

router.get(
  "/mobile-app/check-ios-build-tools",
  isAdmin,
  error_catcher(async (req, res) => {
    const xcodebuild = await checkXcodebuild();
    const cocoapods = await checkCocoaPods();
    const isMac = process.platform === "darwin";
    res.json({ xcodebuild, cocoapods, isMac });
  })
);

router.post(
  "/mobile-app/save-config",
  isAdmin,
  error_catcher(async (req, res) => {
    try {
      const newCfg = { ...(req.body || {}) };
      const excludedPlugins = (await Plugin.find())
        .filter(
          (plugin) =>
            ["base", "sbadmin2"].indexOf(plugin.name) < 0 &&
            (newCfg.includedPlugins || []).indexOf(plugin.name) < 0
        )
        .map((plugin) => plugin.name);
      newCfg.excludedPlugins = excludedPlugins;
      await getState().setConfig("mobile_builder_settings", newCfg);
      await getState().setConfig("firebase_json_key", newCfg.firebaseJSONKey);
      await getState().setConfig(
        "firebase_app_services",
        newCfg.googleServicesFile
      );
      await getState().setConfig("apn_signing_key", newCfg.apnSigningKey);
      await getState().setConfig("apn_signing_key_id", newCfg.apnSigningKeyId);
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
    form.validate(req.body || {});
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
      await db.deleteWhere("_sc_workflow_trace");
      await db.deleteWhere("_sc_workflow_runs");
      await db.deleteWhere("_sc_workflow_steps");
      await db.deleteWhere("_sc_triggers");
      if (db.reset_sequence) await db.reset_sequence("_sc_triggers");
      await getState().refresh_triggers();
    }
    if (form.values.tables) {
      await db.deleteWhere("_sc_model_instances");
      await db.deleteWhere("_sc_models");

      //in revers order of creation in case any provided tables depend on real tables
      const tables = await Table.find({}, { orderBy: "id", orderDesc: true });

      for (const table of tables) {
        const constraints = await TableConstraint.find({ table_id: table.id });

        for (const con of constraints) {
          await con.delete();
        }

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
        else
          // reset users table row
          await table.update({
            min_role_read: 1,
            min_role_write: 1,
            description: "",
            ownership_formula: null,
            ownership_field_id: null,
            versioned: false,
            has_sync_info: false,
            is_user_group: false,
          });
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
      await require("@saltcorn/data/standard-menu")();
    }
    await getState().refresh();

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
      await User.destroy_all_tenant_sessions();
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
        "localize_csv_download",
        "bom_csv_download",
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

// get type declarations for monaco
router.get(
  "/ts-declares",
  isAdmin,
  error_catcher(async (req, res) => {
    const ds = [
      `interface Console {
    error(...data: any[]): void;
    log(...data: any[]): void;
    info(...data: any[]): void;
    debug(...data: any[]): void;
    warn(...data: any[]): void;
}
declare var console: Console;
function setTimeout(f:Function, timeout?:number)
declare const page_load_tag: string
function emit_to_client(message: object, to_user_ids?: number | number[])
async function sleep(milliseconds: number)
function interpolate(s: string,
  row: Row,
  user?: UserLike,
  errorLocation?: string) : string:
declare const tryCatchInTransaction: <T>(
    fn: () => Promise<T>,
    onError?: (err: Error) => Promise<T | void>
  ) => Promise<T>;
declare const commitAndBeginNewTransaction: () => Promise<void>;
interface Response {
json: ()=>Promise<any>, text: ()=>Promise<string>, status: number, statusTest: string, ok: boolean,
}
declare const fetch: (
    url: string | URL, 
    fetchOptions?: 
    {  headers?: Record<string, string>, 
       method?: "POST" | "GET" | "PUT" | "DELETE" | "HEAD" | "OPTIONS" | "TRACE",
       body?: string | Blob | FormData}
    ) => Promise<Response>
declare const View: any
declare const  Page : any
declare const  Field : any
declare const  Trigger : any
declare const  MetaData : any
function setConfig(key: string, v:any)
function getConfig(key: string): any
`,
    ];
    if (req.query.codepage) {
      ds.push("declare var globalThis: any");
      ds.push("function runAsync(f:AsyncFunction)");
    } else {
      ds.push(`
declare const commitBeginNewTransactionAndRefreshCache: () => Promise<void>;
declare const  EventLog : any
declare const  Notification : any
declare const  WorkflowRun : any
async function run_js_code({code, row, table}:{ code: string, row?: Row, table?: Table})
async function refreshSystemCache(entities?: "codepages" | "tables" | "views" | "triggers" | "pages" | "page_groups"|"config"|"npmpkgs"|"userlayouts"|"i18n"|"push_helper"|"ephemeral_config"|"plugins");
`);
    }
    const scTypeToTsType = (type, field) => {
      if (field?.is_fkey) {
        if (field.reftype) return scTypeToTsType(field.reftype);
      }
      return (
        {
          String: "string",
          Integer: "number",
          Float: "number",
          Bool: "boolean",
          Date: "Date",
          HTML: "string",
        }[type?.name || type] || "any"
      );
    };

    const cachedTableNames = getState().tables.map((t) => `"${t.name}"`);

    const dsPaths = [
      path.join(__dirname, "tsdecls/lib.es5.d.ts"),
      path.join(__dirname, "tsdecls/es2015.core.d.ts"),
      path.join(__dirname, "tsdecls/es2015.collection.d.ts"),
      path.join(__dirname, "tsdecls/es2015.promise.d.ts"),
      path.join(__dirname, "tsdecls/es2017.object.d.ts"),
      path.join(__dirname, "tsdecls/es2017.string.d.ts"),
      path.join(__dirname, "tsdecls/es2019.object.d.ts"),
      path.join(dbCommonModulePath, "/dbtypes.d.ts"),
      path.join(dataModulePath, "/models/table.d.ts"),
      path.join(dataModulePath, "/models/user.d.ts"),
      path.join(dataModulePath, "/models/file.d.ts"),
    ];

    for (const dsPath of dsPaths) {
      const fileContents = await fs.promises.readFile(dsPath, {
        encoding: "utf-8",
      });
      const lines = fileContents.split("\n");
      ds.push(
        lines
          .filter((ln) => !ln.startsWith("import "))
          .map((ln) => ln.replace(/^export /, ""))
          .map((ln) =>
            ln.replace(
              "static findOne(where: Where | Table | number | string): Table | null;",
              `static findOne(where: Where | ${cachedTableNames.join(" | ")} | number): Table | null;`
            )
          )
          .join("\n")
      );
    }

    if (req.query.workflow) {
      ds.push(`declare const row: Row;`);
    } else if (req.query.table) {
      const table = Table.findOne(req.query.table);
      if (table) {
        const tsFields = [];
        const addTsFields = (table, path, nrecurse) => {
          table.fields.forEach((f) => {
            tsFields.push(`${path}${f.name}: ${scTypeToTsType(f.type, f)};`);
            if (f.is_fkey && nrecurse >= 0) {
              const reftable = Table.findOne(f.reftable_name);
              if (reftable)
                addTsFields(reftable, `${path}${f.name}Ⱶ`, nrecurse - 1);
            }
          });
        };
        addTsFields(table, "", 2);
        ds.push(`declare const table: Table`);
        ds.push(`declare const row: {
         ${tsFields.join("\n")}
      }`);
        tsFields.forEach((tsf) => {
          ds.push(`declare const ${tsf}`);
        });
      }
    }
    if (req.query.user) {
      const table = User.table;
      if (table) {
        ds.push(`declare const user: {
         ${table.fields
           .map((f) => `${f.name}: ${scTypeToTsType(f.type, f)};`)
           .join("\n")}
         lightDarkMode: "light" | "dark";
         language: string;
      }${req.query.user === "maybe" ? " | undefined" : ""}`);
      }
    }

    for (const [nm, f] of Object.entries(getState().functions)) {
      if (nm === "today") {
        ds.push(
          `function today(offset_days?: number | {startOf:  "year" | "quarter" | "month" | "week" | "day" | "hour"} | {endOf:  "year" | "quarter" | "month" | "week" | "day" | "hour"}): Date`
        );
      }
      if (nm === "slugify") {
        ds.push(`function slugify(s: string): string`);
      } else if (f.run) {
        if (f["arguments"]) {
          const args = (f["arguments"] || []).map(
            ({ name, type, tstype, required }) =>
              `${name}${required ? "" : "?"}: ${tstype || scTypeToTsType(type)}`
          );
          ds.push(
            `${f.isAsync ? "async " : ""}function ${nm}(${args.join(", ")})`
          );
        } else
          ds.push(
            `declare var ${nm}: ${f.isAsync ? "AsyncFunction" : "Function"}`
          );
      } else ds.push(`declare const ${nm}: Function;`);
    }
    let exclude_cp_ids = req.query.codepage
      ? identifiersInCodepage(
          getState().getConfig("function_code_pages", {})[req.query.codepage]
        )
      : new Set([]);

    for (const [nm, f] of Object.entries(getState().codepage_context)) {
      if (exclude_cp_ids.has(nm)) continue;
      if (f.constructor?.name === "AsyncFunction")
        ds.push(`declare var ${nm}: AsyncFunction;`);
      else if (f.constructor?.name === "Function")
        ds.push(`declare var ${nm}: Function;`);
      else ds.push(`declare var ${nm}: ${typeof f};`);
    }

    if (!req.query.codepage) {
      const trigger_actions = await Trigger.find({
        when_trigger: { or: ["API call", "Never"] },
      });
      ds.push(
        `declare const Actions: {
        ${Object.keys(getState().actions)
          .map(
            (nm) =>
              `["${nm}"]: ({row, table}?:{row?: Row, table?: Table})=>Promise<void>,`
          )
          .join("\n")}
        ${trigger_actions
          .map((tr) => `["${tr.name}"]: ({row}?:{row?: Row})=>Promise<void>,`)
          .join("\n")}
        }`
      );
    }
    //fs.writeFileSync("/tmp/tsdecls.ts", ds.join("\n"));
    res.send(ds.join("\n"));
  })
);

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
      fields: [
        {
          name: "code",
          form_name: "code",
          label: "Code",
          sublabel:
            "Only functions declared as <code>function name(...) {...}</code> or <code>async function name(...) {...}</code> will be available in formulae and code actions. Declare a constant <code>k</code> as <code>globalThis.k = ...</code> In scope: " +
            a(
              {
                href: "/admin/jsdoc/classes/_saltcorn_data.models_table.Table.html",
                target: "_blank",
              },
              "Table"
            ),
          input_type: "code",
          attributes: { mode: "text/javascript", codepage: name },
          class: "validate-statements enlarge-in-card",
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
    const tagMarkup = span(
      { class: "ms-1" },
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
        titleAjaxIndicator: true,
        title: req.__(`%s code page`, name),
        contents: [
          renderForm(form, req.csrfToken()),
          a(
            {
              href: `javascript:if(confirm('Are you sure you would like to delete this code page?'))ajax_post('/admin/delete-codepage/${encodeURIComponent(
                name
              )}')`,
              class: "me-1 text-danger",
            },
            req.__("Delete code page")
          ),
          " | ",
          a(
            {
              href: `javascript:ajax_modal('/admin/snapshot-restore/codepage/${name}')`,
              class: "ms-1 me-1",
            },
            req.__("Restore")
          ),
          " | ",
          tagMarkup,
        ],
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

    const code = (req.body || {}).code;
    await getState().setConfig("function_code_pages", {
      ...code_pages,
      [name]: code,
    });
    //allow workers to sync cfg before refresh code pages
    //TODO we need a better way to sync codepage after all workers have updated cfg
    await sleep(500);
    const err = await getState().refresh_codepages();
    if (err)
      res.json({
        success: false,
        error: `Error evaluating code pages: ${err}`,
        remove_delay: "5",
      });
    else res.json({ success: true });
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
    { section_header: "Progressive Web Application" },
    "pwa_enabled",
    { name: "pwa_display", showIf: { pwa_enabled: true } },
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
    { section_header: "Email Notifications" },
    "mail_throttle_per_user",
    { section_header: "Push Notifications" },
    "enable_push_notify",
    {
      name: "push_notification_icon",
      showIf: { enable_push_notify: true },
    },
    {
      name: "push_notification_badge",
      showIf: { enable_push_notify: true },
    },
    { section_header: "Web push" },
    {
      name: "vapid_public_key",
      showIf: { enable_push_notify: true },
    },
    {
      name: "vapid_private_key",
      showIf: { enable_push_notify: true },
    },
    {
      name: "vapid_email",
      showIf: { enable_push_notify: true },
    },
    { section_header: "Native Android Mobile App" },
    {
      name: "firebase_json_key",
      showIf: { enable_push_notify: true },
      help: { topic: "Firebas JSON key" },
    },
    {
      name: "firebase_app_services",
      showIf: { enable_push_notify: true },
      help: { topic: "Firebase App Services" },
    },
    { section_header: "Native iOS Mobile App" },
    {
      name: "apn_signing_key",
      showIf: { enable_push_notify: true },
      help: { topic: "APN Signing Key" },
    },
    {
      name: "apn_signing_key_id",
      showIf: { enable_push_notify: true },
      help: { topic: "APN Signing Key ID" },
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
        contents: [
          renderForm(form, req.csrfToken()) +
            button(
              {
                id: "generate-vapid-keys-btn",
                class: "btn btn-primary d-none",
                onclick:
                  "if (confirm('Are you sure? The old keys will be lost, and existing subscriptions will be deleted.')) ajax_post_btn('/notifications/generate-vapid-keys', true)",
              },
              "Generate VAPID keys"
            ) +
            script(
              domReady(`
  const fn = () => {
    const pushEnabled = document.getElementById("inputenable_push_notify");
    const generateBtn = document.getElementById("generate-vapid-keys-btn");
    if (pushEnabled && pushEnabled.checked) {
      generateBtn.classList.remove("d-none");
      generateBtn.classList.add("d-inline");
    }
    else {
      generateBtn.classList.remove("d-inline");
      generateBtn.classList.add("d-none");
    }
  };
  setTimeout(fn, 0);
  const mainForm = document.querySelector("form[action='/admin/notifications']");
  if (mainForm) {
    mainForm.addEventListener("change", (e) => {
      fn();
    });
  }`)
            ),
        ],
      },
    });
  },
});
