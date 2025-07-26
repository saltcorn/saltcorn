import Form from "../models/form";
import Field from "../models/field";
import WorkflowRun from "../models/workflow_run";
import WorkflowStep from "../models/workflow_step";
import Trigger from "../models/trigger";

import db from "../db";
import { assertIsSet } from "./assertions";
import { afterAll, describe, it, expect } from "@jest/globals";
import { GenObj } from "@saltcorn/types/common_types";
import { runWithTenant } from "@saltcorn/db-common/multi-tenant";

const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import mocks from "./mocks";
import User from "../models/user";
import Table from "../models/table";
import WorkflowTrace from "../models/workflow_trace";
const { mockReqRes } = mocks;

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

jest.setTimeout(10000);

describe("Workflow run steps", () => {
  it("should create steps", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "mywf",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "run_js_code",
      initial_step: true,
      configuration: { code: `return {x:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      next_step: "third_step",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: `{y:await x+1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "third_step",
      next_step: "x>2 ? fifth_step : fourth_step ",
      only_if: "y>4",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {x:3}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "fourth_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {last:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "fifth_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {last:2}` },
    });
  });
  it("should run", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "mywf" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
    });
    await wfrun.run({ user });
    expect(wfrun.context.x).toBe(1);
    expect(wfrun.context.y).toBe(2);
    expect(wfrun.context.last).toBe(1);
    expect(wfrun.current_step[0]).toBe("fourth_step");
    expect(wfrun.current_step_name).toBe("fourth_step");
  });
  it("should run through trigger", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "mywf" });
    assertIsSet(trigger);
    const result = await trigger.runWithoutRow({ user });
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
    expect(result.last).toBe(1);
  });
  it("should run with traces", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger0 = Trigger.findOne({ name: "mywf" });

    assertIsSet(trigger0);
    await Trigger.update(trigger0.id, { configuration: { save_traces: true } });
    const trigger = Trigger.findOne({ name: "mywf" });
    assertIsSet(trigger);

    const result = await trigger.runWithoutRow({ user });
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
    expect(result.last).toBe(1);
    const traces = await WorkflowTrace.find({ run_id: result.__wf_run_id });
    expect(traces.length).toBe(3);
  });
});

describe("Workflow run forloop", () => {
  it("should create steps", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "wfForLoop",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{xs: [1,2,3], ys: []}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      next_step: "third_step",
      action_name: "ForLoop",
      initial_step: false,
      configuration: {
        array_expression: "xs",
        item_variable: "x",
        loop_body_initial_step: "body0",
      },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "third_step",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: `{done:true}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "body0",
      next_step: "body1",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {ys:[...ys, x+3]}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "body1",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {inloop: x}` },
    });
  });
  it("should run", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "wfForLoop" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
    });
    await wfrun.run({ user });

    expect(wfrun.context.ys).toStrictEqual([4, 5, 6]);
    //expect(wfrun.context.y).toBe(2);
    //expect(wfrun.context.last).toBe(1);
  });
});

describe("Workflow run error handling", () => {
  it("should create steps", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "mywf1",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "SetErrorHandler",
      initial_step: true,
      configuration: { error_handling_step: "ehan" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      next_step: "third_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `throw new Error("HAHA")` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "third_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {afterCrash:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "ehan",
      action_name: "run_js_code",
      next_step: "fifth_step",
      initial_step: false,
      configuration: { code: `return {runEhan:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "fifth_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {afterEhan:1}` },
    });
  });
  it("should run", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "mywf1" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
    });
    await wfrun.run({ user });

    expect(wfrun.context.afterCrash).toBe(undefined);
    expect(wfrun.context.runEhan).toBe(1);
    expect(wfrun.context.afterEhan).toBe(1);
  });
});
describe("Workflow run error handling with transaction and database ops", () => {
  it("should create steps", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "mywferrdb",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "SetErrorHandler",
      initial_step: true,
      configuration: { error_handling_step: "ehan" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      next_step: "third_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: {
        code: `await Table.findOne("books").insertRow({author:"Simon Marlow", pages: 223, foo:3})`,
      },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "third_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {afterCrash:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "ehan",
      action_name: "run_js_code",
      next_step: "fifth_step",
      initial_step: false,
      configuration: { code: `return {runEhan:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "fifth_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: {
        code: `await Table.findOne("books").insertRow({author:"Simon Marlow", pages: 234})`,
      },
    });
  });
  it("should run", async () => {
    await runWithTenant("public", async () => {
      await db.withTransaction(async () => {
        const user = await User.findOne({ id: 1 });
        assertIsSet(user);
        const trigger = Trigger.findOne({ name: "mywferrdb" });
        assertIsSet(trigger);
        const wfrun = await WorkflowRun.create({
          trigger_id: trigger.id,
        });
        await wfrun.run({ user });

        expect(wfrun.context.afterCrash).toBe(undefined);
        expect(wfrun.context.runEhan).toBe(1);
        const books = await Table.findOne("books")?.getRows({
          author: "Simon Marlow",
        });
        expect(books?.length).toBe(1);
        expect(books?.[0].pages).toBe(234);
      });
    });
  });
});

describe("Workflow run subworkflows", () => {
  it("should create steps", async () => {
    const main = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "wfmain",
    });
    const sub = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "wfsub",
    });
    await WorkflowStep.create({
      trigger_id: main.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{foo: {x:1}, bar: {y:2}}" },
    });
    await WorkflowStep.create({
      trigger_id: main.id!,
      name: "second_step",
      next_step: "third_step",
      action_name: "wfsub",
      initial_step: false,
      configuration: { subcontext: "foo" },
    });
    await WorkflowStep.create({
      trigger_id: main.id!,
      name: "third_step",
      next_step: "",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: `{done: true}` },
    });
    await WorkflowStep.create({
      trigger_id: sub.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "run_js_code",
      initial_step: true,
      configuration: { code: `return {w:5+x}` },
    });
    await WorkflowStep.create({
      trigger_id: sub.id!,
      name: "second_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {z:9}` },
    });
  });
  it("should run", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "wfmain" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
    });
    await wfrun.run({ user });

    //console.log(wfrun.context);

    expect(wfrun.context.done).toBe(true);
    expect(wfrun.context.foo.w).toBe(6);
    expect(wfrun.context.foo.z).toBe(9);
    expect(wfrun.context.bar.y).toBe(2);
    expect(wfrun.context.foo.x).toBe(1);
  });
});
describe("Workflow run actions", () => {
  it("should create steps", async () => {
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);

    await Trigger.create({
      action: "run_js_code",
      table_id: table.id,
      name: "InsertBook",
      when_trigger: "Never",
      configuration: {
        code: `await table.insertRow({author: "Mary Contrary", pages: 124, publisher: row.publisher})`,
      },
    });
    const main = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "wfrunaction",
    });
    await WorkflowStep.create({
      trigger_id: main.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{foo: {x:1}}" },
    });
    await WorkflowStep.create({
      trigger_id: main.id!,
      name: "second_step",
      next_step: "third_step",
      action_name: "InsertBook",
      initial_step: false,
      configuration: { row_expr: "{publisher: thepub}" },
    });
    await WorkflowStep.create({
      trigger_id: main.id!,
      name: "third_step",
      next_step: "",
      action_name: "TableQuery",
      initial_step: false,
      configuration: {
        query_table: "books",
        query_object: "{pages: 124}",
        query_variable: "books",
      },
    });
  });
  it("should run", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "wfrunaction" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
      context: { thepub: 2 },
    });
    await wfrun.run({ user });

    expect(wfrun.context.foo.x).toBe(1);
    expect(wfrun.context.books.length).toBe(1);
    expect(wfrun.context.books[0].pages).toBe(124);
    expect(wfrun.context.books[0].author).toBe("Mary Contrary");
    expect(wfrun.context.books[0].publisher).toBe(2);
  });
  it("should dereference key row fields", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const table = Table.findOne({ name: "books" });
    assertIsSet(table);
    await table.deleteRows({ pages: 124 });
    const trigger = Trigger.findOne({ name: "wfrunaction" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
      context: { thepub: "No starch" },
    });
    await wfrun.run({ user });

    expect(wfrun.context.foo.x).toBe(1);
    expect(wfrun.context.books.length).toBe(1);
    expect(wfrun.context.books[0].pages).toBe(124);
    expect(wfrun.context.books[0].author).toBe("Mary Contrary");
    expect(wfrun.context.books[0].publisher).toBe(2);
  });
});

describe("Workflow run userform", () => {
  it("should create steps", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "uformwf",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "run_js_code",
      initial_step: true,
      configuration: { code: `return {x:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      next_step: "third",
      action_name: "UserForm",
      initial_step: false,
      configuration: {
        form_header: "",
        user_id_expression: "",
        user_form_questions: [
          {
            label: "What is your name",
            qtype: "Free text",
            var_name: "name",
          },
        ],
      },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "third",
      next_step: "",
      action_name: "Output",
      initial_step: false,
      configuration: {
        markdown: false,
        output_text: "hello {{name}}",
      },
    });
  });
  it("should run", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "uformwf" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
    });
    await wfrun.run({ user });
    expect(wfrun.context.x).toBe(1);
    expect(wfrun.status).toBe("Waiting");
    expect(wfrun.wait_info).toStrictEqual({ form: true, user_id: 1 });

    await wfrun.provide_form_input({ name: "Tom" });
    await wfrun.run({
      user,
    });
    expect(wfrun.status).toBe("Waiting");
    expect(wfrun.context.name).toBe("Tom");
    expect(wfrun.wait_info.output).toBe("hello Tom");

    await wfrun.provide_form_input({});
    await wfrun.run({
      user,
    });
    expect(wfrun.status).toBe("Finished");
  });
  it("should run interactively", async () => {
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const trigger = Trigger.findOne({ name: "uformwf" });
    assertIsSet(trigger);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id,
    });
    const runres0 = await wfrun.run({ user, interactive: true });
    expect(runres0.popup).toContain("/actions/fill-workflow-form/");
    expect(runres0.popup).toContain("?resume=");

    expect(wfrun.context.x).toBe(1);
    expect(wfrun.status).toBe("Waiting");
    expect(wfrun.wait_info).toStrictEqual({ form: true, user_id: 1 });

    await wfrun.provide_form_input({ name: "Tom" });
    const runres1 = await wfrun.run({
      user,
      interactive: true,
    });
    expect(runres1.popup).toContain("/actions/fill-workflow-form/");
    expect(runres1.popup).toContain("?resume=");
    expect(wfrun.status).toBe("Waiting");
    expect(wfrun.wait_info.output).toBe("hello Tom");
    expect(wfrun.context.name).toBe("Tom");
    await wfrun.provide_form_input({});
    await wfrun.run({
      user,
    });
    expect(wfrun.status).toBe("Finished");
  });
  it("should skip form on only-if", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "uformwf0",
    });

    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "run_js_code",
      initial_step: true,
      configuration: { code: `return {x:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      next_step: "third",
      action_name: "UserForm",
      initial_step: false,
      only_if: "x>5",
      configuration: {
        form_header: "",
        user_id_expression: "",
        user_form_questions: [
          {
            label: "What is your name",
            qtype: "Free text",
            var_name: "name",
          },
        ],
      },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "third",
      next_step: "",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {x:2}` },
    });
    const user = await User.findOne({ id: 1 });
    assertIsSet(user);
    const wfrun = await WorkflowRun.create({
      trigger_id: trigger.id!,
    });
    await wfrun.run({ user });
    expect(wfrun.context.x).toBe(2);
    expect(wfrun.status).toBe("Finished");
  });
});

describe("Workflow step operations", () => {
  it("should generate a diagram", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "diagramTrigger",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "startStep",
      next_step: "endStep",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{x: 1}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "endStep",
      initial_step: false,
      action_name: "SetContext",
      configuration: { ctx_values: "{y: 2}" },
    });
    const steps = await WorkflowStep.find({ trigger_id: trigger.id! });
    const diagram = WorkflowStep.generate_diagram(steps);
    expect(diagram).toContain("startStep");
    expect(diagram).toContain("endStep");
  });

  it("should handle delete with connect_prev_next", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "deleteTrigger",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "step1",
      next_step: "step2",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{x: 1}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "step2",
      next_step: "step3",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: "{y: 2}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "step3",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: "{z: 3}" },
    });

    const step2 = await WorkflowStep.findOne({ name: "step2" });
    assertIsSet(step2);
    await step2.delete(true);

    const updatedStep1 = await WorkflowStep.findOne({ name: "step1" });
    assertIsSet(updatedStep1);
    expect(updatedStep1.next_step).toBe("step3");
  });

  it("should find steps with specific conditions", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "findTrigger",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "findStep1",
      next_step: "findStep2",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{x: 1}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "findStep2",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: "{y: 2}" },
    });

    const steps = await WorkflowStep.find({ trigger_id: trigger.id! });
    expect(steps.length).toBe(2);
    expect(steps[0].name).toBe("findStep1");
    expect(steps[1].name).toBe("findStep2");
  });

  // More tests for update, delete, and 'get diagram loop link backs'
  it("should update a workflow steop", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "updateTrigger",
    });
    const step = await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "updateStep",
      next_step: "nextStep",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{x: 1}" },
    });
    const fetchedStep = await WorkflowStep.findOne({ name: "updateStep" });
    assertIsSet(fetchedStep);
    await fetchedStep.update({
      next_step: "updatedNextStep",
    });
    const updatedStep = await WorkflowStep.findOne({ name: "updateStep" });
    assertIsSet(updatedStep);
    expect(updatedStep.next_step).toBe("updatedNextStep");
  });

  it("should get diagram loop link backs", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "loopTrigger",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "forLoopStep",
      action_name: "ForLoop",
      initial_step: true,
      configuration: {
        loop_body_initial_step: "loopBodyStep",
      },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "loopBodyStep",
      next_step: "endStep",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: `return {y: 2}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "endStep",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: `return {z: 3}` },
    });
    const steps = await WorkflowStep.find({ trigger_id: trigger.id! });
    const loopLinks = WorkflowStep.getDiagramLoopLinkBacks(steps);
    expect(loopLinks["endStep"]).toBe("forLoopStep");
  });

  it("should delet a workflow step and connect previous to next", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "deleteConnectTrigger",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "stepA",
      next_step: "stepB",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{x: 1}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "stepB",
      next_step: "stepC",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: "{y: 2}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "stepC",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: "{z: 3}" },
    });

    const stepB = await WorkflowStep.findOne({ name: "stepB" });
    assertIsSet(stepB);
    await stepB.delete(true);

    const updatedStepA = await WorkflowStep.findOne({ name: "stepA" });
    assertIsSet(updatedStepA);
    expect(updatedStepA.next_step).toBe("stepC");
  });

  it("should handle reserved names in mermaid diagram generation", async () => {
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "reservedNamesTrigger",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "end",
      next_step: "subgraph",
      action_name: "SetContext",
      initial_step: true,
      configuration: { ctx_values: "{x: 1}" },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "subgraph",
      action_name: "SetContext",
      initial_step: false,
      configuration: { ctx_values: "{y: 2}" },
    });
    const steps = await WorkflowStep.find({ trigger_id: trigger.id! });
    const diagram = WorkflowStep.generate_diagram(steps);
    expect(diagram).toContain("flowchart TD");
    expect(diagram).toContain('_end_["`**end**\n    SetContext`"]:::wfstep');
    expect(diagram).toContain(
      '_subgraph_["`**subgraph**\n    SetContext`"]:::wfstep'
    );
    expect(diagram).toContain("_Start--");
    expect(diagram).toContain("--> _End__subgraph_");
  });
});
