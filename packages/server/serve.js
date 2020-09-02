const getApp = require("./app");

module.exports = async (portArg) => {
  const port = portArg || 3000;
  const app = await getApp();
  app.listen(port, () => {
    console.log(`Saltcorn listening on http://127.0.0.1:${port}/`);
  });
};
