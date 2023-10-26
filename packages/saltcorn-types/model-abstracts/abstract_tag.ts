import type { AbstractTagEntry, TagEntryPack } from "./abstract_tag_entry";

export interface AbstractTag {
  id?: number;
  name: string;
  entries?: AbstractTagEntry[];
}

export type TagPack = {
  name: string;
  entries?: TagEntryPack[];
};
