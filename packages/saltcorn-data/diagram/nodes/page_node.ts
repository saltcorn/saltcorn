import { AbstractPage } from "@saltcorn/types/model-abstracts/abstract_page";
import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import Node from "./node";

export class PageNode extends Node {
  page: AbstractPage;

  constructor(page: AbstractPage, tags: Array<AbstractTag>) {
    super("page", page.name, page.name, tags, page.id!);
    this.page = page;
  }

  cyDataObject() {
    const result = this.commonCyData();
    result.min_role = this.page.min_role;
    return result;
  }
}
