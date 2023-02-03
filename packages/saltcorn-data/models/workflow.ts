/**
 * view description
 * @category saltcorn-data
 * @module models/workflow
 * @subcategory models
 */

import { instanceOfType } from "@saltcorn/types/common_types";
import type {
  AbstractWorkflow,
  RunResult,
} from "@saltcorn/types/model-abstracts/abstract_workflow";

import db from "../db";

import type Field from "./field";
import Form from "./form";
import type {
  JoinFieldOption,
  RelationOption,
} from "@saltcorn/types/base_types";

const { getState } = require("../db/state");
const { applyAsync, apply } = require("../utils");

/**
 * Workflow class
 * @category saltcorn-data
 */
class Workflow implements AbstractWorkflow {
  steps: any[];
  onDone: (context: any) => any;
  action?: string | undefined;
  __: any;
  saveURL?: string;
  startAtStepURL?: (stepName: string) => string;
  autoSave?: boolean;
  previewURL?: string;

  /**
   * Workflow constructor
   * @param {*} o
   */
  constructor(o: WorkflowCfg) {
    this.steps = o.steps || [];
    this.onDone = o.onDone || ((c) => c);
    this.action = o.action;
    this.previewURL = o.previewURL;
    this.__ = (s: any) => s;
  }
  async singleStepForm(body?: any, req?: any): Promise<RunResult | undefined> {
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
              ? this.__("Finish") + " &raquo;"
              : this.__("Next") + " &raquo;";

        await addApplyButtonToForm(form, this, context);
      }
      return {
        renderForm: form,
        context,
        stepName: step.name,
        currentStep: stepIx + 1,
        maxSteps: this.steps.length,
        title: this.title(step, stepIx),
        contextField: step.contextField,
        ...(step.disablePreview ? {} : { previewURL: this.previewURL }),
      };
    }
  }
  /**
   * @param {object} body
   * @param {object} req
   * @returns {Promise<object>}
   */
  async run(body?: any, req?: any): Promise<RunResult | undefined> {
    if (req) this.__ = (s: any) => req.__(s);
    if (!body || !body.stepName) {
      return this.runStep(body || {}, 0);
    }

    const { stepName, contextEnc, ...stepBody } = body;

    if (!contextEnc) {
      const startStepIx = this.steps.findIndex(
        (step) => step.name === stepName
      );

      return this.runStep(stepBody || {}, startStepIx);
    }
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
              ? this.__("Finish") + " &raquo;"
              : this.__("Next") + " &raquo;";

        await addApplyButtonToForm(form, this, context);

        return {
          renderForm: form,
          context,
          stepName: step.name,
          currentStep: stepIx + 1,
          maxSteps: this.steps.length,
          title: this.title(step, stepIx),
          ...(step.disablePreview ? {} : { previewURL: this.previewURL }),
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
  async runStep(context: any, stepIx: number): Promise<RunResult | undefined> {
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
            ? this.__("Finish") + " &raquo;"
            : this.__("Next") + " &raquo;";

      await addApplyButtonToForm(form, this, context);
      return {
        renderForm: form,
        context,
        stepName: step.name,
        currentStep: stepIx + 1,
        maxSteps: this.steps.length,
        title: this.title(step, stepIx),
        ...(step.disablePreview ? {} : { previewURL: this.previewURL }),
      };
    } else if (step.builder) {
      const options = {
        ...(await applyAsync(step.builder, context)),
        fonts: getState().fonts,
      };
      const Table = (await import("./table")).default;
      const table = Table.findOne({ id: context.table_id });
      if (table) {
        options.join_field_picker_data = {
          join_field_options: await table.get_join_field_options(true, true),
          relation_options: await table.get_relation_options(),
        };
      }
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

async function addApplyButtonToForm(
  form: Form,
  that: AbstractWorkflow,
  context: any
) {
  if (that.saveURL) {
    //TODO what if plugin has viewname as param
    //console.log(that.steps);
    const currentStep = form.values.stepName;
    let prevStep;
    if (that.startAtStepURL)
      for (const step of that.steps) {
        if (step.name === currentStep) break;
        if (!step.onlyWhen) prevStep = step.name;
        else {
          const toRun = await applyAsync(step.onlyWhen, context);
          if (toRun) prevStep = step.name;
        }
      }
    if (that.autoSave)
      form.onChange = `applyViewConfig(this, '${that.saveURL}')`;
    form.additionalButtons = [
      ...(form.additionalButtons || []),
      ...(that.startAtStepURL && prevStep
        ? [
            {
              label: "&laquo; " + that.__("Back"),
              id: "btnbackwf",
              class: "btn btn-outline-primary",
              onclick: `applyViewConfig(this, '${
                that.saveURL
              }',()=>{location.href='${that.startAtStepURL(prevStep)}'})`,
            },
          ]
        : []),
      ...(!that.autoSave
        ? [
            {
              label: that.__("Save"),
              id: "btnsavewf",
              class: "btn btn-outline-primary",
              onclick: `applyViewConfig(this, '${that.saveURL}')`,
            },
          ]
        : []),
    ];
  }
}
namespace Workflow {
  export type WorkflowCfg = {
    steps?: any[];
    onDone?: (context: any) => any;
    action?: string;
    previewURL?: string;
  };
}
type WorkflowCfg = Workflow.WorkflowCfg;

export = Workflow;
