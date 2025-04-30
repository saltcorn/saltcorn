import { AbstractTagEntry } from "@saltcorn/types/model-abstracts/abstract_tag_entry";
import type { Row, Where, SelectOptions } from "@saltcorn/db-common/internal";
import db from "../db";

class TagEntry implements AbstractTagEntry {
  id?: number;
  tag_id?: number;
  table_id?: number;
  view_id?: number;
  page_id?: number;
  trigger_id?: number;

  constructor(o: TagEntryCfg | TagEntry) {
    this.id = o.id;
    this.tag_id = o.tag_id;
    this.table_id = o.table_id;
    this.view_id = o.view_id;
    this.page_id = o.page_id;
    this.trigger_id = o.trigger_id;
  }

  static async find(
    where?: Where,
    selectopts: SelectOptions = {}
  ): Promise<Array<TagEntry>> {
    // TODO cache
    const entries = await db.select("_sc_tag_entries", where, selectopts);
    return entries.map((entry: TagEntryCfg) => new TagEntry(entry));
  }

  static async findOne(where: Where): Promise<TagEntry> {
    // TODO cache
    const entry: TagEntryCfg = await db.selectMaybeOne(
      "_sc_tag_entries",
      where
    );
    return entry ? new TagEntry(entry) : entry;
  }

  static async create(cfg: TagEntryCfg): Promise<TagEntry> {
    const entry = new TagEntry(cfg);
    const ex = await db.selectMaybeOne("_sc_tag_entries", {
      tag_id: cfg.tag_id,
      table_id: cfg.table_id || null,
      view_id: cfg.view_id || null,
      page_id: cfg.page_id || null,
      trigger_id: cfg.trigger_id || null,
    });

    if (ex) return new TagEntry(ex);
    const eid = await db.insert("_sc_tag_entries", {
      tag_id: cfg.tag_id,
      table_id: cfg.table_id,
      view_id: cfg.view_id,
      page_id: cfg.page_id,
      trigger_id: cfg.trigger_id,
    });
    entry.id = eid;
    return entry;
  }

  static async update(id: number, row: Row): Promise<void> {
    await db.update("_sc_tag_entries", row, id);
  }

  async delete(): Promise<void> {
    await db.deleteWhere("_sc_tag_entries", { id: this.id });
  }

  isEmpty(): boolean {
    return !this.table_id && !this.view_id && !this.page_id && !this.trigger_id;
  }
}

namespace TagEntry {
  export type TagEntryCfg = Partial<TagEntry>
}
type TagEntryCfg = Partial<TagEntry>;

export = TagEntry;
