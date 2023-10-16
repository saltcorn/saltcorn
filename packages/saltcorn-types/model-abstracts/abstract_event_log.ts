export type EventLogPack = {
  event_type: string;
  channel?: string | null;
  occur_at: Date;
  user_name?: string | null;
  payload?: any;
  email?: string;
};
