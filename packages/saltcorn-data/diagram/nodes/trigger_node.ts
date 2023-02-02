import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import Node from "./node";

export class TriggerNode extends Node {
  constructor(
    name: string,
    label: string,
    tags: Array<AbstractTag>,
    objectId?: number | null
  ) {
    super("trigger", name, label, tags, objectId);
  }

  cyDataObject() {
    const result = this.commonCyData();
    result.isVirtual = this.objectId ? false : true;
    return result;
  }
}
