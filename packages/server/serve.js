const runScheduler = require("@saltcorn/data/models/scheduler");
const User = require("@saltcorn/data/models/user");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");

const path = require("path");

const getApp = require("./app");

module.exports = async ({ port = 3000, ...appargs } = {}) => {
  const app = await getApp(appargs);
  runScheduler();
  if (port === 80 && getState().getConfig("letsencrypt", false)) {
    const admin_users = await User.find({ role_id: 1 }, { orderBy: "id" });
    const file_store = db.connectObj.file_store;
    const Greenlock = require("greenlock");
    const greenlock = Greenlock.create({
      packageRoot: __dirname,
      configDir: path.join(file_store, "greenlock.d"),
      maintainerEmail: admin_users[0].email,
    });
    const certs = await greenlock._find({});
    console.log("Certificates:", certs);
    if (certs && certs.length > 0)
      require("greenlock-express")
        .init({
          packageRoot: __dirname,
          configDir: path.join(file_store, "greenlock.d"),
          maintainerEmail: admin_users[0].email,
          cluster: false,
        })
        .serve(app);
    else
      app.listen(port, () => {
        console.log(`Saltcorn listening on http://127.0.0.1:${port}/`);
      });
  } else
    app.listen(port, () => {
      console.log(`Saltcorn listening on http://127.0.0.1:${port}/`);
    });
};
