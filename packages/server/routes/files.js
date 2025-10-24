/**
 * Files Route
 * @category server
 * @module routes/files
 * @subcategory routes
 */

const Router = require("express-promise-router");
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const { getState } = require("@saltcorn/data/db/state");
const s3storage = require("../s3storage");
const resizer = require("resize-with-sharp-or-jimp");
const db = require("@saltcorn/data/db");

const { renderForm } = require("@saltcorn/markup");
const {
  isAdmin,
  error_catcher,
  setTenant,
  is_relative_url,
  isAdminOrHasConfigMinRole,
} = require("./utils.js");
const {
  h1,
  div,
  text,
  script,
  style,
  link,
  domReady,
} = require("@saltcorn/markup/tags");
const { editRoleForm, fileUploadForm } = require("../markup/forms.js");
const { strictParseInt } = require("@saltcorn/data/plugin-helper");
const {
  send_files_page,
  config_fields_form,
  save_config_from_form,
} = require("../markup/admin");
const fs = require("fs");
const path = require("path");
const Zip = require("adm-zip");
const stream = require("stream");
const { extract } = require("@saltcorn/admin-models/models/backup");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
/**
 * @type {object}
 * @const
 * @namespace filesRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

router.use(
  error_catcher(async (req, res, next) => {
    const state = getState();
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    if (maintenanceModeEnabled && (!req.user || req.user.role_id > 1)) {
      res.status(503).send("Page Unavailable: in maintenance mode");
      return;
    }
    next();
  })
);

const send_files_picker = async (folder, noSubdirs, inputId, req, res) => {
  res.set("SaltcornModalWidth", "1200px");
  res.sendWrap(req.__("Please select a file"), {
    above: [
      script({
        src: `/static_assets/${db.connectObj.version_tag}/bundle.js`,
        defer: true,
      }),
      script(
        domReady(
          `$("head").append('${link({
            rel: "stylesheet",
            href: `/static_assets/${db.connectObj.version_tag}/bundle.css`,
          })}')`
        )
      ),
      div({
        id: "saltcorn-file-manager",
        full_manager: "false",
        folder: folder,
        input_id: inputId,
        ...(noSubdirs ? { no_subdirs: "true" } : {}),
      }),
    ],
  });
};

router.get(
  "/picker",
  error_catcher(async (req, res) => {
    const { folder, input_id, no_subdirs } = req.query;
    send_files_picker(folder, no_subdirs, input_id, req, res);
  })
);

router.get(
  "/visible_entries",
  error_catcher(async (req, res) => {
    const role = req.user?.role_id ? req.user.role_id : 100;
    const userId = req.user?.id;
    const { dir, no_subdirs } = req.query;
    const noSubdirs = no_subdirs === "true";
    const safeDir = File.normalise(dir || "/");
    const absFolder = File.normalise_in_base(
      db.connectObj.file_store,
      db.getTenantSchema(),
      dir || "/"
    );
    if (absFolder === null) {
      res.json({ error: "Invalid path" });
      return;
    }
    const dirOnDisk = await File.from_file_on_disk(
      path.basename(absFolder),
      path.dirname(absFolder)
    );
    if (dirOnDisk.min_role_read < role) {
      getState().log(5, `Directory denied. path=${dir} role=${role}`);
      res.json({ files: [], roles: [], directories: [] });
      return;
    }
    const rows = (
      await File.find({ folder: dir }, { orderBy: "filename" })
    ).filter((f) => {
      if (noSubdirs && f.isDirectory) return false;
      else return role <= f.min_role_read || (userId && userId === f.user_id);
    });
    const roles = await User.get_roles();
    if (!no_subdirs && safeDir && safeDir !== "/" && safeDir !== ".") {
      let dirname = path.dirname(safeDir);
      if (dirname === ".") dirname = "/";
      rows.unshift(
        new File({
          filename: "..",
          location: dirname,
          isDirectory: true,
          mime_super: "",
          mime_sub: "",
        })
      );
    }

    for (const file of rows) {
      file.location = file.path_to_serve;
    }
    const directories = !noSubdirs
      ? (await File.allDirectories(true)).filter(
          (dir) => role <= dir.min_role_read
        )
      : [];
    for (const dir of directories) {
      dir.location = dir.path_to_serve;
    }
    res.json({ files: rows, roles, directories });
  })
);

/**
 * @name get
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.get(
  "/",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    // todo limit select from file by 10 or 20
    const { dir, search } = req.query;
    const safeDir = File.normalise(dir || "/");
    const rows = await File.find(
      { folder: dir, search },
      { orderBy: "filename" }
    );
    const roles = await User.get_roles();
    if (safeDir && safeDir !== "/" && safeDir !== ".") {
      let dirname = path.dirname(safeDir);
      if (dirname === ".") dirname = "/";
      rows.unshift(
        new File({
          filename: "..",
          location: dirname,
          isDirectory: true,
          mime_super: "",
          mime_sub: "",
        })
      );
    }
    if (req.xhr) {
      for (const file of rows) {
        file.location = file.path_to_serve;
      }
      const directories = await File.allDirectories(true);
      for (const file of directories) {
        file.location = file.path_to_serve;
      }
      res.json({ files: rows, roles, directories });
      return;
    }
    send_files_page({
      res,
      req,
      headers: [
        {
          script: `/static_assets/${db.connectObj.version_tag}/bundle.js`,
          defer: true,
        },
        {
          css: `/static_assets/${db.connectObj.version_tag}/bundle.css`,
        },
      ],
      active_sub: "Files",
      contents: {
        type: "card",
        contents: [
          div({ full_manager: "true", id: "saltcorn-file-manager" }),
          fileUploadForm(req, safeDir),
        ],
      },
    });
  })
);

/**
 * @name get/download/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.get(
  "/download/*serve_path",
  error_catcher(async (req, res) => {
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const user_id = req.user && req.user.id;
    const serve_path = path.join(...req.params.serve_path);
    const file = await File.findOne(serve_path);

    if (
      file &&
      (role <= file.min_role_read || (user_id && user_id === file.user_id))
    ) {
      res.type(file.mimetype);
      if (file.s3_store) s3storage.serveObject(file, res, true);
      else res.download(file.location, file.filename, { dotfiles: "allow" });
    } else {
      res
        .status(404)
        .sendWrap(req.__("Not found"), h1(req.__("File not found")));
    }
  })
);

router.post(
  "/download-zip",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const user_id = req.user && req.user.id;
    const files = (req.body || {}).files;
    const location = (req.body || {}).location;
    const zip = new Zip();

    for (const fileNm of files) {
      const file = await File.findOne(path.join(location, fileNm));
      if (
        file &&
        (role <= file.min_role_read || (user_id && user_id === file.user_id))
      ) {
        zip.addLocalFile(file.location);
      }
    }
    const readStream = new stream.PassThrough();
    readStream.end(zip.toBuffer());
    res.type("application/zip");
    res.attachment(
      `${getState().getConfig("site_name", db.getTenantSchema())}-files.zip`
    );
    readStream.pipe(res);
  })
);

/**
 * @name get/serve/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.get(
  "/serve/*serve_path",
  error_catcher(async (req, res) => {
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const user_id = req.user && req.user.id;
    const serve_path = path.join(...req.params.serve_path);
    //let file;
    //if (typeof strictParseInt(id) !== "undefined")
    const file = await File.findOne(serve_path);

    if (
      file &&
      (role <= file.min_role_read || (user_id && user_id === file.user_id))
    ) {
      if (
        (file.mimetype === "text/html" ||
          file.mimetype === "application/xhtml+xml") &&
        !getState().getConfig("file_serve_html") &&
        user_id !== file.user_id
      )
        res.type("text/plain");
      else res.type(file.mimetype);
      const cacheability = file.min_role_read === 100 ? "public" : "private";
      const maxAge = getState().getConfig("files_cache_maxage", 86400);
      res.set("Cache-Control", `${cacheability}, max-age=${maxAge}`);
      if (
        file.mimetype === "image/svg+xml" ||
        file.mimetype === "application/mathml+xml"
      ) {
        const window = new JSDOM("").window;
        const DOMPurify = createDOMPurify(window);
        const contents = await fs.promises.readFile(file.location);
        const clean = DOMPurify.sanitize(contents);
        res.send(clean);
        return;
      }
      if (file.s3_store) s3storage.serveObject(file, res, false);
      else res.sendFile(file.location, { dotfiles: "allow" });
    } else {
      getState().log(
        5,
        `File serve denied. path=${serve_path} file_exists=${!!file} file_min_role=${
          file?.min_role_read
        } role=${role} user_id=${user_id}`
      );
      res
        .status(404)
        .sendWrap(req.__("Not found"), h1(req.__("File not found")));
    }
  })
);

/**
 * @name get/resize/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.get(
  "/resize/:width_str/:height_str/*serve_path",
  error_catcher(async (req, res) => {
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const user_id = req.user && req.user.id;
    const { width_str, height_str } = req.params;
    const serve_path = path.join(...req.params.serve_path);

    const file = await File.findOne(serve_path);

    if (
      file &&
      (role <= file.min_role_read || (user_id && user_id === file.user_id))
    ) {
      if (
        (file.mimetype === "text/html" ||
          file.mimetype === "application/xhtml+xml") &&
        !getState().getConfig("file_serve_html")
      )
        res.type("text/plain");
      else res.type(file.mimetype);

      const cacheability = file.min_role_read === 100 ? "public" : "private";
      res.set("Cache-Control", `${cacheability}, max-age=86400`);
      //TODO s3
      if (file.s3_store) s3storage.serveObject(file, res, false);
      else {
        const width = strictParseInt(width_str);
        const height =
          height_str && height_str !== "0" ? strictParseInt(height_str) : null;
        if (!width) {
          res.sendFile(file.location, { dotfiles: "allow" });
          return;
        }
        const basenm = path.join(
          path.dirname(file.location),
          "_resized_" + path.basename(file.location)
        );
        const fnm = `${basenm}_w${width}${height ? `_h${height}` : ""}`;
        if (!fs.existsSync(fnm)) {
          await resizer({
            fromFileName: file.location,
            width,
            height,
            toFileName: fnm,
          });
        }
        res.sendFile(fnm, { dotfiles: "allow" });
      }
    } else {
      res
        .status(404)
        .sendWrap(req.__("Not found"), h1(req.__("File not found")));
    }
  })
);

/**
 * @name post/setrole/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.post(
  "/setrole/*serve_path",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    const serve_path = path.join(...req.params.serve_path);
    const file = await File.findOne(serve_path);
    const role = (req.body || {}).role;
    const roles = await User.get_roles();
    const roleRow = roles.find((r) => r.id === +role);

    if (roleRow && file) {
      await file.set_role(role);
    }

    res.redirect(
      file ? `/files?dir=${encodeURIComponent(file.current_folder)}` : "/files"
    );
  })
);

router.post(
  "/move/*serve_path",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    const serve_path = path.join(...req.params.serve_path);
    const file = await File.findOne(serve_path);
    const new_path = (req.body || {}).new_path;

    if (file) {
      await file.move_to_dir(new_path);
    }
    if (req.xhr) {
      res.json({ success: "ok" });
      return;
    }
    res.redirect(
      file ? `/files?dir=${encodeURIComponent(file.current_folder)}` : "/files"
    );
  })
);

/**
 * @name post/setname/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.post(
  "/setname/*serve_path",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    const serve_path = path.join(...req.params.serve_path);
    const filename = (req.body || {}).value;

    const file = await File.findOne(serve_path);
    await file.rename(filename);

    res.redirect(`/files?dir=${encodeURIComponent(file.current_folder)}`);
  })
);

/**
 * @name post/unzip/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.post(
  "/unzip/*serve_path",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    const serve_path = path.join(...req.params.serve_path);
    const filename = (req.body || {}).value;

    const file = await File.findOne(serve_path);
    const dir = path.dirname(file.location);
    if (file) await extract(file.location, dir);
    res.redirect(`/files?dir=${encodeURIComponent(file.current_folder)}`);
  })
);

router.post(
  "/new-folder",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    const { name, folder } = req.body || {};
    await File.new_folder(name, folder);

    res.json({ success: "ok" });
  })
);

/**
 * @name post/upload
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.post(
  "/upload",
  setTenant,
  error_catcher(async (req, res) => {
    let { folder, sortBy, sortDesc } = req.body || {};
    let jsonResp = {};
    const min_role_upload = getState().getConfig("min_role_upload", 1);
    const role = req.user && req.user.id ? req.user.role_id : 100;
    let file_for_redirect;
    if (role > +min_role_upload) {
      if (!req.xhr) req.flash("warning", req.__("Not authorized"));
      else jsonResp = { error: "Not authorized" };
    } else if (!req.files || !req.files.file) {
      if (!req.xhr) req.flash("warning", req.__("No file found"));
      else jsonResp = { error: "No file found" };
    } else {
      const min_role_read =
        req.body || {} ? (req.body || {}).min_role_read || 1 : 1;
      const f = await File.from_req_files(
        req.files.file,
        req.user.id,
        +min_role_read,
        folder ? File.normalise(folder) : undefined
      );
      const many = Array.isArray(f);
      file_for_redirect = many ? f[0] : f;
      const successMsg = req.__(
        `File %s uploaded`,
        many ? f.map((fl) => text(fl.filename)).join(", ") : text(f.filename)
      );
      if (!req.xhr) req.flash("success", successMsg);
      else
        jsonResp = {
          success: {
            filename: many ? f.map((fl) => fl.filename) : f.filename,
            location: many ? f.map((fl) => fl.path_to_serve) : f.path_to_serve,
            url: many
              ? f.map((fl) => `/files/serve/${fl.path_to_serve}`)
              : `/files/serve/${f.path_to_serve}`,
            msg: successMsg,
          },
        };
    }
    if (!req.xhr) {
      const sp = new URLSearchParams();
      if (file_for_redirect) sp.append("dir", file_for_redirect.current_folder);
      if (sortBy) sp.append("sortBy", sortBy);
      if (sortDesc) sp.append("sortDesc", sortDesc);
      const query = sp.toString();
      res.redirect(`/files${query ? `?${query}` : ""}`);
    } else res.json(jsonResp);
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.post(
  "/delete/*serve_path",
  isAdminOrHasConfigMinRole("min_role_edit_files"),
  error_catcher(async (req, res) => {
    const serve_path = path.join(...req.params.serve_path);
    const { redirect } = req.query;
    const f = await File.findOne(serve_path);
    if (!f) {
      req.flash("error", req.__("File not found"));
      res.redirect("/files");
      return;
    }
    const result = await f.delete(
      f.s3_store ? s3storage.unlinkObject : undefined
    );
    if (result && result.error) {
      if (req.xhr) {
        const root = path.join(db.connectObj.file_store, db.getTenantSchema());
        res.json({
          error: result.error.replaceAll(root, ""),
        });
        return;
      }
      req.flash("error", result.error);
    }
    if (!req.xhr)
      res.redirect(
        (is_relative_url(redirect) && redirect) ||
          `/files?dir=${encodeURIComponent(f.current_folder)}`
      );
    else res.json({ success: true });
  })
);

/**
 * S3 Storage settings form definition
 * @param {object} req request
 * @returns {Promise<Form>} form
 */
const storage_form = async (req) => {
  return await config_fields_form({
    req,
    field_names: [
      "storage_s3_enabled",
      "storage_s3_bucket",
      "storage_s3_path_prefix",
      "storage_s3_endpoint",
      "storage_s3_region",
      "storage_s3_access_key",
      "storage_s3_access_secret",
      "storage_s3_secure",
    ],
    action: "/files/storage",
  });
};

/**
 * Show S3 Settings
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/storage",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await storage_form(req);
    form.blurb = [
      `<div class="alert alert-warning">S3 storage options may not work for this release. Enabling S3 storage is not recommended</div>`,
    ];
    send_files_page({
      res,
      req,
      active_sub: "Storage",
      contents: {
        type: "card",
        title: req.__("Storage settings"),
        titleAjaxIndicator: true,
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * Update S3 Settings
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/storage",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await storage_form(req);
    form.validate(req.body || {});
    if (form.hasErrors) {
      send_files_page({
        res,
        req,
        active_sub: "Storage",
        contents: {
          type: "card",
          title: req.__("Storage settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);

      if (!req.xhr) {
        req.flash("success", req.__("Storage settings updated"));
        res.redirect("/files/storage");
      } else res.json({ success: "ok" });
    }
  })
);

/**
 * Files settings form definition
 * @param {object} req request
 * @returns {Promise<Form>} form
 */
const files_settings_form = async (req) => {
  return await config_fields_form({
    req,
    field_names: [
      "min_role_upload",
      "file_accept_filter_default",
      "files_cache_maxage",
      "file_upload_debug",
      "file_upload_limit",
      "file_upload_timeout",
      "file_serve_html",
    ],
    action: "/files/settings",
  });
};

/**
 * Show Files Settings
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.get(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await files_settings_form(req);
    send_files_page({
      res,
      req,
      active_sub: "Settings",
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__("Files settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * Update Files Settings
 * @function
 * @memberof module:routes/admin~routes/adminRouter
 */
router.post(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await files_settings_form(req);
    form.validate(req.body || {});
    if (form.hasErrors) {
      send_files_page({
        res,
        req,
        active_sub: "Settings",
        contents: {
          type: "card",
          title: req.__("Files settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);

      if (!req.xhr) {
        req.flash("success", req.__("Files settings updated"));
        res.redirect("/files/settings");
      } else res.json({ success: "ok" });
    }
  })
);
