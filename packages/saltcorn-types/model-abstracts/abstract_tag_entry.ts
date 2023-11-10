export interface AbstractTagEntry {
  id?: number;
  tag_id?: number;
  table_id?: number;
  view_id?: number;
  page_id?: number;
  trigger_id?: number;
}

export type TagEntryPack = {
  table_name?: string;
  view_name?: string;
  page_name?: string;
  trigger_name?: string;
};
