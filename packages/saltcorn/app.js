const express = require("express");
const mountRoutes = require("./routes");

const app = express();
app.use(express.urlencoded({ extended: true }));

mountRoutes(app);

app.get("/", (req, res) => res.send("Hello World!"));

module.exports = app;
