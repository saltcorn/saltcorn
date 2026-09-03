/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_workflow
 * @subcategory model-abstracts
 */
import type { GenObj } from "../common_types.js";
import { AbstractForm } from "./abstract_form.js";

/** The outcome of running one step of an {@link AbstractWorkflow}. */
export type RunResult = {
  renderForm?: any;
  context: GenObj;
  stepName: string;
  currentStep: number;
  maxSteps: number;
  title: string;
  renderBuilder?: GenObj;
  contextField?: string;
  previewURL?: string;
  savingErrors?: any;
  flash?: any;
  redirect?: string;
};

/** Options passed to the AppConstructor builder for one workflow step. */
type BuilderConfig = {
  mode: "edit" | "show" | "filter" | "list" | "page";
  icons: string[];
  keyframes: string[];
  fonts: Record<string, string>;
  allowMultiStepAction?: boolean;
};

type ConfigWorkflowFormStep = {
  form: (context: GenObj) => Promise<AbstractForm>;
};
type ConfigWorkflowBuilderStep = {
  builder: (context: GenObj) => Promise<BuilderConfig>;
};
/** One step of a plugin's configuration workflow: either a form or a builder step. */
export type ConfigWorkflowStep = {
  name: string;
  contextField?: string;
  onlyWhen?: (context: GenObj) => Promise<boolean>;
} & (ConfigWorkflowFormStep | ConfigWorkflowBuilderStep);

/** A multi-step wizard, e.g. a view or plugin's configuration_workflow. */
export interface AbstractWorkflow {
  onDone: (arg0: any) => any;
  action?: string | undefined;
  steps: any[];
  __: any;
  saveURL?: string;
  startAtStepURL?: (stepName: string) => string;
  autoSave?: boolean;
  previewURL?: string;

  run: (body: any, req: any) => Promise<RunResult>;
  singleStepForm: (body: any, req: any) => Promise<RunResult | undefined>;
  runStep: (context: any, stepIx: number) => Promise<RunResult>;
  title: (step: any, stepIx: number) => string;
  prepareForm: (form: any) => Promise<void>;
}
