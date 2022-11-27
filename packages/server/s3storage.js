const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { getState } = require("@saltcorn/data/db/state");
const fileUpload = require("express-fileupload");
const { v4: uuidv4 } = require("uuid");
const contentDisposition = require("content-disposition");

function createS3Client() {
  return new aws.S3({
    secretAccessKey: getState().getConfig("storage_s3_access_secret"),
    accessKeyId: getState().getConfig("storage_s3_access_key"),
    region: getState().getConfig("storage_s3_region"),
    endpoint: getState().getConfig("storage_s3_endpoint"),
  });
}

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
          s3: createS3Client(),
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
      const fileSizeLimit = getState().getConfig("file_upload_limit", 0);
      fileUpload({
        useTempFiles: true,
        createParentPath: true,
        tempFileDir: "/tmp/",
        // set to true - if you want to have debug
        debug: getState().getConfig("file_upload_debug",false),
        //uriDecodeFileNames: true,
        //safeFileNames: true,
        defCharset: 'utf8',
        defParamCharset: 'utf8',
        // 0 - means no upload limit check
        limits: {
          fileSize: fileSizeLimit,
        },
        abortOnLimit: fileSizeLimit !== 0,
        // 0 - means no upload limit check
        uploadTimeout: getState().getConfig("file_upload_timeout",0),

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
    const s3 = createS3Client();
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
      const s3 = createS3Client();
      const bucket = getState().getConfig("storage_s3_bucket");

      const params = {
        Bucket: bucket,
        Key: file.location,
      };

      // Forward the object
      s3.getObject(params)
        .on("httpHeaders", function (statusCode, headers) {
          if (!!download)
            res.set("Content-Disposition", contentDisposition(file.filename));
          res.set("Content-Length", headers["content-length"]);
          this.response.httpResponse.createUnbufferedStream().pipe(res);
        })
        .send();
    } else {
      // Use legacy file download
      res.download(file.location, file.filename);
    }
  },

  unlinkObject: function (file) {
    if (file.s3_store) {
      const s3 = createS3Client();
      return new Promise((resolve, reject) => {
        s3.deleteObject(
          {
            Bucket: getState().getConfig("storage_s3_bucket"),
            Key: file.location,
          },
          (err, data) => {
            if (err) reject(err);
            else resolve(data);
          }
        );
      });
    } else {
      return fs.unlink(file.location);
    }
  },
};
