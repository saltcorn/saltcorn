import Page from "./page";
import Table from "./table";
import Trigger from "./trigger";
import View from "./view";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import db from "../db";
import TagEntry from "./tag_entry";
import type { TagEntryCfg } from "./tag_entry";

class Tag {
  name: string;
  id?: number;
  entries?: Array<TagEntry>;

  constructor(o: TagCfg | Tag) {
    this.name = o.name;
    this.id = o.id;
    if (o.entries) {
      this.entries = new Array<TagEntry>();
      for (const entry of o.entries) {
        this.entries.push(new TagEntry(entry));
      }
    }
  }

  static async find(
    where?: Where,
    selectopts: SelectOptions = { orderBy: "name", nocase: true }
  ): Promise<Array<Tag>> {
    return await db.select("_sc_tags", where, selectopts);
  }

  static async findOne(where: Where): Promise<Tag> {
    const tag: TagCfg = await db.selectMaybeOne("_sc_tags", where);
    return tag ? new Tag(tag) : tag;
  }

  async getEntries(): Promise<TagEntry[]> {
    if (!this.entries) {
      this.entries = await TagEntry.find({ tag_id: this.id });
    }
    return this.entries;
  }

  private async getTypedIds(memberId: AttrNames): Promise<number[]> {
    return (await this.getEntries())
      .filter((entry: TagEntry) => entry[memberId])
      .map((entry: TagEntry) => entry[memberId]!);
  }

  async getTableIds(): Promise<number[]> {
    return await this.getTypedIds("table_id");
  }

  async getViewIds(): Promise<number[]> {
    return await this.getTypedIds("view_id");
  }

  async getPageIds(): Promise<number[]> {
    return await this.getTypedIds("page_id");
  }

  async getTriggerIds(): Promise<number[]> {
    return await this.getTypedIds("trigger_id");
  }

  private async getTypedEntries<T>(
    model: any,
    memberId: AttrNames
  ): Promise<Array<T>> {
    const result = new Array<T>();
    for (const entry of await this.getEntries()) {
      if (entry[memberId]) {
        const modelObj = await model.findOne({ id: entry[memberId] });
        result.push(modelObj!);
      }
    }
    return result;
  }

  async getTables(): Promise<Table[]> {
    return this.getTypedEntries<Table>(require("./table"), "table_id");
  }

  async getViews(): Promise<View[]> {
    return this.getTypedEntries<View>(require("./view"), "view_id");
  }

  async getPages(): Promise<Page[]> {
    return this.getTypedEntries<Page>(require("./page"), "page_id");
  }

  async getTrigger(): Promise<Trigger[]> {
    return this.getTypedEntries<Trigger>(require("./trigger"), "trigger_id");
  }

  static async create(cfg: TagCfg): Promise<Tag> {
    const tag = new Tag(cfg);
    const tid = await db.insert("_sc_tags", { name: tag.name });
    tag.id = tid;
    if (cfg.entries) {
      tag.entries = [];
      for (const entryCfg of cfg.entries) {
        if (
          entryCfg.table_id ||
          entryCfg.view_id ||
          entryCfg.page_id ||
          entryCfg.trigger_id
        ) {
          entryCfg.tagId = tid;
          tag.entries.push(await TagEntry.create(entryCfg));
        }
      }
    }
    return tag;
  }

  static async update(id: number, row: Row): Promise<void> {
    await db.update("_sc_tags", row, id);
  }

  async update(row: Row): Promise<void> {
    if (!this.id)
      throw new Error(`To update the tag '${this.name}' the id must be set`);
    await Tag.update(this.id, row);
  }

  static async delete(id: number): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    // delete entries
    await db.query(`delete FROM ${schema}_sc_tag_entries WHERE tag_id = $1`, [
      id,
    ]);
    // delete tag
    await db.query(`delete FROM ${schema}_sc_tags WHERE id = $1`, [id]);
  }

  async delete(): Promise<void> {
    if (!this.id)
      throw new Error(`To update the tag '${this.name}' the id must be set`);
    await Tag.delete(this.id);
  }

  async addEntry({
    table_id,
    view_id,
    page_id,
    trigger_id,
  }: {
    table_id?: number;
    view_id?: number;
    page_id?: number;
    trigger_id?: number;
  }): Promise<void> {
    if (!this.id) throw new Error("TODO");
    TagEntry.create({
      tagId: this.id,
      table_id,
      view_id,
      page_id,
      trigger_id,
    });
  }
}

namespace Tag {
  export type TagCfg = {
    name: string;
    id?: number;
    entries?: Array<TagEntry | TagEntryCfg>;
  };
}

type AttrNames = "table_id" | "view_id" | "page_id" | "trigger_id";
type TagCfg = Tag.TagCfg;

export = Tag;
