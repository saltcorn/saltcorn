import Form from "../models/form";
import Field from "../models/field";
import WorkflowRun from "../models/workflow_run";
import WorkflowStep from "../models/workflow_step";
import Trigger from "../models/trigger";

import db from "../db";
import { assertIsSet } from "./assertions";
import { afterAll, describe, it, expect } from "@jest/globals";
import { GenObj } from "@saltcorn/types/common_types";

const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import mocks from "./mocks";
import User from "../models/user";
import WorkflowTrace from "../models/workflow_trace";
const { mockReqRes } = mocks;

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

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
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {y:x+1}` },
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
    expect(wfrun.current_step[0]).toBe("fourth_step")
    expect(wfrun.current_step_name).toBe("fourth_step")
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
    expect(traces.length).toBe(4);
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
