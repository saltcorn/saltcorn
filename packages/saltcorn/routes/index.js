const table = require("./tables");
const field = require("./fields");

module.exports = app => {
  app.use("/table", table);
  app.use("/field", field);
};
