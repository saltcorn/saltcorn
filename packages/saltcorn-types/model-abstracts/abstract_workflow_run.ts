export type WorkflowRunCfg = {
  id?: number;
  trigger_id: number;
  context?: any;
  wait_info?: any;
  started_at?: Date;
  status_updated_at?: Date;
  started_by?: number;
  error?: string;
  session_id?: string;
  status?: "Pending" | "Running" | "Finished" | "Waiting" | "Error";
  current_step?: string;
};
