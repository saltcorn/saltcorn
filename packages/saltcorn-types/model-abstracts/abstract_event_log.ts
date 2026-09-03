/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_event_log
 * @subcategory model-abstracts
 */

/** A portable (import/export) representation of a logged event. */
export type EventLogPack = {
  event_type: string;
  channel?: string | null;
  occur_at: Date;
  user_email?: string | null;
  payload?: any;
  email?: string;
};
