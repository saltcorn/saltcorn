const Table = require("../models/table");
//const Field = require("../models/field");
const Trigger = require("../models/trigger");
const runScheduler = require("../models/scheduler");
const db = require("../db");
const { getState } = require("../db/state");
const {
  plugin_with_routes,
  getActionCounter,
  resetActionCounter,
  sleep,
} = require("./mocks");

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

jest.setTimeout(10000);

describe("Action", () => {
  it("should add insert trigger", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    resetActionCounter();
    expect(getActionCounter()).toBe(0);

    const table = await Table.findOne({ name: "patients" });

    const trigger = await Trigger.create({
      action: "incrementCounter",
      table_id: table.id,
      when_trigger: "Insert",
      min_role: 10,
    });
    expect(getActionCounter()).toBe(0);
    await table.insertRow({ name: "Don Fabrizio" });
    expect(getActionCounter()).toBe(1);
    const trigger1 = await Trigger.findOne({ id: trigger.id });
    expect(!!trigger1).toBe(true);
    expect(trigger1.id).toBe(trigger.id);
  });
  it("should add update trigger", async () => {
    expect(getActionCounter()).toBe(1);

    const table = await Table.findOne({ name: "patients" });

    await Trigger.create({
      action: "setCounter",
      table_id: table.id,
      when_trigger: "Update",
      configuration: { number: 17 },
      min_role: 10,
    });
    expect(getActionCounter()).toBe(1);
    const don = await table.getRow({ name: "Don Fabrizio" });
    await table.updateRow({ name: "Don Fabrizio II" }, don.id);
    expect(getActionCounter()).toBe(17);
  });
  it("should add update trigger", async () => {
    expect(getActionCounter()).toBe(17);

    const table = await Table.findOne({ name: "patients" });

    await Trigger.create({
      action: "setCounter",
      table_id: table.id,
      when_trigger: "Delete",
      configuration: { number: 37 },
      min_role: 10,
    });
    expect(getActionCounter()).toBe(17);
    await table.deleteRows({ name: "Don Fabrizio" });
    expect(getActionCounter()).toBe(17);

    await table.deleteRows({ name: "Don Fabrizio II" });
    expect(getActionCounter()).toBe(37);
  });
  it("should run js code", async () => {
    const table = await Table.findOne({ name: "books" });

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
      min_role: 10,
    });
    await table.insertRow({ author: "Giuseppe Tomasi", pages: 209 });
    const patients = await Table.findOne({ name: "patients" });

    const rows = await patients.getRows({ name: "TriggeredInsert" });
    expect(rows.length).toBe(1);
  });
  it("should run webhook", async () => {
    const table = await Table.findOne({ name: "books" });

    await Trigger.create({
      action: "webhook",
      table_id: table.id,
      when_trigger: "Update",
      configuration: {
        // from https://requestbin.com/
        // to inspect https://pipedream.com/sources/dc_jku44wk
        url: "https://b6af540a71dce96ec130de5a0c47ada6.m.pipedream.net",
      },
      min_role: 10,
    });
    const row = await table.getRow({ author: "Giuseppe Tomasi" });
    await table.updateRow({ pages: 210 }, row.id);
  });

  it("should list triggers", async () => {
    //const table = await Table.findOne({ name: "books" });

    const triggers = await Trigger.findAllWithTableName();
    expect(triggers.length).toBe(5);
    expect(
      triggers.find(
        (tr) => tr.table_name === "books" && tr.when_trigger === "Update"
      ).action
    ).toBe("webhook");
  });
  it("should get triggers", async () => {
    const table = await Table.findOne({ name: "books" });
    const trigger = await Trigger.findOne({
      table_id: table.id,
      when_trigger: "Update",
      min_role: 10,
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
      min_role: 10,
    });
    await table.insertRow({ author: "NK Jemisin", pages: 901 });
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
      min_role: 10,
    });
    let stopSched = false;
    runScheduler({
      stop_when: () => stopSched,
      tickSeconds: 1,
    });
    await sleep(500);
    expect(getActionCounter()).toBe(1);
    await sleep(1200);
    expect(getActionCounter() > 1).toBe(true);
    stopSched = true;
    await sleep(1200);
  });
});
