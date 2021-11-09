/**
 * @category server
 * @module systemd
 */
const fetch = require("node-fetch");

/**
 * @param {number} interval 
 * @param {object} notify 
 * @param {object} opts 
 * @param {string} opts.port
 * @returns {void}
 */
const watchDog = (interval, notify, { port }) => {
  //we want to do a request / db check every 5 mins
  const pings_per_5_min = (5 * 60000) / interval;
  try {
    if (Math.random() < 1.0 / pings_per_5_min) {
      if (Math.random() < 0.5) {
        // count users - check db connection is alive
        const User = require("@saltcorn/data/models/user");
        User.count()
          .then((c) => {
            console.log("watchdog user count", c);
            notify.watchdog();
          })
          .catch((e) => {
            console.error(e);
            process.exit(1);
          });
      } else {
        // check we can serve
        fetch(`http://127.0.0.1:${port}/auth/login`)
          .then((response) => {
            console.log("watchdog request status", response.status);
            if (response.status < 400) notify.watchdog();
            else process.exit(1);
          })
          .catch((e) => {
            console.error(e);
            process.exit(1);
          });
      }
    } else return notify.watchdog();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

module.exports = 
/**
 * @function
 * @name "module.exports function"
 * @param {object} opts 
 */
(opts) => {
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
