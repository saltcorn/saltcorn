const table = require("./tables");
const field = require("./fields");
const list = require("./list");
const edit = require("./edit");

module.exports = app => {
  app.use("/table", table);
  app.use("/field", field);
  app.use("/list", list);
  app.use("/edit", edit);
};
