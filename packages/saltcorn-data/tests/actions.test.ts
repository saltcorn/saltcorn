import Trigger from "../models/trigger";
import Table from "../models/table";
import EventLog from "../models/eventlog";
import runScheduler from "../models/scheduler";
import db from "../db";
const { getState } = require("../db/state");
import mocks from "../tests/mocks";
const { plugin_with_routes, getActionCounter, resetActionCounter, sleep } =
  mocks;
import { assertIsSet } from "../tests/assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import baseactions, { emit_event, notify_user } from "../base-plugin/actions";
const { duplicate_row, insert_any_row, insert_joined_row, modify_row } =
  baseactions;
import utils from "../utils";
import Notification from "../models/notification";
const { applyAsync } = utils;

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

jest.setTimeout(10000);

describe("Action", () => {
  it("should add insert trigger", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    const table = Table.findOne({ name: "patients" });
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
    expect(trigger1.toJson).toStrictEqual({
      action: "incrementCounter",
      channel: null,
      configuration: {},
      description: null,
      min_role: null,
      name: null,
      table_name: "patients",
      when_trigger: "Insert",
    });
  });
  it("should add update trigger", async () => {
    expect(getActionCounter()).toBe(1);

    const table = Table.findOne({ name: "patients" });
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

    const table = Table.findOne({ name: "patients" });
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
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);

    await Trigger.create({
      action: "run_js_code",
      table_id: table.id,
      when_trigger: "Insert",
      configuration: {
        code: `
        const table = Table.findOne({ name: "patients" });
        await table.insertRow({ name: "TriggeredInsert" });
      `,
      },
    });
    await table.insertRow({ author: "Giuseppe Tomasi", pages: 209 });
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);

    await sleep(10);
    const rows = await patients.getRows({ name: "TriggeredInsert" });

    expect(rows.length).toBe(1);
  });
  it("should run webhook", async () => {
    const table = Table.findOne({ name: "books" });
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
    //const table = Table.findOne({ name: "books" });

    const triggers = await Trigger.findAllWithTableName();
    expect(triggers.length).toBe(5);
    const trigger = triggers.find(
      (tr) => tr && tr.table_name === "books" && tr.when_trigger === "Update"
    );
    assertIsSet(trigger);
    expect(trigger.action).toBe("webhook");
  });
  it("should have options", async () => {
    expect(Trigger.when_options).toContain("Insert");
  });
  it("should get triggers", async () => {
    const table = Table.findOne({ name: "books" });
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
    const table = Table.findOne({ name: "books" });
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
describe("base plugin actions", () => {
  it("should insert_any_row", async () => {
    const action = insert_any_row;
    const result = await action.run({
      row: { x: 3, y: 7 },
      configuration: { table: "patients", row_expr: '{name:"Simon1"}' },
      user: { id: 1, role_id: 1 },
    });
    expect(result).toBe(true);

    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);

    const rows = await patients.getRows({ name: "Simon1" });

    expect(rows.length).toBe(1);
  });
  it("should insert_any_row with field", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);

    const action = insert_any_row;
    const result = await action.run({
      row: { pages: 3, author: "Joe" },
      table: books,
      configuration: {
        table: "patients",
        row_expr: '{name:"Si"+row.pages+"mon"+author}',
      },
      user: { id: 1, role_id: 1 },
    });
    expect(result).toBe(true);

    await sleep(10);
    const rows = await patients.getRows({ name: "Si3monJoe" });

    expect(rows.length).toBe(1);
  });
  it("should modify_row", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const row = await patients.getRow({ name: "Simon1" });
    assertIsSet(row);

    expect(row.favbook).toBe(null);
    const result = await modify_row.run({
      row,
      table: patients,
      configuration: { row_expr: "{favbook:1}" },
      user: { id: 1, role_id: 1 },
    });
    expect(result).toStrictEqual({ reload_page: true });

    const row1 = await patients.getRow({ name: "Simon1" });
    assertIsSet(row1);

    expect(row1.favbook).toBe(1);
  });
  it("should duplicate_row", async () => {
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    const rows = await patients.getRows({ name: "Simon1" });

    expect(rows.length).toBe(1);
    const result = await duplicate_row.run({
      row: rows[0],
      table: patients,
      user: { id: 1, role_id: 1 },
    });
    const rows1 = await patients.getRows({ name: "Simon1" });

    expect(rows1.length).toBe(2);
  });
  it("should insert_joined_row", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const book = await books.getRow({ id: 1 });
    assertIsSet(book);
    const discusses_books = Table.findOne({ name: "discusses_books" });
    assertIsSet(discusses_books);
    const npats_before = await discusses_books.countRows({});
    const result = await insert_joined_row.run({
      table: discusses_books,
      row: book,
      configuration: { joined_table: `discusses_books.book` },
      user: { id: 1, role_id: 1 },
    });
    const npats_after = await discusses_books.countRows({});
    expect(npats_after).toBe(npats_before + 1);
  });
  it("should notify_user", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const book = await books.getRow({ id: 1 });
    assertIsSet(book);
    await notify_user.run({
      row: book,
      configuration: {
        user_spec: "{id:1}",
        title: "Hello",
        body: "World",
        link: "https://saltcorn.com",
      },
      user: { id: 1, role_id: 1 },
    });
    const notif = await Notification.findOne({ title: "Hello" });
    assertIsSet(notif);
    expect(notif.user_id).toBe(1);
    expect(notif.body).toBe("World");
  });
  it("should have valid configFields", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    for (const [name, action] of Object.entries(baseactions)) {
      if (!action.configFields) continue;
      const configFields = await applyAsync(action.configFields, {
        table: books,
      });
      expect(Array.isArray(configFields)).toBe(true);
    }
  });

  //TODO recalculate_stored_fields, set_user_language
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
      BarWasHere_channel: "Baz,oldbooks",
      Insert: true,
      Insert_readings: true,
    });
    await getState().refresh_config();
  });
  it("should emit custom event", async () => {
    const evs = await EventLog.find({ event_type: "FooHappened" });
    expect(evs.length).toBe(0);
    await Trigger.emitEvent("FooHappened");

    await sleep(200);
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
    const evs = await EventLog.find({ event_type: "BarWasHere" });
    expect(evs.length).toBe(0);
    await Trigger.emitEvent("BarWasHere");
    await Trigger.emitEvent("BarWasHere", "Zap");
    await Trigger.emitEvent("BarWasHere", "Baz");

    await sleep(100);
    const evs1 = await EventLog.find({ event_type: "BarWasHere" });
    expect(evs1.length).toBe(1);
  });
  it("should emit table event", async () => {
    await Trigger.emitEvent("Insert", "readings");
    const evs = await EventLog.find({ event_type: "Insert" });
    expect(evs.length).toBe(0);
    await sleep(100);
    const evs1 = await EventLog.find({ event_type: "Insert" });
    expect(evs1.length).toBe(1);
  });
  it("should run emit_event action", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const book = await books.getRow({ id: 1 });
    assertIsSet(book);
    const r = await emit_event.run({
      row: book,
      configuration: {
        eventType: "BarWasHere",
        channel: "oldbooks",
      },
      user: { id: 1, role_id: 1 },
    });

    await sleep(100);

    const ev = await EventLog.findOne({
      event_type: "BarWasHere",
      channel: "oldbooks",
    });

    assertIsSet(ev);

    expect(ev.payload.pages).toBe(967);
  });
});

describe("Scheduler", () => {
  it("should run and tick", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
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
    });
    await sleep(500);
    expect(getActionCounter()).toBe(1);
    await sleep(1200);
    expect(getActionCounter() > 1).toBe(true);
    stopSched = true;
    await sleep(1200);
  });
});
