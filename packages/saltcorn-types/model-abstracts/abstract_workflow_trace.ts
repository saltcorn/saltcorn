export type WorkflowTraceCfg = {
  id?: number;
  run_id: number;
  context: any;
  step_name_run: string;
  wait_info?: any;
  step_started_at: Date;
  elapsed: number;
  user_id: number;
  error?: string;
  status: "Pending" | "Running" | "Finished" | "Waiting" | "Error";
};
