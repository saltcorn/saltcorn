/**
 * @category saltcorn-data
 * @module models/scheduler
 * @subcategory models
 */
import Crash from "./crash";
import Trigger from "./trigger";
import db from "../db";
const { getState } = require("../db/state");
import fetch from "node-fetch";
import EventLog from "./eventlog";
import mocks from "../tests/mocks";
const { mockReqRes } = mocks;

/**
 * @param {Date} date
 * @param {number} plusSeconds
 * @returns {Promise<void>}
 */
const sleepUntil = (date: Date, plusSeconds: number): Promise<void> => {
  const waitTill = new Date();
  waitTill.setTime(date.getTime() + 1000 * plusSeconds);
  const now = new Date();
  const ms = waitTill.getTime() - now.getTime();
  return new Promise((resolve) => setTimeout(resolve, ms));
};
const intervalIsNow = async (name: string): Promise<boolean> => {
  const state = getState();
  const cfgField = `next_${name.toLowerCase()}_event`;
  const now = new Date();
  let due = state.getConfigCopy(cfgField, false);
  //console.log({due, name, now});
  if (!due) {
    //first run, set rnd due
    return false;
  }
  due = new Date(due);

  return due < now;
};
/**
 * @param {string} name
 * @param {number} hours
 * @returns {Promise<Trigger[]>}
 */
const getIntervalTriggersDueNow = async (
  name: string,
  hours: number
): Promise<Array<Trigger>> => {
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
    payload: null,
    occur_at: new Date(),
  });
  return triggers;
};

let availabilityPassed = false;

/**
 * @param {string} port
 * @returns {Promise<void>}
 */
const checkAvailability = async (port: number): Promise<void> => {
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

/**
 * @param {object} opts
 * @param {function} [opts.stop_when]
 * @param {number} [opts.number]
 * @param {boolean} opts.watchReaper
 * @param {string} opts.port
 * @param {boolean} opts.disableScheduler
 * @returns {Promise<void>}
 */
const runScheduler = async ({
  stop_when = () => false,
  tickSeconds = 60 * 5,
  watchReaper,
  port,
  disableScheduler,
  eachTenant = (f: () => Promise<any>) => {
    return f();
  },
  auto_backup_now = () => {},
  take_snapshot = () => {},
}:
  | {
      stop_when?: () => boolean;
      tickSeconds?: number;
      watchReaper?: boolean;
      port?: number;
      disableScheduler?: boolean;
      eachTenant: (f: () => Promise<any>) => Promise<void>;
    }
  | any = {}) => {
  let stopit;
  const run = async () => {
    if (watchReaper && port) await checkAvailability(port);
    if (disableScheduler) return;

    stopit = await stop_when();
    if (stopit) return;
    const isHourly = await intervalIsNow("Hourly");
    const isDaily = await intervalIsNow("Daily");
    const isWeekly = await intervalIsNow("Weekly");
    //console.log({ isHourly, isDaily, isWeekly, now: new Date() });

    await eachTenant(async () => {
      try {
        const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

        EventLog.create({
          event_type: "Often",
          channel: null,
          user_id: null,
          payload: null,
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
            await trigger.runWithoutRow(mockReqRes);
          } catch (e) {
            if (isRoot)
              await Crash.create(e, {
                url: `trigger: action ${trigger.action} id ${trigger.id}`,
                headers: {},
              });
          }
        }
        const snapshots_enabled = getState().getConfig("snapshots_enabled");
        if (snapshots_enabled && isHourly) {
          await take_snapshot();
        }
      } catch (e) {
        console.error(`scheduler error in tenant ${db.getTenantSchema()}: `, e);
      }
    });
    //auto backup
    const auto_backup_freq = getState().getConfig("auto_backup_frequency");
    if (
      (auto_backup_freq === "Daily" && isDaily) ||
      (auto_backup_freq === "Weekly" && isWeekly)
    ) {
      await auto_backup_now();
    }
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

export = runScheduler;
