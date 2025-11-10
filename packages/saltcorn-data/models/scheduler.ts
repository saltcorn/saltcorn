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
import WorkflowRun from "./workflow_run";
import Notification from "./notification";
import { MailQueue } from "./internal/mail_queue";
import User from "./user";
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

const regexHHMM = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
const regexDDHHMM = /^([a-zA-Z]*) ([0-1]?[0-9]|2[0-3]) ([0-5][0-9])$/;

/**
 * @param {string} name
 * @param {number} hours
 * @returns {Promise<Trigger[]>}
 */

const getDailyTriggersDueNow = (tickSeconds: number): Array<Trigger> => {
  let triggers = Trigger.find({ when_trigger: "Daily" });

  return triggers.filter((tr) => {
    if (!tr.channel) return false;
    const m = tr.channel.match?.(regexHHMM);
    if (!m) return false;
    const time_to_run = new Date();
    time_to_run.setHours(+m[1]);
    time_to_run.setMinutes(+m[2]);
    const now = new Date();
    const nextTick = new Date();
    nextTick.setSeconds(nextTick.getSeconds() + tickSeconds);
    return time_to_run >= now && time_to_run < nextTick;
  });
};

const getWeeklyTriggersDueNow = (tickSeconds: number): Array<Trigger> => {
  let triggers = Trigger.find({ when_trigger: "Weekly" });

  return triggers.filter((tr) => {
    if (!tr.channel) return false;
    const m = tr.channel.match?.(regexDDHHMM);
    if (!m) return false;

    const now = new Date();
    if (m[1] !== now.toLocaleString("en-us", { weekday: "long" })) return false;

    const time_to_run = new Date();
    time_to_run.setUTCHours(+m[2]);
    time_to_run.setMinutes(+m[3]);

    const nextTick = new Date();
    nextTick.setSeconds(nextTick.getSeconds() + tickSeconds);
    return time_to_run >= now && time_to_run < nextTick;
  });
};

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
  let triggers = await Trigger.find({ when_trigger: name });

  // legacy: daily events without a specified time
  if (name === "Daily") {
    triggers = triggers.filter(
      (tr) => !tr.channel || !tr.channel.match?.(regexHHMM)
    );
  }
  if (name === "Weekly") {
    triggers = triggers.filter(
      (tr) => !tr.channel || !tr.channel.match?.(regexDDHHMM)
    );
  }
  due.setHours(due.getHours() + hours);
  if (now > due) {
    // we must have skipped events, e.g. if not running continuously
    due = now;
    due.setHours(due.getHours() + hours);
  }
  await state.setConfig(cfgField, due);
  state.log(5, `Event ${name}`);

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
const checkAvailability = async (
  port: number,
  host?: string
): Promise<void> => {
  try {
    const response = await fetch(
      `http://${host || "127.0.0.1"}:${port}/auth/login`
    );
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
  host,
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
    if (watchReaper && port) await checkAvailability(port, host);
    if (disableScheduler) return;

    stopit = await stop_when();
    if (stopit) return;
    const isHourly = await intervalIsNow("Hourly");
    const isDaily = await intervalIsNow("Daily");
    const isWeekly = await intervalIsNow("Weekly");
    getState().log(
      4,
      `Scheduler tick ${JSON.stringify({ isHourly, isDaily, isWeekly, now: new Date().toISOString() })}`
    );
    const tenants_crash_log = getState().getConfig("tenants_crash_log");

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
        const isThisTenantHourly = await intervalIsNow("Hourly");

        const triggers = await Trigger.find({ when_trigger: "Often" });
        const trsHourly = await getIntervalTriggersDueNow("Hourly", 1);
        const trsDaily = await getIntervalTriggersDueNow("Daily", 24);
        const trsDailyNowTime = getDailyTriggersDueNow(tickSeconds);
        const trsWeeklyNowTime = getWeeklyTriggersDueNow(tickSeconds);
        const trsWeekly = await getIntervalTriggersDueNow("Weekly", 24 * 7);
        const allTriggers = [
          ...triggers,
          ...trsHourly,
          ...trsDaily,
          ...trsWeekly,
          ...trsDailyNowTime,
          ...trsWeeklyNowTime,
        ];
        for (const trigger of allTriggers) {
          try {
            await db.withTransaction(async () => {
              await trigger.runWithoutRow({
                ...mockReqRes,
                user: { role_id: 1 },
              });
            });
          } catch (e) {
            if (isRoot || tenants_crash_log)
              await Crash.create(e, {
                url: `trigger: action ${trigger.action} id ${trigger.id}`,
                headers: {},
              });
          }
        }

        const snapshots_enabled = getState().getConfig("snapshots_enabled");
        if (snapshots_enabled && isThisTenantHourly) {
          await take_snapshot();
        }
        await WorkflowRun.runResumableWorkflows();
        if (isDaily) await WorkflowRun.prune();
      } catch (e) {
        console.error(`scheduler error in tenant ${db.getTenantSchema()}: `, e);
        if (db.getTenantSchema() === db.connectObj.default_schema)
          await Crash.create(e, {
            url: `Scheduler tenant ${db.getTenantSchema()}`,
            headers: {},
          });
      }

      // check pending emails
      try {
        const minDelay =
          getState().getConfig("mail_throttle_per_user", 30) * 1000;
        const now = Date.now();
        const pendingNotifications = await Notification.find({
          send_status: "pending",
          created: {
            gt: new Date(now - 7 * 24 * 60 * 60 * 1000),
            lt: new Date(now - minDelay * 8), // 4 minutes when using the default
          },
        });
        const pending: Record<number, Notification> = {};
        for (const pn of pendingNotifications) {
          if (pending[pn.user_id]) continue;
          pending[pn.user_id] = pn;
        }
        const usersWithPending = await User.find({
          id: { in: Object.keys(pending) },
        });
        for (const user of usersWithPending) {
          const passedDelay = MailQueue.getPassedDelay(
            await MailQueue.loadNotifications(user.id!)
          );
          if (passedDelay >= minDelay) {
            getState().log(5, `Emptying mail queue for user ${user.email}`);
            await MailQueue.emptyQueue(user);
          }
        }
      } catch (e) {
        console.error(`scheduler error check pending mails: `, e);
        await Crash.create(e, {
          url: `Scheduler check pending mail`,
          headers: {},
        });
      }
    });
    //auto backup
    try {
      const auto_backup_freq = getState().getConfig("auto_backup_frequency");
      if (
        (auto_backup_freq === "Daily" && isDaily) ||
        (auto_backup_freq === "Weekly" && isWeekly)
      ) {
        getState().log(5, `Auto backup now`);
        await auto_backup_now();
      }
    } catch (e) {
      console.error(`scheduler error backup: `, e);
      await Crash.create(e, {
        url: `Scheduler auto backup`,
        headers: {},
      });
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

export = { runScheduler, getDailyTriggersDueNow, getWeeklyTriggersDueNow };
