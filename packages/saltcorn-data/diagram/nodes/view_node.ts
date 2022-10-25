import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import { AbstractView } from "@saltcorn/types/model-abstracts/abstract_view";
import Node from "./node";

export class ViewNode extends Node {
  view: AbstractView;

  constructor(view: AbstractView, tags: Array<AbstractTag>) {
    super("view", view.name, view.name, tags, view.id!);
    this.view = view;
  }

  cyDataObject() {
    const result = this.commonCyData();
    // @ts-ignore  TODO check table type
    result.table = this.view.table;
    result.viewtemplate = this.view.viewtemplate;
    result.min_role = this.view.min_role;
    return result;
  }
}
