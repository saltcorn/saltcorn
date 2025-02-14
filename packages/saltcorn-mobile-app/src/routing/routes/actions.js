/*global saltcorn */

import { MobileRequest } from "../mocks/request";
import { apiCall } from "../../helpers/api";

export const postResumeWorkflow = async (context) => {
  const { id } = context.params;
  const { isOfflineMode } = saltcorn.data.state.getState().mobileConfig;
  if (isOfflineMode) {
    const req = new MobileRequest(context);
    const run = await saltcorn.data.models.WorkflowRun.findOne({ id });
    if (run.started_by !== req.user?.id)
      throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
    const trigger = await saltcorn.data.models.Trigger.findOne({
      id: run.trigger_id,
    });
    const runResult = await run.run({
      user: req.user,
      interactive: true,
      trace: trigger.configuration?.save_traces,
    });
    if (
      runResult &&
      typeof runResult === "object" &&
      Object.keys(runResult).length
    )
      return { success: "ok", ...runResult };
    const retDirs = await run.popReturnDirectives();
    return { success: "ok", ...retDirs };
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/actions/resume-workflow/${id}`,
    });
    return response.data;
  }
};

export const getFillWorkflowForm = async (context) => {
  const { id } = context.params;
  const { isOfflineMode } = saltcorn.data.state.getState().mobileConfig;
  if (isOfflineMode) {
    const req = new MobileRequest();
    const run = await saltcorn.data.models.WorkflowRun.findOne({ id });
    if (!run.user_allowed_to_fill_form(req.user))
      throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
    const trigger = await saltcorn.data.models.Trigger.findOne({
      id: run.trigger_id,
    });
    const step = await saltcorn.data.models.WorkflowStep.findOne({
      trigger_id: trigger.id,
      name: run.current_step_name,
    });
    const form = await saltcorn.data.web_mobile_commons.getWorkflowStepUserForm(
      run,
      trigger,
      step,
      req
    );
    return saltcorn.markup.renderForm(form, false);
  } else {
    const response = await apiCall({
      method: "GET",
      path: `/actions/fill-workflow-form/${id}`,
    });
    return response.data;
  }
};

export const postFillWorkflowForm = async (context) => {
  const { id } = context.params;
  const { isOfflineMode } = saltcorn.data.state.getState().mobileConfig;
  if (isOfflineMode) {
    const req = new MobileRequest(context);
    const run = await saltcorn.data.models.WorkflowRun.findOne({ id });
    if (!run.user_allowed_to_fill_form(req.user))
      throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
    const trigger = await saltcorn.data.models.Trigger.findOne({
      id: run.trigger_id,
    });
    const step = await saltcorn.data.models.WorkflowStep.findOne({
      trigger_id: trigger.id,
      name: run.current_step_name,
    });
    const form = await saltcorn.data.web_mobile_commons.getWorkflowStepUserForm(
      run,
      trigger,
      step,
      req
    );
    form.validate(req.body);
    if (form.hasErrors) {
      return { error: req.__("Errors in form") }; // TODO not sure
    } else {
      await run.provide_form_input(form.values);
      const runres = await run.run({
        user: req.user,
        trace: trigger.configuration?.save_traces,
        interactive: true,
      });
      const retDirs = await run.popReturnDirectives();
      return { success: "ok", ...runres, ...retDirs };
    }
  } else {
    const response = await apiCall({
      method: "POST",
      path: `/actions/fill-workflow-form/${id}`,
    });
    return response.data;
  }
};
