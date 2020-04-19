const app = require("./app");

const port = 3000;

//https://blog.cloudboost.io/waiting-for-db-connections-before-app-listen-in-node-f568af8b9ec9
app.on("ready", function() {
  app.listen(port, () => {
    console.log(`Saltcorn listening on port ${port}.`);
  });
});
