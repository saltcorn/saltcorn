const table = require("./tables");
const field = require("./fields");
const list = require("./list");
const edit = require("./edit");
const del = require("./delete");

module.exports = app => {
  app.use("/table", table);
  app.use("/field", field);
  app.use("/list", list);
  app.use("/edit", edit);
  app.use("/delete", del);
};
