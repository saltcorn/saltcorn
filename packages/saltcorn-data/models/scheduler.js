const Crash = require("./crash");
const { eachTenant } = require("./tenant");
const Trigger = require("./trigger");
const db = require("../db");
const { getState } = require("../db/state");
const fetch = require("node-fetch");
const EventLog = require("./eventlog");

const sleepUntil = (date, plusSeconds) => {
  const waitTill = new Date();
  waitTill.setTime(date.getTime() + 1000 * plusSeconds);
  const now = new Date();
  const ms = waitTill.getTime() - now.getTime();
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const getIntervalTriggersDueNow = async (name, hours) => {
  const state = getState();
  const cfgField = `next_${name.toLowerCase()}_event`;
  const now = new Date();
  let due = state.getConfigCopy(cfgField, false);
  //console.log({due, name, now});
  if (!due) {
    //first run, set rnd due
    const due_in_hrs = Math.random() * hours;
    if (hours < 4) now.setMinutes(now.getMinutes() + due_in_hrs * 60);
    else now.setHours(now.getHours() + due_in_hrs);
    await state.setConfig(cfgField, now);
    return [];
  }
  due = new Date(due);
  if (due > now) return [];
  //console.log("after check", {due, name, now});
  const triggers = await Trigger.find({ when_trigger: name });
  due.setHours(due.getHours() + hours);
  if (now > due) {
    // we must have skipped events, e.g. if not running continuously
    due = now;
    due.setHours(due.getHours() + hours);
  }
  await state.setConfig(cfgField, due);
  EventLog.create({
    event_type: name,
    channel: null,
    user_id: null,
    payload:null,
    occur_at: new Date(),
  });
  return triggers;
};

let availabilityPassed = false;

const checkAvailability = async (port) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/auth/login`);
    const pass = response.status < 400;
    if (pass) availabilityPassed = true;
    else if (availabilityPassed) {
      console.error("Availability check failed, restarting...");
      try {
        await Crash.create(new Error("Availability check failed"), {
          url: "/",
          headers: {},
        });
      } catch {}
      process.exit(1);
    }
  } catch (e) {
    console.error("Error in availability check", e);
    if (availabilityPassed) process.exit(1);
  }
};

const runScheduler = async ({
  stop_when = () => false,
  tickSeconds = 60 * 5,
  watchReaper,
  port,
  disableScheduler,
} = {}) => {
  let stopit;
  const run = async () => {
    if (watchReaper) await checkAvailability(port);
    if (disableScheduler) return;

    stopit = await stop_when();
    if (stopit) return;
    await eachTenant(async () => {
      const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

      EventLog.create({
        event_type: "Often",
        channel: null,
        user_id: null,
        payload:null,
        occur_at: new Date(),
      });

      const triggers = await Trigger.find({ when_trigger: "Often" });
      const trsHourly = await getIntervalTriggersDueNow("Hourly", 1);
      const trsDaily = await getIntervalTriggersDueNow("Daily", 24);
      const trsWeekly = await getIntervalTriggersDueNow("Weekly", 24 * 7);
      const allTriggers = [
        ...triggers,
        ...trsHourly,
        ...trsDaily,
        ...trsWeekly,
      ];
      for (const trigger of allTriggers) {
        try {
          await trigger.runWithoutRow();
        } catch (e) {
          if (isRoot)
            await Crash.create(e, {
              url: `trigger: action ${trigger.action} id ${trigger.id}`,
              headers: {},
            });
        }
      }
    });
  };

  let i = 0;
  const firstrun = new Date();
  await run();

  while (!stopit) {
    i += 1;
    await sleepUntil(firstrun, tickSeconds * i);
    await run();
  }
};

module.exports = runScheduler;
