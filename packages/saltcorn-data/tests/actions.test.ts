import Trigger from "../models/trigger";
import Table from "../models/table";
import Field from "../models/field";
import User from "../models/user";
import EventLog from "../models/eventlog";
import scheduler from "../models/scheduler";
const { runScheduler } = scheduler;
import db from "../db";
const { getState } = require("../db/state");
import mocks from "../tests/mocks";
const {
  plugin_with_routes,
  getActionCounter,
  resetActionCounter,
  mockReqRes,
  sleep,
} = mocks;
import { assertIsSet } from "../tests/assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import baseactions, { emit_event, notify_user } from "../base-plugin/actions";
const {
  duplicate_row,
  insert_any_row,
  insert_joined_row,
  modify_row,
  delete_rows,
} = baseactions;
import utils from "../utils";
import Notification from "../models/notification";
import { run_action_column } from "../plugin-helper";
const { applyAsync, mergeActionResults } = utils;

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

jest.setTimeout(10000);

describe("Action and Trigger model", () => {
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
      name: "incCount",
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
      configuration: { row_expr: "{favbook:1}", where: "Database" },
      user: { id: 1, role_id: 1 },
    });
    expect(result).toStrictEqual(undefined);

    const row1 = await patients.getRow({ name: "Simon1" });
    assertIsSet(row1);

    expect(row1.favbook).toBe(1);
  });
  it("should delete_rows", async () => {
    const patients = Table.findOne({ name: "patients" });
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
    expect(result).toStrictEqual(undefined);

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
    expect(result1).toStrictEqual(undefined);
    const row2 = await patients.getRow({ name: "Del2" });
    expect(row2).toBe(null);
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
    const table = Table.findOne({ name: "ValidatedTable" });
    assertIsSet(table);
    await table.insertRow({ name: "Mike", age: 19 });
    const row = await table.getRow({ name: "Mike" });
    assertIsSet(row);
    expect(row.age).toBe(19);
  });
  it("it should not insert invalid rows", async () => {
    const table = Table.findOne({ name: "ValidatedTable" });
    assertIsSet(table);
    await table.insertRow({ name: "Fred", age: 14 });
    const row = await table.getRow({ name: "Fred" });
    expect(row).toBe(null);
  });
  it("it should set fields", async () => {
    const table = Table.findOne({ name: "ValidatedTable" });
    assertIsSet(table);
    await table.insertRow({ age: 25 });
    const row = await table.getRow({ age: 25 });
    assertIsSet(row);
    expect(row.name).toBe("PersonAged25");
  });
  it("it should not update to invalid row", async () => {
    const table = Table.findOne({ name: "ValidatedTable" });
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
    const table = Table.findOne({ name: "ValidatedTable" });
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
    const table = Table.findOne({ name: "ValidatedTable" });
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
    const runres = await trigger.runWithoutRow({});
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

describe("plain_password_triggers", () => {
  const secret = "fw78fgfw$Efgy";
  it("should set up trigger", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
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
    await getState().setConfig("plain_password_triggers", true);
    const u = await User.findOne({ email: "staff@foo.com" });
    assertIsSet(u);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);
    await u.changePasswordTo(secret);
    expect(getActionCounter()).toBe(1);
  });
  it("should pass password on create with setting", async () => {
    await getState().setConfig("plain_password_triggers", true);
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
