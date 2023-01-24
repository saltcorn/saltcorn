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
const { isAdmin, error_catcher, setTenant } = require("./utils.js");
const { h1, div, text } = require("@saltcorn/markup/tags");
const { editRoleForm, fileUploadForm } = require("../markup/forms.js");
const { strictParseInt } = require("@saltcorn/data/plugin-helper");
const {
  send_files_page,
  config_fields_form,
  save_config_from_form,
} = require("../markup/admin");
const fs = require("fs");
const path = require("path");

/**
 * @type {object}
 * @const
 * @namespace filesRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * Edit file Role form
 * @param {*} file
 * @param {*} roles
 * @param {*} req
 * @returns {Form}
 */
const editFileRoleForm = (file, roles, req) =>
  editRoleForm({
    url: `/files/setrole/${file.path_to_serve}`,
    current_role: file.min_role_read,
    roles,
    req,
  });

/**
 * @name get
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    // todo limit select from file by 10 or 20
    const { dir } = req.query;
    const safeDir = File.normalise(dir || "/");
    const rows = await File.find({ folder: dir }, { orderBy: "filename" });
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
      const directories = await File.allDirectories();
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
          div({ id: "saltcorn-file-manager" }),
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
  "/download/*",
  error_catcher(async (req, res) => {
    const role = req.user && req.user.id ? req.user.role_id : 10;
    const user_id = req.user && req.user.id;
    const serve_path = req.params[0];
    const file = await File.findOne(serve_path);

    if (
      file &&
      (role <= file.min_role_read || (user_id && user_id === file.user_id))
    ) {
      res.type(file.mimetype);
      if (file.s3_store) s3storage.serveObject(file, res, true);
      else res.download(file.location, file.filename);
    } else {
      res
        .status(404)
        .sendWrap(req.__("Not found"), h1(req.__("File not found")));
    }
  })
);

/**
 * @name get/serve/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.get(
  "/serve/*",
  error_catcher(async (req, res) => {
    const role = req.user && req.user.id ? req.user.role_id : 10;
    const user_id = req.user && req.user.id;
    const serve_path = req.params[0];
    //let file;
    //if (typeof strictParseInt(id) !== "undefined")
    const file = await File.findOne(serve_path);

    if (
      file &&
      (role <= file.min_role_read || (user_id && user_id === file.user_id))
    ) {
      res.type(file.mimetype);
      const cacheability = file.min_role_read === 10 ? "public" : "private";
      res.set("Cache-Control", `${cacheability}, max-age=86400`);
      if (file.s3_store) s3storage.serveObject(file, res, false);
      else res.sendFile(file.location);
    } else {
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
  "/resize/:width_str/:height_str/*",
  error_catcher(async (req, res) => {
    const role = req.user && req.user.id ? req.user.role_id : 10;
    const user_id = req.user && req.user.id;
    const { width_str, height_str } = req.params;
    const serve_path = req.params[0];

    const file = await File.findOne(serve_path);

    if (
      file &&
      (role <= file.min_role_read || (user_id && user_id === file.user_id))
    ) {
      res.type(file.mimetype);
      const cacheability = file.min_role_read === 10 ? "public" : "private";
      res.set("Cache-Control", `${cacheability}, max-age=86400`);
      //TODO s3
      if (file.s3_store) s3storage.serveObject(file, res, false);
      else {
        const width = strictParseInt(width_str);
        const height =
          height_str && height_str !== "0" ? strictParseInt(height_str) : null;
        if (!width) {
          res.sendFile(file.location);
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
        res.sendFile(fnm);
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
  "/setrole/*",
  isAdmin,
  error_catcher(async (req, res) => {
    const serve_path = req.params[0];
    const file = await File.findOne(serve_path);
    const role = req.body.role;
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
  "/move/*",
  isAdmin,
  error_catcher(async (req, res) => {
    const serve_path = req.params[0];
    const file = await File.findOne(serve_path);
    const new_path = req.body.new_path;

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
  "/setname/*",
  isAdmin,
  error_catcher(async (req, res) => {
    const serve_path = req.params[0];
    const filename = req.body.value;

    const file = await File.findOne(serve_path);
    await file.rename(filename);

    res.redirect(`/files?dir=${encodeURIComponent(file.current_folder)}`);
  })
);

router.post(
  "/new-folder",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name, folder } = req.body;
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
    let { folder } = req.body;
    let jsonResp = {};
    const min_role_upload = getState().getConfig("min_role_upload", 1);
    const role = req.user && req.user.id ? req.user.role_id : 10;
    let file_for_redirect;
    if (role > +min_role_upload) {
      if (!req.xhr) req.flash("warning", req.__("Not authorized"));
      else jsonResp = { error: "Not authorized" };
    } else if (!req.files || !req.files.file) {
      if (!req.xhr) req.flash("warning", req.__("No file found"));
      else jsonResp = { error: "No file found" };
    } else {
      const min_role_read = req.body ? req.body.min_role_read || 1 : 1;
      const f = await File.from_req_files(
        req.files.file,
        req.user.id,
        +min_role_read,
        folder ? File.normalise(folder) : undefined
      );
      const many = Array.isArray(f);
      file_for_redirect = many ? f[0] : f;
      if (!req.xhr)
        req.flash(
          "success",
          req.__(
            `File %s uploaded`,
            many
              ? f.map((fl) => text(fl.filename)).join(", ")
              : text(f.filename)
          )
        );
      else
        jsonResp = {
          success: {
            filename: many ? f.map((fl) => fl.filename) : f.filename,
            location: many ? f.map((fl) => fl.path_to_serve) : f.path_to_serve,
            url: many
              ? f.map((fl) => `/files/serve/${fl.path_to_serve}`)
              : `/files/serve/${f.path_to_serve}`,
          },
        };
    }
    if (!req.xhr)
      res.redirect(
        !file_for_redirect
          ? "/files"
          : `/files?dir=${encodeURIComponent(file_for_redirect.current_folder)}`
      );
    else res.json(jsonResp);
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:routes/files~filesRouter
 * @function
 */
router.post(
  "/delete/*",
  isAdmin,
  error_catcher(async (req, res) => {
    const serve_path = req.params[0];
    const f = await File.findOne(serve_path);
    if (!f) {
      req.flash("error", "File not found");
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
    res.redirect(`/files?dir=${encodeURIComponent(f.current_folder)}`);
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
    form.validate(req.body);
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
      "file_upload_debug",
      "file_upload_limit",
      "file_upload_timeout",
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
    form.validate(req.body);
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
