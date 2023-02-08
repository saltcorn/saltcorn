const express = require("express");
const router = express.Router();
const oauthServer = require("../oauth/server");

router.get(
  "/",
  oauthServer.authenticate({ scope: "user.read" }),
  (req, res) => {
    return res.json({
      email: "foo@bar.com",
      id: 1,
    });
  }
);

module.exports = router;
