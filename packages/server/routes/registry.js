const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, link, post_btn } = require("@saltcorn/markup");
const {
  script,
  domReady,
  div,
  i,
  text,
  button,
  input,
  label,
  form,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { isAdmin, error_catcher } = require("./utils");
const moment = require("moment");
const { send_infoarch_page } = require("../markup/admin.js");

/**
 * @type {object}
 * @const
 * @namespace listRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    send_infoarch_page({
      res,
      req,
      active_sub: "Registry editor",
      contents: [
        {
          type: "card",
          contents: [],
        },
      ],
    });
  })
);
