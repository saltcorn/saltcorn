import Node from "./node.js";

export class DummyNode extends Node {
  constructor() {
    super("dummy", "dummy", "dummy", [], -1);
  }

  cyDataObject() {
    return {};
  }
}
