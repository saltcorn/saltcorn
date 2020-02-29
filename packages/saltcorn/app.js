const express = require("express");
const mountRoutes = require("./routes");
const { wrap, ul, link, ul_nav } = require("./routes/markup.js");
const View = require("./db/view");
const { get_available_views } = require("./db/state");

const app = express();

var views = [];

app.use(express.urlencoded({ extended: true }));

app.use(function(req, res, next) {
  res.sendWrap = function(title, ...html) {
    const views = get_available_views();

    const menuItems = [
      ...views.map(v => [`/view/${v.name}`, v.name]),
      ["/table", "Edit Tables"],
      ["/viewedit/list", "Edit Views"]
    ];
    res.send(wrap(title, ul_nav(menuItems), ...html));
  };
  next();
});
mountRoutes(app);

app.get("/", (req, res) => res.send("Hello World!"));

module.exports = app;
