const fetch = require("node-fetch");

const watchDog = (interval, notify, { port }) => {
  //we want to do a request / db check every 5 mins
  const pings_per_5_min = (5 * 60000) / interval;

  if (Math.random() < 1.0 / pings_per_5_min) {
    if (Math.random() < 0.5) {
      // count users - check db connection is alive
      const User = require("@saltcorn/data/models/user");
      User.count().then((c) => {
        console.log("watchdog user count", c);
        notify.watchdog();
      });
    } else {
      // check we can serve
      fetch(`http://127.0.0.1:${port}/auth/login`).then((response) => {
        console.log("watchdog request status", response.status);
        if (response.status < 400) notify.watchdog();
      });
    }
  } else return notify.watchdog();
};

module.exports = (opts) => {
  try {
    const notify = require("sd-notify");
    notify.ready();
    const watchdogInterval = notify.watchdogInterval();
    if (watchdogInterval && watchdogInterval > 0) {
      const interval = Math.floor(watchdogInterval / 2);
      setInterval(() => {
        watchDog(interval, notify, opts);
      }, interval);
    }
  } catch {}
};
