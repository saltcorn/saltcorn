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
      configuration: { code: `return {to_context: {x:1}}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {to_context: {y:x+1}}` },
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
    await wfrun.run(user);
    expect(wfrun.context.x).toBe(1)
    expect(wfrun.context.y).toBe(2)

});
});
