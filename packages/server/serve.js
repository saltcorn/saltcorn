const runScheduler = require("@saltcorn/data/models/scheduler");
const getApp = require("./app");

module.exports = async ({ port = 3000, ...appargs } = {}) => {
  const app = await getApp(appargs);
  runScheduler();
  app.listen(port, () => {
    console.log(`Saltcorn listening on http://127.0.0.1:${port}/`);
  });
};
