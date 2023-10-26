export type EventLogPack = {
  event_type: string;
  channel?: string | null;
  occur_at: Date;
  user_email?: string | null;
  payload?: any;
  email?: string;
};
