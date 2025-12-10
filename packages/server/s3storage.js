const multer = require("multer");
const multerS3 = require("multer-s3");
const { getState } = require("@saltcorn/data/db/state");
const {
  getS3Client,
  getServeUrl: getS3ServeUrl,
  deleteObject: deleteS3Object,
} = require("@saltcorn/data/models/internal/s3_helpers");
const fileUpload = require("express-fileupload");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

module.exports = {
  /**
   * Selector for file upload handler middleware. It will dispatch the
   * file upload handler to the engine specified in the configuration.
   *
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  middlewareSelect: async function (req, res, next) {
    const useS3 = getState().getConfig("storage_s3_enabled");
    if (useS3 === true) {
      // Create S3 object

      // Create multer function
      const s3upload = multer({
        storage: multerS3({
          s3: getS3Client(),
          bucket: getState().getConfig("storage_s3_bucket"),
          metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
          },
          key: function (req, file, cb) {
            cb(null, "tmp/" + Date.now().toString() + uuidv4());
          },
        }),
      }).any();

      s3upload(req, res, next);
    } else {
      // Use regular file upload https://www.npmjs.com/package/express-fileupload
      const fileSizeLimit =
        1024 * +getState().getConfig("file_upload_limit", 0);
      fileUpload({
        useTempFiles: true,
        createParentPath: true,
        tempFileDir: "/tmp/",
        // set to true - if you want to have debug
        debug: getState().getConfig("file_upload_debug", false),
        //uriDecodeFileNames: true,
        //safeFileNames: true,
        defCharset: "utf8",
        defParamCharset: "utf8",
        // 0 - means no upload limit check
        limits: fileSizeLimit
          ? {
              fileSize: fileSizeLimit,
              fieldSize: fileSizeLimit,
            }
          : {},
        abortOnLimit: fileSizeLimit !== 0,
        // 0 - means no upload limit check
        uploadTimeout: getState().getConfig("file_upload_timeout", 0),
      })(req, res, next);
    }
  },

  /**
   * Transform the processed req.files into that is suitable with
   * Saltcorn File interface. It must be run after the middlewareSelect
   *
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  middlewareTransform: async function (req, res, next) {
    // If nothing to process or S3 is not enabled
    const useS3 = getState().getConfig("storage_s3_enabled");
    if (!req.files || !useS3) {
      next();
      return;
    }

    // Create S3 object
    const s3 = getS3Client();
    const bucket = getState().getConfig("storage_s3_bucket");

    let newFileObject = {};
    for (const file of req.files) {
      file.mv = (newpath) => {
        return new Promise((resolve, reject) => {
          s3.copyObject(
            {
              Bucket: bucket,
              CopySource: bucket + "/" + file.key,
              Key: newpath,
            },
            function (err, data) {
              if (err) reject(err);
              else {
                // Then delete
                s3.deleteObject(
                  {
                    Bucket: bucket,
                    Key: file.key,
                  },
                  (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                  }
                );
              }
            }
          );
        });
      };
      file.s3object = true;
      file.name = file.originalname;
      newFileObject[file.fieldname] = file;
    }
    req.files = newFileObject;
    next();
  },

  /**
   * Selector to serve object based on S3 state
   *
   * @param {*} file
   * @param {*} res
   * @param {*} download
   */
  serveObject: function (file, res, download) {
    if (file.s3_store) {
      module.exports
        .redirectToObject(file, res, download)
        .catch((e) => {
          getState().log(3, e.message || e);
          res.status(500).send("Unable to redirect to object");
        });
    } else {
      res.download(file.location, file.filename, { dotfiles: "allow" });
    }
  },

  redirectToObject: async function (file, res, download) {
    const url = await getS3ServeUrl(file.location, {
      download,
      filename: file.filename,
    });
    res.redirect(url);
  },

  getObjectUrl: async function (file, download) {
    return await getS3ServeUrl(file.location, {
      download,
      filename: file.filename,
    });
  },

  unlinkObject: function (file) {
    if (file.s3_store) {
      return deleteS3Object(file.location);
    } else {
      return fs.unlink(file.location);
    }
  },
};
