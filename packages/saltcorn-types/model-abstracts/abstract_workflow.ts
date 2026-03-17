import type { GenObj } from "../common_types";
import { AbstractForm } from "./abstract_form";

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
};

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
export type ConfigWorkflowStep = {
  name: string;
  contextField?: string;
  onlyWhen?: (context: GenObj) => Promise<boolean>;
} & (ConfigWorkflowFormStep | ConfigWorkflowBuilderStep);

export interface AbstractWorkflow {
  onDone: (arg0: any) => any;
  action?: string | undefined;
  steps: any[];
  __: any;
  saveURL?: string;
  startAtStepURL?: (stepName: string) => string;
  autoSave?: boolean;
  previewURL?: string;

  run: (body: any, req: any) => Promise<RunResult | undefined>;
  singleStepForm: (body: any, req: any) => Promise<RunResult | undefined>;
  runStep: (context: any, stepIx: number) => Promise<RunResult | undefined>;
  title: (step: any, stepIx: number) => string;
  prepareForm: (form: any) => Promise<void>;
}
