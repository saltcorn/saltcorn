const express = require("express");
const router = express.Router();
const oauthServer = require("../oauth/server");

router.get(
  "/authorize",
  oauthServer.authorize({
    authenticateHandler: {
      handle: (req, res) => {
        return { user: 1 }; // dummy authenticated user
      },
    },
  })
);

router.post(
  "/token",
  oauthServer.token({
    requireClientAuthentication: {
      authorization_code: true,
    },
  })
);

module.exports = router;
