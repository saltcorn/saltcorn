export type RunResult = {
  renderForm?: any;
  context: any;
  stepName: string;
  currentStep: number;
  maxSteps: number;
  title: string;
};

export interface AbstractWorkflow {
  onDone: (arg0: any) => any;
  action?: string | undefined;
  steps: any[];
  __: any;

  run: (body: any, req: any) => Promise<RunResult | undefined>;
  runStep: (context: any, stepIx: number) => Promise<any>;
  title: (step: any, stepIx: number) => string;
}
