const Crash = require("./crash");
const { eachTenant } = require("./tenant");
const Trigger = require("./trigger");
const db = require("../db");
const { getState } = require("../db/state");

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
  let due = state.getConfig(cfgField, false);
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
  const triggers = await Trigger.find({ when_trigger: name });
  due.setHours(due.getHours() + hours);
  await state.setConfig(cfgField, due);

  return triggers;
};

const runScheduler = async ({
  stop_when = () => false,
  tickSeconds = 60 * 5,
} = {}) => {
  let stopit;
  const run = async () => {
    stopit = await stop_when();
    if (stopit) return;
    await eachTenant(async () => {
      const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

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
