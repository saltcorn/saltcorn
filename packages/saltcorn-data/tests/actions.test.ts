import Trigger from "../models/trigger.js";
import Table from "../models/table.js";
import Field from "../models/field.js";
import User from "../models/user.js";
import EventLog from "../models/eventlog.js";
import * as scheduler from "../models/scheduler.js";
import {
  parseCron,
  isValidCron,
  cronMatches,
  cronDueInWindow,
} from "../models/internal/cron.js";
import { getState } from "../db/state.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
const { runScheduler, getCronTriggersDueNow, resolveTickSeconds } =
  scheduler;
import db from "../db/index.js";
import * as mocks from "./mocks.js";
const {
  plugin_with_routes,
  getActionCounter,
  resetActionCounter,
  mockReqRes,
  sleep,
} = mocks;
import { assertIsRow, assertIsSet } from "../tests/assertions.js";
import {
  afterAll,
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@saltcorn/db-common/test_expect";
import baseactions from "../base-plugin/actions.js";
const {
  duplicate_row,
  insert_any_row,
  insert_joined_row,
  modify_row,
  delete_rows,
  emit_event,
  notify_user,
  run_js_code,
} = baseactions;
import * as utils from "../utils.js";
import Notification from "../models/notification.js";
import { run_action_column } from "../plugin-helper.js";
const { applyAsync, mergeActionResults } = utils;
import { createServer, Server } from "http";
import type { AddressInfo } from "net";
import type { Where } from "@saltcorn/db-common/internal";

// Stand-in for the endpoint the webhook action posts to. These tests used to
// post to an external request bin, so any network hiccup left the row
// untouched and failed the assertion.
let webhookServer: Server | undefined;
let webhookUrl: string;
const webhookRequests: Array<{ method: string; body: string }> = [];

afterAll(db.close);

beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
  // the webhook action sends everything through HTTPS_PROXY when it is set,
  // which cannot reach the loopback server below. Test files get their own
  // process, so this only affects this suite.
  delete process.env.HTTPS_PROXY;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      webhookRequests.push({ method: req.method!, body });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  webhookServer = server;
  webhookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  // beforeAll runs lazily, so with a --test-name-pattern that matches nothing
  // in this file the server was never started but this hook still runs
  const server = webhookServer;
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve()))
  );
});

jest.setTimeout(20000);

describe("Action and Trigger model", () => {
  it("should add insert trigger", async () => {
    getState()!.registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    const table = Table.findOne({ name: "patients" })!;
    assertIsSet(table);
    const trigger = await Trigger.create({
      action: "incrementCounter",
      table_id: table.id,
      when_trigger: "Insert",
      name: "incCount",
    });
    expect(getActionCounter()).toBe(0);
    await table.insertRow({ name: "Don Fabrizio" });
    await sleep(10);
    expect(getActionCounter()).toBe(1);
    const trigger1 = await Trigger.findOne({ id: trigger.id });
    expect(!!trigger1).toBe(true);
    expect(trigger1!.id).toBe(trigger.id);
    expect(trigger1!.toJson).toStrictEqual({
      action: "incrementCounter",
      channel: null,
      configuration: {},
      description: null,
      min_role: 100,
      name: "incCount",
      table_name: "patients",
      when_trigger: "Insert",
    });
  });
  it("should clone trigger", async () => {
    const trig = await Trigger.findOne({ name: "incCount" });
    assertIsSet(trig);
    await trig.clone();
    await trig.clone();
    const trig1 = await Trigger.findOne({ name: "incCount-copy" });
    assertIsSet(trig1);
    const trig2 = await Trigger.findOne({ name: "incCount-copy-1" });
    assertIsSet(trig2);
  });
  it("should add update trigger", async () => {
    expect(getActionCounter()).toBe(1);

    const table = Table.findOne({ name: "patients" })!;
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

    const table = Table.findOne({ name: "patients" })!;
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
    const table = Table.findOne({ name: "books" })!;
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
    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);

    await sleep(10);
    const rows = await patients.getRows({ name: "TriggeredInsert" });

    expect(rows.length).toBe(1);
  });
  it("should run webhook", async () => {
    const table = Table.findOne({ name: "books" })!;
    assertIsSet(table);

    await Trigger.create({
      action: "webhook",
      table_id: table.id,
      when_trigger: "Update",
      configuration: {
        url: webhookUrl,
      },
    });
    const row = await table.getRow({ author: "Giuseppe Tomasi" });
    assertIsSet(row);
    await table.updateRow({ pages: 210 }, row.id);
  });

  it("should list triggers", async () => {
    //const table = Table.findOne({ name: "books" })!;

    const triggers = await Trigger.findAllWithTableName();
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
    const table = Table.findOne({ name: "books" })!;
    assertIsSet(table);
    const trigger = await Trigger.findOne({
      table_id: table.id,
      when_trigger: "Update",
    });
    expect(trigger!.action).toBe("webhook");
    await Trigger.update(trigger!.id!, { when_trigger: "Insert" });
    const ins_trigger = Trigger.find({
      table_id: table.id,
      when_trigger: "Insert",
    });
    expect(ins_trigger.length).toBe(2);
    await trigger!.delete();
    const ins_trigger1 = Trigger.find({
      table_id: table.id,
      when_trigger: "Insert",
    });
    expect(ins_trigger1.length).toBe(1);
  });
  it("should run webhook on insert", async () => {
    const table = Table.findOne({ name: "books" })!;
    assertIsSet(table);

    await Trigger.create({
      action: "webhook",
      table_id: table.id,
      when_trigger: "Insert",
      configuration: {
        url: webhookUrl,
        body: "{foo: author}",
        response_field: "author",
      },
    });
    const id = await table.insertRow(
      { author: "NK Jemisin", pages: 901 },
      undefined,
      {}
    );
    const row = await table.getRow({ id });
    expect(row?.author).toBe('{"success":true}');
    const request = webhookRequests[webhookRequests.length - 1];
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toStrictEqual({ foo: "NK Jemisin" });
  });
  it("should run triggerwith table.run_trigger", async () => {
    getState()!.registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    const table = Table.findOne({ name: "patients" })!;
    assertIsSet(table);
    await table.run_trigger("incCount", { name: "Mary Boas" });
    expect(getActionCounter()).toBe(1);
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
    expect(result).toStrictEqual({});

    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);

    const rows = await patients.getRows({ name: "Simon1" });

    expect(rows.length).toBe(1);
  });
  it("should insert_any_row and return id", async () => {
    const action = insert_any_row;
    const result = await action.run({
      row: { x: 3, y: 7 },
      configuration: {
        table: "patients",
        row_expr: '{name:"Simon9"}',
        id_variable: "myid",
      },
      user: { id: 1, role_id: 1 },
    });
    assertIsRow(result);
    expect(typeof result.myid).toBe("number");

    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);

    const rows = await patients.getRows({ name: "Simon9" });

    expect(rows.length).toBe(1);
  });
  it("insert_any_row should upsert", async () => {
    const exrow = await Table.findOne("patients")?.getRow({ name: "Simon9" });
    const id = exrow?.id;
    const action = insert_any_row;
    const result = await action.run({
      row: { x: 3, y: 7 },
      configuration: {
        table: "patients",
        row_expr: `{name:"Simon99", id:${id}}`,
        id_variable: "myid",
      },
      user: { id: 1, role_id: 1 },
    });
    expect(result).toStrictEqual({ myid: id });

    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);

    const rows = await patients.getRows({ name: "Simon99" });

    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(id);
    const rows1 = await patients.getRows({ name: "Simon9" });

    expect(rows1.length).toBe(0);
  });
  it("should insert_any_row on arrays", async () => {
    const action = insert_any_row;
    const result = await action.run({
      row: { x: 3, y: 7 },
      configuration: {
        table: "patients",
        row_expr: '[{name:"Simon2"}, {name:"Simon2"}]',
      },
      user: { id: 1, role_id: 1 },
    });
    expect(result).toStrictEqual({});

    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);

    const rows = await patients.getRows({ name: "Simon2" });

    expect(rows.length).toBe(2);
  });
  it("should insert_any_row on arrays and return ids", async () => {
    const action = insert_any_row;
    const result = await action.run({
      row: { x: 3, y: 7 },
      configuration: {
        table: "patients",
        row_expr: '[{name:"Simon10"}, {name:"Simon11"}]',
        id_variable: "myids",
      },
      user: { id: 1, role_id: 1 },
    });
    assertIsRow(result);
    expect(result.myids.length).toBe(2);
    expect(typeof result.myids[0]).toBe("number");
    expect(result.myids[0]).toBeGreaterThan(2);

    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);

    const rows = await patients.getRows({ name: "Simon2" });

    expect(rows.length).toBe(2);
  });
  it("should insert_any_row with field", async () => {
    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);
    const books = Table.findOne({ name: "books" })!;
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
    expect(result).toStrictEqual({});

    await sleep(10);
    const rows = await patients.getRows({ name: "Si3monJoe" });

    expect(rows.length).toBe(1);
  });
  it("should modify_row", async () => {
    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);
    const row = await patients.getRow({ name: "Simon1" });
    assertIsSet(row);

    expect(row.favbook).toBe(null);
    const result = await modify_row.run({
      row,
      table: patients,
      configuration: { row_expr: "{favbook:1}", where: "Database" } as any,
      user: { id: 1, role_id: 1 },
    });
    expect(result).toStrictEqual(undefined);

    const row1 = await patients.getRow({ name: "Simon1" });
    assertIsSet(row1);

    expect(row1.favbook).toBe(1);
  });
  it("should delete_rows", async () => {
    const patients = Table.findOne({ name: "patients" })!;
    assertIsSet(patients);
    const id1 = await patients.insertRow({ name: "Del1" });
    await patients.insertRow({ name: "Del2" });
    const row = await patients.getRow({ id: id1 });
    assertIsSet(row);
    const result = await delete_rows.run({
      row,
      table: patients,
      configuration: { delete_triggering_row: true },
      user: { id: 1, role_id: 1 },
    } as any);
    expect(result).toStrictEqual({});

    const row1 = await patients.getRow({ name: "Del1" });
    expect(row1).toBe(null);
    const row1a = await patients.getRow({ name: "Del2" });
    expect(!!row1a).toBe(true);

    const result1 = await delete_rows.run({
      configuration: {
        delete_triggering_row: false,
        delete_where: "{name: 'Del2'}",
        table_name: "patients",
      },
      user: { id: 1, role_id: 1 },
    } as any);
    expect(result1).toStrictEqual({});
    const row2 = await patients.getRow({ name: "Del2" });
    expect(row2).toBe(null);
  });
  it("should duplicate_row", async () => {
    const patients = Table.findOne({ name: "patients" })!;
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
    const books = Table.findOne({ name: "books" })!;
    assertIsSet(books);
    const book = await books.getRow({ id: 1 });
    assertIsSet(book);
    const discusses_books = Table.findOne({ name: "discusses_books" })!;
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
    const books = Table.findOne({ name: "books" })!;
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
    const books = Table.findOne({ name: "books" })!;
    assertIsSet(books);
    for (const [name, action] of Object.entries(baseactions)) {
      // @ts-ignore
      if (!action.configFields) continue;
      // @ts-ignore
      const configFields = await applyAsync(action.configFields, {
        table: books,
      });
      expect(Array.isArray(configFields)).toBe(true);
    }
  });

  //TODO recalculate_stored_fields, set_user_language
});
describe("run_js_code", () => {
  it("should return value", async () => {
    const rres = await run_js_code.run({
      configuration: {
        code: "return 5",
        run_where: "Server",
      },
      user: { id: 1, role_id: 1 },
    });
    expect(rres).toBe(5);
  });
  it("should assert in run_js_code", async () => {
    const rres = await run_js_code.run({
      configuration: {
        code: `assert(1);return 5`,
        run_where: "Server",
      },
      user: { id: 1, role_id: 1 },
    });
    expect(rres).toBe(5);
    const rres1 = await run_js_code.run({
      configuration: {
        code: `assert.ok(1);return 5`,
        run_where: "Server",
      },
      user: { id: 1, role_id: 1 },
    });
    expect(rres1).toBe(5);
  });
  it("should fail assert in run_js_code", async () => {
    await expect(
      (async () =>
        await run_js_code.run({
          configuration: {
            code: `assert(0);return 5`,
            run_where: "Server",
          },
          user: { id: 1, role_id: 1 },
        }))()
    ).rejects.toThrow();
  });
});

// Trigger.emitEvent is fire-and-forget: it works off a setTimeout and does not
// await the EventLog write. Poll for the expected number of log rows rather
// than sleeping a fixed time, which a slow database driver will overrun. On
// timeout return whatever is there, so the caller's assertion reports it.
const waitForEventLogs = async (
  where: Where,
  count: number,
  timeout_ms: number = 10000
): Promise<EventLog[]> => {
  const start = Date.now();
  while (true) {
    const evs = await EventLog.find(where, { orderBy: "id" });
    if (evs.length >= count || Date.now() - start > timeout_ms) return evs;
    await sleep(50);
  }
};

describe("Events and eventlog", () => {
  it("should add custom event", async () => {
    await getState()!.setConfig("custom_events", [
      {
        name: "FooHappened",
        hasChannel: false,
      },
      {
        name: "BarWasHere",
        hasChannel: true,
      },
    ]);
    await getState()!.setConfig("event_log_settings", {
      FooHappened: true,
      BarWasHere: true,
      BarWasHere_channel: "Baz,oldbooks",
      Insert: true,
      Insert_readings: true,
    });
    await getState()!.refresh_config();
  });
  it("should emit custom event", async () => {
    const evs = await EventLog.find({ event_type: "FooHappened" });
    expect(evs.length).toBe(0);
    Trigger.emitEvent("FooHappened");

    const evs1 = await waitForEventLogs({ event_type: "FooHappened" }, 1);
    expect(evs1.length).toBe(1);
  });
  it("should find with user", async () => {
    const ev = await EventLog.findOne({ event_type: "FooHappened" });
    assertIsSet(ev.id);
    const evlog_w_user = await EventLog.findOneWithUser(ev.id!);
    expect(evlog_w_user?.event_type).toBe("FooHappened");
  });
  it("should emit custom event with channel", async () => {
    const evs = await EventLog.find({ event_type: "BarWasHere" });
    expect(evs.length).toBe(0);
    Trigger.emitEvent("BarWasHere");
    Trigger.emitEvent("BarWasHere", "Zap");
    Trigger.emitEvent("BarWasHere", "Baz");

    // only the Baz channel is in event_log_settings. It is emitted last, so
    // once it has been logged the other two have already been discarded
    const evs1 = await waitForEventLogs({ event_type: "BarWasHere" }, 1);
    expect(evs1.length).toBe(1);
  });
  it("should emit custom event with array payload", async () => {
    const evs = await EventLog.find({ event_type: "BarWasHere" });

    Trigger.emitEvent("BarWasHere", "Baz", {}, [{ x: 1 }, { x: 2 }]);

    const evs1 = await waitForEventLogs(
      { event_type: "BarWasHere" },
      evs.length + 1
    );
    expect(evs1.length).toBe(evs.length + 1);

    expect(Array.isArray(evs1[evs1.length - 1].payload)).toBe(true);
  });
  it("should emit custom event with object payload", async () => {
    const evs = await EventLog.find({ event_type: "BarWasHere" });

    Trigger.emitEvent("BarWasHere", "Baz", {}, { x: 1 });

    const evs1 = await waitForEventLogs(
      { event_type: "BarWasHere" },
      evs.length + 1
    );
    expect(evs1.length).toBe(evs.length + 1);

    expect(evs1[evs1.length - 1].payload.x).toBe(1);
  });
  it("should emit custom event with string payload", async () => {
    const evs = await EventLog.find({ event_type: "BarWasHere" });

    Trigger.emitEvent("BarWasHere", "Baz", {}, "Hello!");

    const evs1 = await waitForEventLogs(
      { event_type: "BarWasHere" },
      evs.length + 1
    );
    expect(evs1.length).toBe(evs.length + 1);

    expect(evs1[evs1.length - 1].payload).toBe("Hello!");
  });
  it("should emit custom event with null payload", async () => {
    const evs = await EventLog.find({ event_type: "BarWasHere" });

    Trigger.emitEvent("BarWasHere", "Baz", {}, null);

    const evs1 = await waitForEventLogs(
      { event_type: "BarWasHere" },
      evs.length + 1
    );
    expect(evs1.length).toBe(evs.length + 1);

    expect(evs1[evs1.length - 1].payload).toBe(null);
  });
  it("should emit custom event with bool payload", async () => {
    const evs = await EventLog.find({ event_type: "BarWasHere" });

    Trigger.emitEvent("BarWasHere", "Baz", {}, true);

    const evs1 = await waitForEventLogs(
      { event_type: "BarWasHere" },
      evs.length + 1
    );
    expect(evs1.length).toBe(evs.length + 1);

    expect(evs1[evs1.length - 1].payload).toBe(true);
  });

  it("should emit table event", async () => {
    // check the starting state before emitting: emitEvent is fire-and-forget
    // (it logs from a setTimeout), so asserting evs.length === 0 *after* the
    // emit is a race - the log write can land before the find() resolves.
    const evs = await EventLog.find({ event_type: "Insert" });
    expect(evs.length).toBe(0);
    Trigger.emitEvent("Insert", "readings");
    const evs1 = await waitForEventLogs({ event_type: "Insert" }, 1);
    expect(evs1.length).toBe(1);
  });
  it("should run emit_event action", async () => {
    const books = Table.findOne({ name: "books" })!;
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

    const evs = await waitForEventLogs(
      { event_type: "BarWasHere", channel: "oldbooks" },
      1
    );
    expect(evs.length).toBe(1);
    expect(evs[0].payload.pages).toBe(967);
  });
});

// A scheduler tick runs a dozen queries before it gets to the trigger, so how
// long it takes to increment the counter depends on the database. Poll rather
// than sleeping a fixed time a slow driver will overrun. On timeout return the
// current value, so the caller's assertion reports it.
const waitForActionCounter = async (
  count: number,
  timeout_ms: number = 10000
): Promise<number> => {
  const start = Date.now();
  while (true) {
    const n = getActionCounter();
    if (n >= count || Date.now() - start > timeout_ms) return n;
    await sleep(50);
  }
};

describe("Scheduler", () => {
  it("should run and tick", async () => {
    getState()!.registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    await Trigger.create({
      action: "incrementCounter",
      when_trigger: "Often",
    });
    let stopSched = false;
    const schedulerDone = runScheduler({
      stop_when: () => stopSched,
      tickSeconds: 1,
      watchReaper: undefined,
      port: undefined,
      disableScheduler: undefined,
    });
    // first tick
    expect((await waitForActionCounter(1)) >= 1).toBe(true);
    // it keeps ticking
    expect((await waitForActionCounter(2)) > 1).toBe(true);
    stopSched = true;
    // await the loop rather than sleeping: it only checks stop_when at the top
    // of the next tick, which can be later than any fixed sleep
    await schedulerDone;
  });
});

describe("Cron expressions", () => {
  const matchesAt = (expr: string, iso: string) => {
    const spec = parseCron(expr);
    assertIsSet(spec);
    return cronMatches(spec, new Date(iso));
  };

  it("accepts valid expressions", () => {
    for (const expr of [
      "* * * * *",
      "0 9 * * 1-5",
      "*/10 * * * *",
      "0 0 1 1 *",
      "15,45 * * * *",
      "0 9-17/2 * * *",
      "0 0 * jan mon",
      "@daily",
      "  0 9 * * *  ",
    ])
      expect(isValidCron(expr)).toBe(true);
  });

  it("rejects invalid expressions", () => {
    for (const expr of [
      "",
      "* * * *",
      "* * * * * *",
      "60 * * * *",
      "* 24 * * *",
      "* * 0 * *",
      "* * * 13 *",
      "* * * * 8",
      "*/0 * * * *",
      "5-1 * * * *",
      "banana",
      "* * * * mondayish",
    ])
      expect(isValidCron(expr)).toBe(false);
  });

  it("matches minute, hour and month fields", () => {
    // 2024-03-06 is a Wednesday
    expect(matchesAt("30 14 * * *", "2024-03-06T14:30:00")).toBe(true);
    expect(matchesAt("30 14 * * *", "2024-03-06T14:31:00")).toBe(false);
    expect(matchesAt("*/15 * * * *", "2024-03-06T14:45:00")).toBe(true);
    expect(matchesAt("*/15 * * * *", "2024-03-06T14:46:00")).toBe(false);
    expect(matchesAt("0 0 * mar *", "2024-03-06T00:00:00")).toBe(true);
    expect(matchesAt("0 0 * apr *", "2024-03-06T00:00:00")).toBe(false);
  });

  it("treats day-of-month and day-of-week as either/or when both are set", () => {
    // 2024-03-06 Wednesday, 2024-03-10 Sunday
    expect(matchesAt("0 0 10 * wed", "2024-03-06T00:00:00")).toBe(true);
    expect(matchesAt("0 0 10 * wed", "2024-03-10T00:00:00")).toBe(true);
    expect(matchesAt("0 0 10 * wed", "2024-03-07T00:00:00")).toBe(false);
    // only one restricted: that one alone decides
    expect(matchesAt("0 0 10 * *", "2024-03-06T00:00:00")).toBe(false);
    expect(matchesAt("0 0 * * wed", "2024-03-06T00:00:00")).toBe(true);
  });

  it("accepts both 0 and 7 for Sunday", () => {
    expect(matchesAt("0 0 * * 0", "2024-03-10T00:00:00")).toBe(true);
    expect(matchesAt("0 0 * * 7", "2024-03-10T00:00:00")).toBe(true);
  });

  it("finds occurrences within a window but not outside it", () => {
    const from = new Date("2024-03-06T14:02:30");
    expect(cronDueInWindow("*/5 * * * *", from, 300)).toBe(true); // 14:05
    expect(cronDueInWindow("0 15 * * *", from, 300)).toBe(false); // an hour off
    expect(cronDueInWindow("0 15 * * *", from, 60 * 60)).toBe(true);
    expect(cronDueInWindow("not a cron", from, 300)).toBe(false);
  });

  it("does not re-fire an occurrence earlier in the current minute", () => {
    // 14:02:00 already fired in the window that ended at 14:02:30
    const expr = "2 14 * * *";
    expect(cronDueInWindow(expr, new Date("2024-03-06T14:02:30"), 300)).toBe(
      false
    );
    expect(cronDueInWindow(expr, new Date("2024-03-06T14:02:00"), 300)).toBe(
      true
    );
  });
});

describe("Scheduler tick", () => {
  it("defaults to five minutes and follows the config", async () => {
    expect(resolveTickSeconds()).toBe(300);

    await getState()!.setConfig("scheduler_tick_seconds", 60);
    expect(resolveTickSeconds()).toBe(60);

    // a tick passed to runScheduler wins over the config
    expect(resolveTickSeconds(1)).toBe(1);

    // an implausibly short configured tick is floored
    await getState()!.setConfig("scheduler_tick_seconds", 2);
    expect(resolveTickSeconds()).toBe(10);

    await getState()!.setConfig("scheduler_tick_seconds", 300);
  });
});

describe("Cron triggers", () => {
  it("are picked up by the scheduler only when due", async () => {
    const due = await Trigger.create({
      name: "CronDue",
      action: "run_js_code",
      when_trigger: "Cron",
      channel: "* * * * *",
      configuration: { code: "" },
    });
    // half an hour away, so outside the next tick either way
    const notDueMinute = (new Date().getMinutes() + 30) % 60;
    const notDue = await Trigger.create({
      name: "CronNotDue",
      action: "run_js_code",
      when_trigger: "Cron",
      channel: `${notDueMinute} * * * *`,
      configuration: { code: "" },
    });
    const noExpression = await Trigger.create({
      name: "CronNoExpression",
      action: "run_js_code",
      when_trigger: "Cron",
      configuration: { code: "" },
    });

    const names = getCronTriggersDueNow(300).map((t) => t.name);
    expect(names.includes("CronDue")).toBe(true);
    expect(names.includes("CronNotDue")).toBe(false);
    expect(names.includes("CronNoExpression")).toBe(false);

    await due.delete();
    await notDue.delete();
    await noExpression.delete();
  });
});

describe("Validate action", () => {
  it("it should setup", async () => {
    const persons = await Table.create("ValidatedTable");
    await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: persons,
      name: "age",
      type: "Integer",
    });
    await Trigger.create({
      action: "run_js_code",
      table_id: persons.id,
      when_trigger: "Validate",
      configuration: {
        code: `
        if(age && age<16) return {error: "Must be 16+ to qualify"}
        if(!row.name) return {set_fields: {name: "PersonAged"+age}}
      `,
      },
    });
  });

  it("it should insert valid rows", async () => {
    const table = Table.findOne({ name: "ValidatedTable" })!;
    assertIsSet(table);
    await table.insertRow({ name: "Mike", age: 19 });
    const row = await table.getRow({ name: "Mike" });
    assertIsSet(row);
    expect(row.age).toBe(19);
  });
  it("it should not insert invalid rows", async () => {
    const table = Table.findOne({ name: "ValidatedTable" })!;
    assertIsSet(table);
    await table.insertRow({ name: "Fred", age: 14 });
    const row = await table.getRow({ name: "Fred" });
    expect(row).toBe(null);
  });
  it("it should set fields", async () => {
    const table = Table.findOne({ name: "ValidatedTable" })!;
    assertIsSet(table);
    await table.insertRow({ age: 25 });
    const row = await table.getRow({ age: 25 });
    assertIsSet(row);
    expect(row.name).toBe("PersonAged25");
  });
  it("it should not update to invalid row", async () => {
    const table = Table.findOne({ name: "ValidatedTable" })!;
    assertIsSet(table);
    const row = await table.getRow({ name: "Mike" });
    assertIsSet(row);

    const upres = await table.updateRow({ name: "Mike", age: 12 }, row.id);
    expect(upres).toBe("Must be 16+ to qualify");

    const row1 = await table.getRow({ id: row.id });
    assertIsSet(row1);
    expect(row1.age).toBe(19);
    expect(row1.name).toBe("Mike");
  });
  it("it should update to valid row", async () => {
    const table = Table.findOne({ name: "ValidatedTable" })!;
    assertIsSet(table);
    const row = await table.getRow({ name: "Mike" });
    assertIsSet(row);

    const upres = await table.updateRow({ name: "Mike", age: 29 }, row.id);
    expect(upres).toBe(undefined);

    const row1 = await table.getRow({ id: row.id });
    assertIsSet(row1);
    expect(row1.age).toBe(29);
    expect(row1.name).toBe("Mike");
  });
  it("it should not change missing fields on update", async () => {
    const table = Table.findOne({ name: "ValidatedTable" })!;
    assertIsSet(table);
    const row = await table.getRow({ name: "Mike" });
    assertIsSet(row);

    const upres = await table.updateRow({ age: 31 }, row.id);
    expect(upres).toBe(undefined);

    const row1 = await table.getRow({ id: row.id });
    assertIsSet(row1);
    expect(row1.age).toBe(31);
    expect(row1.name).toBe("Mike");
  });
});

describe("Validate to create email", () => {
  it("it should setup field", async () => {
    await Field.create({
      table: User.table,
      name: "username",
      type: "String",
    });
  });
  /*it("it should not create user without email", async () => {
    async function create_user() {
      await User.create({
        username: "tomn18",
        password: "s3cr3t893",
      });
    }
    expect(create_user).rejects.toThrow();
    const u = await User.findOne({ username: "tomn18" });
    expect(u).toBe(null);
  }); */

  it("it should setup", async () => {
    await Trigger.create({
      action: "run_js_code",
      table_id: User.table.id,
      when_trigger: "Validate",
      configuration: {
        code: `if(!row.email) return {set_fields: {email: row.username+"@anonymous.com"}}; else return {}`,
      },
    });
  });
  it("it should set new user email in Validate", async () => {
    await User.create({
      username: "tomn19",
      password: "s3cr3t893",
    });
    const u = await User.findOne({ username: "tomn19" });
    assertIsSet(u);
    expect(u.username).toBe("tomn19");
    expect(u.email).toBe("tomn19@anonymous.com");
  });
});

describe("mergeActionResults", () => {
  it("it should merge errors", async () => {
    const result = { error: "Foo" };
    mergeActionResults(result, { error: "Bar" });
    expect(result.error).toStrictEqual(["Foo", "Bar"]);
  });

  it("it should overwrite other keys", async () => {
    const result = { error0: "Foo" };
    mergeActionResults(result, { error0: "Bar" });
    expect(result.error0).toStrictEqual("Bar");
  });

  it("it should merge set_fields", async () => {
    const result = {};
    mergeActionResults(result, { set_fields: { y: 2 } });
    mergeActionResults(result, { set_fields: { z: 3 } });
    expect(result).toStrictEqual({ set_fields: { y: 2, z: 3 } });
  });
});

describe("multistep triggers", () => {
  it("should run", async () => {
    const trigger = await Trigger.findOne({ name: "MySteps" });
    const runres = await trigger!.runWithoutRow({});
    expect(runres.error).toBe("errrr");
    expect(runres.notify).toBe("note");
    expect(runres.notify_success).toBe("fooo");
  });
});

describe("run_action_column", () => {
  it("should run state action", async () => {
    const runres = await run_action_column({
      req: mockReqRes.req,
      col: {
        type: "action",
        block: false,
        rndid: "2d6f57",
        nsteps: 1,
        confirm: false,
        minRole: 100,
        isFormula: {},
        action_icon: "",
        action_name: "toast",
        action_label: "",
        configuration: {
          text: "note2",
          run_where: "Server",
          notify_type: "Notify",
        },
      },
    });
    expect(runres).toStrictEqual({ notify: "note2" });
  });
  it("should run trigger action", async () => {
    const runres = await run_action_column({
      req: mockReqRes.req,
      col: {
        type: "action",
        block: false,
        rndid: "2d6f57",
        nsteps: 1,
        confirm: false,
        minRole: 100,
        isFormula: {},
        action_icon: "",
        action_name: "Toast1",
        action_label: "",
        configuration: {},
      },
    });
    expect(runres).toStrictEqual({ notify_success: "fooo" });
  });
  it("should run multistep builder", async () => {
    const runres = await run_action_column({
      req: mockReqRes.req,
      col: {
        type: "action",
        block: false,
        rndid: "5f990e",
        nsteps: "2",
        confirm: false,
        minRole: 100,
        isFormula: {},
        action_icon: "",
        action_name: "Multi-step action",
        action_label: "",
        configuration: {
          steps: [
            {
              code: "1;",
              run_where: "Server",
            },
            {
              text: "note3",
              notify_type: "Notify",
            },
            {
              text: "succ3",
              notify_type: "Success",
            },
          ],
        },
        step_action_names: ["run_js_code", "toast", "toast"],
      },
    });
    expect(runres).toStrictEqual({ notify: "note3", notify_success: "succ3" });
  });
  it("should run multistep builder with trigger step", async () => {
    const runres = await run_action_column({
      req: mockReqRes.req,
      col: {
        type: "action",
        block: false,
        rndid: "45a31c",
        nsteps: "2",
        confirm: false,
        minRole: 100,
        isFormula: {},
        action_icon: "",
        action_name: "Multi-step action",
        action_label: "",
        configuration: {
          steps: [
            {
              text: "note3",
              notify_type: "Notify",
            },
            {
              text: "succ3",
              notify_type: "Success",
            },
          ],
        },
        step_action_names: ["toast", "Toast1"],
      },
    });
    expect(runres).toStrictEqual({ notify: "note3", notify_success: "fooo" });
  });
  it("should run multitrigger step", async () => {
    const runres = await run_action_column({
      req: mockReqRes.req,
      col: {
        type: "action",
        block: false,
        rndid: "cd9965",
        nsteps: 1,
        confirm: false,
        minRole: 100,
        isFormula: {},
        action_icon: "",
        action_name: "MySteps",
        action_label: "",
        configuration: {},
      },
    });
    expect(runres.error).toBe("errrr");
    expect(runres.notify).toBe("note");
    expect(runres.notify_success).toBe("fooo");
  });
});

describe("_only_if with old_row on Update trigger", () => {
  it("should set up trigger with _only_if using old_row", async () => {
    getState()!.registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();

    const table = Table.findOne({ name: "patients" })!;
    assertIsSet(table);

    await Trigger.create({
      action: "setCounter",
      table_id: table.id,
      when_trigger: "Update",
      name: "onlyIfOldRow",
      configuration: {
        number: 99,
        _only_if: "row.old_row.name !== row.name",
      },
    });
  });

  it("should fire trigger when name changes (row.old_row.name !== row.name)", async () => {
    resetActionCounter();
    const table = Table.findOne({ name: "patients" })!;
    assertIsSet(table);

    const row = await table.getRow({ name: "Kirk Douglas" });
    assertIsSet(row);
    await table.updateRow({ name: "Kirk Douglas Updated" }, row.id);
    expect(getActionCounter()).toBe(99);
  });

  it("should not fire trigger when name is unchanged", async () => {
    resetActionCounter();
    const table = Table.findOne({ name: "patients" })!;
    assertIsSet(table);

    const row = await table.getRow({ name: "Kirk Douglas Updated" });
    assertIsSet(row);
    await table.updateRow({ name: "Kirk Douglas Updated" }, row.id);
    expect(getActionCounter()).toBe(17);
  });

  it("should clean up", async () => {
    const trigger = await Trigger.findOne({ name: "onlyIfOldRow" });
    assertIsSet(trigger);
    await trigger.delete();

    const table = Table.findOne({ name: "patients" })!;
    assertIsSet(table);
    const row = await table.getRow({ name: "Kirk Douglas Updated" });
    assertIsSet(row);
    await table.updateRow({ name: "Kirk Douglas" }, row.id);
  });
});

describe("trigger as action", () => {
  it("should run with standard action as referenced trigger via runWithoutRow", async () => {
    getState()!.registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();

    await Trigger.create({
      name: "SharedCounter",
      action: "incrementCounter",
      when_trigger: "Never",
    });

    await Trigger.create({
      name: "ProxyToShared",
      action: "SharedCounter",
      when_trigger: "Never",
    });

    expect(getActionCounter()).toBe(0);

    const proxyTrig = Trigger.findOne({ name: "ProxyToShared" });
    assertIsSet(proxyTrig);
    await proxyTrig.runWithoutRow({});
    expect(getActionCounter()).toBe(1);

    await proxyTrig.runWithoutRow({});
    expect(getActionCounter()).toBe(2);

    await proxyTrig.delete();
    const shared = Trigger.findOne({ name: "SharedCounter" });
    assertIsSet(shared);
    await shared.delete();
  });

  it("should fire via table insert using shared Never trigger", async () => {
    getState()!.registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();

    const freshTable = await Table.create("ProxyTriggerTable");
    await Field.create({ table: freshTable, name: "val", type: "Integer" });

    await Trigger.create({
      name: "SharedInsUpd",
      action: "incrementCounter",
      when_trigger: "Never",
    });

    await Trigger.create({
      name: "ProxyInsert",
      action: "SharedInsUpd",
      table_id: freshTable.id,
      when_trigger: "Insert",
    });

    await Trigger.create({
      name: "ProxyUpdate",
      action: "SharedInsUpd",
      table_id: freshTable.id,
      when_trigger: "Update",
    });

    expect(getActionCounter()).toBe(0);
    const rowId = await freshTable.insertRow({ val: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(getActionCounter()).toBe(1);

    await freshTable.updateRow({ val: 2 }, rowId);
    await new Promise((r) => setTimeout(r, 50));
    expect(getActionCounter()).toBe(2);

    const insT = Trigger.findOne({ name: "ProxyInsert" });
    assertIsSet(insT);
    await insT.delete();
    const updT = Trigger.findOne({ name: "ProxyUpdate" });
    assertIsSet(updT);
    await updT.delete();
    const shared = Trigger.findOne({ name: "SharedInsUpd" });
    assertIsSet(shared);
    await shared.delete();
    await freshTable.delete();
  });

  it("should run with multi-step action as referenced trigger", async () => {
    const myStepsTrig = Trigger.findOne({ name: "MySteps" });
    assertIsSet(myStepsTrig);

    const table = Table.findOne({ name: "patients" })!;
    assertIsSet(table);

    await Trigger.create({
      name: "MultiStepProxy",
      action: "MySteps",
      table_id: table.id,
      when_trigger: "Insert",
    });

    const proxyTrig = Trigger.findOne({ name: "MultiStepProxy" });
    assertIsSet(proxyTrig);
    const result = await proxyTrig.runWithoutRow({ row: { name: "testrow" } });
    expect(result.error).toBe("errrr");
    expect(result.notify).toBe("note");
    expect(result.notify_success).toBe("fooo");

    await proxyTrig.delete();
  });

  it("should run with workflow as referenced trigger", async () => {
    const wfTrig = await Trigger.create({
      name: "SharedWorkflow",
      action: "Workflow",
      when_trigger: "Never",
      configuration: {},
    });
    assertIsSet(wfTrig);

    const proxyTrig = await Trigger.create({
      name: "WorkflowProxy",
      action: "SharedWorkflow",
      when_trigger: "Never",
    });
    assertIsSet(proxyTrig);

    const freshProxy = Trigger.findOne({ name: "WorkflowProxy" });
    assertIsSet(freshProxy);
    const result = await freshProxy.runWithoutRow({});
    expect(typeof result === "object" || result === undefined).toBe(true);

    await proxyTrig.delete();
    await wfTrig.delete();
  });
});

describe("plain_password_triggers", () => {
  const secret = "fw78fgfw$Efgy";
  it("should set up trigger", async () => {
    getState()!.registerPlugin("mock_plugin", plugin_with_routes());
    resetActionCounter();
    expect(getActionCounter()).toBe(0);
    await Trigger.create({
      action: "evalCounter",
      table_id: User.table.id,
      when_trigger: "Insert",
      name: "incCountIfPlainPassIns",
      configuration: {
        number_expr: `row.plain_password==="${secret}" ? 1 : 0`,
      },
    });
    await Trigger.create({
      action: "evalCounter",
      table_id: User.table.id,
      when_trigger: "Update",
      name: "incCountIfPlainPassUpd",
      configuration: {
        number_expr: `row.plain_password==="${secret}" ? 1 : 0`,
      },
    });
  });
  it("should not pass password on update without setting", async () => {
    const u = await User.findOne({ email: "staff@foo.com" });
    assertIsSet(u);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);
    await u.changePasswordTo(secret);
    expect(getActionCounter()).toBe(0);
  });
  it("should not pass password on create without setting", async () => {
    resetActionCounter();
    expect(getActionCounter()).toBe(0);
    await User.create({
      email: "user1@foo.com",
      password: secret,
      role_id: 80,
    });
    expect(getActionCounter()).toBe(0);
  });
  it("should pass password on update with setting", async () => {
    await getState()!.setConfig("plain_password_triggers", true);
    const u = await User.findOne({ email: "staff@foo.com" });
    assertIsSet(u);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);
    await u.changePasswordTo(secret);
    expect(getActionCounter()).toBe(1);
  });
  it("should pass password on create with setting", async () => {
    await getState()!.setConfig("plain_password_triggers", true);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);
    await User.create({
      email: "user2@foo.com",
      password: secret,
      role_id: 80,
    });
    expect(getActionCounter()).toBe(1);
  });
});
