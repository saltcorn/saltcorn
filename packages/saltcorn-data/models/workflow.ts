/**
 * view description
 * @category saltcorn-data
 * @module models/workflow
 * @subcategory models
 */

import { instanceOfType } from "@saltcorn/types/common_types";
import { AbstractWorkflow } from "@saltcorn/types/model-abstracts/abstract_workflow";

import db from "../db";

import type Field from "./field";

const { getState } = require("../db/state");
const { applyAsync, apply } = require("../utils");

type ResultType = {
  renderForm?: any;
  context: any;
  stepName: string;
  currentStep: number;
  maxSteps: number;
  title: string;
};

/**
 * Workflow class
 * @category saltcorn-data
 */
class Workflow implements AbstractWorkflow {
  steps: any[];
  onDone: (arg0: any) => any;
  action?: string | undefined;
  __: any;

  /**
   * Workflow constructor
   * @param {*} o
   */
  constructor(o: WorkflowCfg) {
    this.steps = o.steps || [];
    this.onDone = o.onDone || ((c) => c);
    this.action = o.action;
    this.__ = (s: any) => s;
  }

  /**
   * @param {object} body
   * @param {object} req
   * @returns {Promise<object>}
   */
  async run(body: any, req: any): Promise<ResultType | undefined> {
    if (req) this.__ = (s: any) => req.__(s);
    if (!body || !body.stepName) {
      return this.runStep(body || {}, 0);
    }
    const { stepName, contextEnc, ...stepBody } = body;

    const context = JSON.parse(decodeURIComponent(contextEnc));
    const stepIx = this.steps.findIndex((step) => step.name === stepName);
    if (stepIx === -1) {
      //error
    }
    const step = this.steps[stepIx];
    if (step.form) {
      const form = await applyAsync(step.form, context);

      const valres = form.validate(stepBody);
      if (valres.errors) {
        form.hidden("stepName", "contextEnc");
        form.values.stepName = step.name;
        form.values.contextEnc = contextEnc;

        if (this.action) form.action = this.action;
        if (!form.submitLabel)
          form.submitLabel =
            stepIx === this.steps.length - 1
              ? this.__("Save")
              : this.__("Next") + " &raquo;";

        return {
          renderForm: form,
          context,
          stepName: step.name,
          currentStep: stepIx + 1,
          maxSteps: this.steps.length,
          title: this.title(step, stepIx),
        };
      }
      const toCtx = step.contextField
        ? {
            [step.contextField]: {
              ...(context[step.contextField] || {}),
              ...valres.success,
            },
          }
        : valres.success;

      return this.runStep({ ...context, ...toCtx }, stepIx + 1);
    } else if (step.builder) {
      const toCtx0 = {
        columns: JSON.parse(decodeURIComponent(body.columns)),
        layout: JSON.parse(decodeURIComponent(body.layout)),
        //craft_nodes: JSON.parse(decodeURIComponent(body.craft_nodes))
      };
      const toCtx = step.contextField
        ? {
            [step.contextField]: {
              ...(context[step.contextField] || {}),
              ...toCtx0,
            },
          }
        : toCtx0;
      return this.runStep({ ...context, ...toCtx }, stepIx + 1);
    }
  }

  /**
   * @param {object} context
   * @param {number} stepIx
   * @returns {Promise<object>}
   */
  async runStep(context: any, stepIx: number): Promise<any> {
    if (stepIx >= this.steps.length) {
      return await this.onDone(context);
    }
    const step = this.steps[stepIx];
    if (step.onlyWhen) {
      const toRun = await applyAsync(step.onlyWhen, context);

      if (!toRun) return this.runStep(context, stepIx + 1);
    }
    if (step.form) {
      const form = await applyAsync(step.form, context);

      form.hidden("stepName", "contextEnc");
      form.values.stepName = step.name;
      form.values.contextEnc = encodeURIComponent(JSON.stringify(context));

      form.fields.forEach((fld: Field) => {
        const ctxValue =
          step.contextField && fld.parent_field
            ? ((context[step.contextField] || {})[fld.parent_field] || {})[
                fld.name
              ]
            : step.contextField
            ? (context[step.contextField] || {})[fld.name]
            : context[fld.name];
        if (
          typeof ctxValue !== "undefined" &&
          typeof form.values[fld.name] === "undefined"
        ) {
          const value =
            instanceOfType(fld.type) && fld.type.read
              ? fld.type.read(ctxValue)
              : ctxValue;
          if (fld.parent_field) {
            form.values[`${fld.parent_field}_${fld.name}`] = value;
          } else form.values[fld.name] = value;
        }
      });
      if (this.action) form.action = this.action;
      if (!form.submitLabel)
        form.submitLabel =
          stepIx === this.steps.length - 1
            ? this.__("Save")
            : this.__("Next") + " &raquo;";
      return {
        renderForm: form,
        context,
        stepName: step.name,
        currentStep: stepIx + 1,
        maxSteps: this.steps.length,
        title: this.title(step, stepIx),
      };
    } else if (step.builder) {
      const options = await applyAsync(step.builder, context);
      return {
        renderBuilder: {
          options,
          context,
          layout: context.layout,
          action: this.action,
          stepName: step.name,
          mode: options.mode,
          version_tag: db.connectObj.version_tag,
        },
        context,
        stepName: step.name,
        currentStep: stepIx + 1,
        maxSteps: this.steps.length,
        title: this.title(step, stepIx),
      };
    }
  }

  /**
   * @param {object} step
   * @param {number} stepIx
   * @returns {string}
   */
  title(step: any, stepIx: number): string {
    return `${step.name} (${this.__("step")} ${stepIx + 1} / ${
      this.steps.length > stepIx + 1 ? this.__("max") + " " : ""
    }${this.steps.length})`;
  }
}

namespace Workflow {
  export type WorkflowCfg = {
    steps?: any[];
    onDone?: (arg0: any) => any;
    action?: string;
  };
}
type WorkflowCfg = Workflow.WorkflowCfg;

export = Workflow;
