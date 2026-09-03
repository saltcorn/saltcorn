/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_tag
 * @subcategory model-abstracts
 */
import type { AbstractTagEntry, TagEntryPack } from "./abstract_tag_entry.js";

/** A named tag that can be attached to tables, views, pages, and triggers. */
export interface AbstractTag {
  id?: number;
  name: string;
  entries?: AbstractTagEntry[];
}

/** A portable (import/export) representation of an {@link AbstractTag}. */
export type TagPack = {
  name: string;
  entries?: TagEntryPack[];
};
