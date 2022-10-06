import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import { AbstractTrigger } from "@saltcorn/types/model-abstracts/abstract_trigger";
import Node from "./node";

export class TriggerNode extends Node {
  trigg: AbstractTrigger; // TODO name

  constructor(trigger: AbstractTrigger, tags: Array<AbstractTag>) {
    super("trigger", trigger.name!, tags, trigger.id!);
    this.trigg = trigger;
  }

  cyDataObject() {
    const result = this.commonCyData();

    return result;
  }
}
