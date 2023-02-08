const express = require("express");
const router = express.Router();
const http = require("http");

const app = express();
app.use(
  express.urlencoded({ limit: "5mb", extended: true, parameterLimit: 50000 })
);
app.use(
  express.json({
    limit: "5mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use("/oauth2", require("./routes/auth.js"));
app.use("/user", require("./routes/user.js"));
app.use(
  "/",
  router.get("/", (req, res) => {
    res.send("I'm awake");
  })
);
const httpServer = http.createServer(app);
httpServer.listen(3030, () => {
  console.log(`Test OAuth2 server listening on http://localhost:3030/`);
});
