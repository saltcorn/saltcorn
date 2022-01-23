import Trigger from "@saltcorn/data/models/trigger";
import Table from "@saltcorn/data/models/table";
import EventLog from "@saltcorn/data/models/eventlog";
import tenant from "../models/tenant";
const { eachTenant } = tenant;
import runScheduler from "@saltcorn/data/models/scheduler";
import db from "@saltcorn/data/db/index";
const { getState } = require("@saltcorn/data/db/state");
import mocks from "@saltcorn/data/tests/mocks";
const { plugin_with_routes, getActionCounter, resetActionCounter, sleep } =
  mocks;
import { assertIsSet } from "@saltcorn/data/tests/assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

afterAll(db.close);

beforeAll(async () => {
  await require("@saltcorn/data/db/reset_schema")();
  await require("@saltcorn/data/db/fixtures")();
});

jest.setTimeout(10000);

describe("Action", () => {
  it("should add insert trigger", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    const table = await Table.findOne({ name: "patients" });
    assertIsSet(table);
    const trigger = await Trigger.create({
      action: "incrementCounter",
      table_id: table.id,
      when_trigger: "Insert",
    });
    expect(getActionCounter()).toBe(0);
    await table.insertRow({ name: "Don Fabrizio" });
    await sleep(10);
    expect(getActionCounter()).toBe(1);
    const trigger1 = await Trigger.findOne({ id: trigger.id });
    expect(!!trigger1).toBe(true);
    expect(trigger1.id).toBe(trigger.id);
  });
  it("should add update trigger", async () => {
    expect(getActionCounter()).toBe(1);

    const table = await Table.findOne({ name: "patients" });
    assertIsSet(table);

    await Trigger.create({
      action: "setCounter",
      table_id: table.id,
      when_trigger: "Update",
      configuration: { number: 17 },
    });
    expect(getActionCounter()).toBe(1);
    const don = await table.getRow({ name: "Don Fabrizio" });
    assertIsSet(don);
    await table.updateRow({ name: "Don Fabrizio II" }, don.id);
    expect(getActionCounter()).toBe(17);
  });
  it("should add update trigger", async () => {
    expect(getActionCounter()).toBe(17);

    const table = await Table.findOne({ name: "patients" });
    assertIsSet(table);

    await Trigger.create({
      action: "setCounter",
      table_id: table.id,
      when_trigger: "Delete",
      configuration: { number: 37 },
    });
    expect(getActionCounter()).toBe(17);
    await table.deleteRows({ name: "Don Fabrizio" });
    expect(getActionCounter()).toBe(17);

    await table.deleteRows({ name: "Don Fabrizio II" });
    expect(getActionCounter()).toBe(37);
  });
  it("should run js code", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);

    await Trigger.create({
      action: "run_js_code",
      table_id: table.id,
      when_trigger: "Insert",
      configuration: {
        code: `
        const table = await Table.findOne({ name: "patients" });
        await table.insertRow({ name: "TriggeredInsert" });
      `,
      },
    });
    await table.insertRow({ author: "Giuseppe Tomasi", pages: 209 });
    const patients = await Table.findOne({ name: "patients" });
    assertIsSet(patients);

    await sleep(10);
    const rows = await patients.getRows({ name: "TriggeredInsert" });

    expect(rows.length).toBe(1);
  });
  it("should run webhook", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);

    await Trigger.create({
      action: "webhook",
      table_id: table.id,
      when_trigger: "Update",
      configuration: {
        // from https://requestbin.com/
        // to inspect https://pipedream.com/sources/dc_jku44wk
        url: "https://b6af540a71dce96ec130de5a0c47ada6.m.pipedream.net",
      },
    });
    const row = await table.getRow({ author: "Giuseppe Tomasi" });
    assertIsSet(row);
    await table.updateRow({ pages: 210 }, row.id);
  });

  it("should list triggers", async () => {
    //const table = await Table.findOne({ name: "books" });

    const triggers = await Trigger.findAllWithTableName();
    expect(triggers.length).toBe(5);
    const trigger = triggers.find(
      (tr) => tr && tr.table_name === "books" && tr.when_trigger === "Update"
    );
    assertIsSet(trigger);
    expect(trigger.action).toBe("webhook");
  });
  it("should get triggers", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);
    const trigger = await Trigger.findOne({
      table_id: table.id,
      when_trigger: "Update",
    });
    expect(trigger.action).toBe("webhook");
    await Trigger.update(trigger.id, { when_trigger: "Insert" });
    const ins_trigger = Trigger.find({
      table_id: table.id,
      when_trigger: "Insert",
    });
    expect(ins_trigger.length).toBe(2);
    await trigger.delete();
    const ins_trigger1 = Trigger.find({
      table_id: table.id,
      when_trigger: "Insert",
    });
    expect(ins_trigger1.length).toBe(1);
  });
  it("should run webhook on insert", async () => {
    const table = await Table.findOne({ name: "books" });
    assertIsSet(table);

    await Trigger.create({
      action: "webhook",
      table_id: table.id,
      when_trigger: "Insert",
      configuration: {
        // from https://requestbin.com/
        // to inspect https://pipedream.com/sources/dc_jku44wk
        url: "https://b6af540a71dce96ec130de5a0c47ada6.m.pipedream.net",
        body: "",
      },
    });
    await table.insertRow({ author: "NK Jemisin", pages: 901 });
  });
});

describe("Events", () => {
  it("should add custom event", async () => {
    await getState().setConfig("custom_events", [
      {
        name: "FooHappened",
        hasChannel: false,
      },
      {
        name: "BarWasHere",
        hasChannel: true,
      },
    ]);
    await getState().setConfig("event_log_settings", {
      FooHappened: true,
      BarWasHere: true,
      BarWasHere_channel: "Baz",
    });
    await getState().refresh_config();
  });
  it("should emit custom event", async () => {
    await Trigger.emitEvent("FooHappened");
    const evs = await EventLog.find({ event_type: "FooHappened" });
    expect(evs.length).toBe(0);
    await sleep(100);
    const evs1 = await EventLog.find({ event_type: "FooHappened" });
    expect(evs1.length).toBe(1);
  });
  it("should find with user", async () => {
    const ev = await EventLog.findOne({ event_type: "FooHappened" });
    assertIsSet(ev.id);
    const evlog_w_user = await EventLog.findOneWithUser(ev.id!);
    expect(evlog_w_user.event_type).toBe("FooHappened");
  });
  it("should emit custom event with channel", async () => {
    await Trigger.emitEvent("BarWasHere");
    await Trigger.emitEvent("BarWasHere", "Zap");
    await Trigger.emitEvent("BarWasHere", "Baz");
    const evs = await EventLog.find({ event_type: "BarWasHere" });
    expect(evs.length).toBe(0);
    await sleep(100);
    const evs1 = await EventLog.find({ event_type: "BarWasHere" });
    expect(evs1.length).toBe(1);
  });
});

describe("Scheduler", () => {
  it("should run and tick", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    await Trigger.create({
      action: "incrementCounter",
      when_trigger: "Often",
    });
    let stopSched = false;
    runScheduler({
      stop_when: () => stopSched,
      tickSeconds: 1,
      watchReaper: undefined,
      port: undefined,
      disableScheduler: undefined,
      eachTenant,
    });
    await sleep(500);
    expect(getActionCounter()).toBe(1);
    await sleep(1200);
    expect(getActionCounter() > 1).toBe(true);
    stopSched = true;
    await sleep(1200);
  });
});
