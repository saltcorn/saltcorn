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
    const step1 = await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "run_js_code",
      initial_step: true,
      configuration: { code: `return {to_context: {x:1}}` },
    });
    const step2 = await WorkflowStep.create({
        trigger_id: trigger.id!,
        name: "second_step",
        action_name: "run_js_code",
        initial_step: false,
        configuration: { code: `return {to_context: {y:x+1}}` },
      });    
  });
  it("should run", async () => {
    const trigger = Trigger.findOne({name:"mywf"})
    assertIsSet(trigger)
    const run = await WorkflowRun.create({
        trigger_id: trigger.id
    })

  });
});
