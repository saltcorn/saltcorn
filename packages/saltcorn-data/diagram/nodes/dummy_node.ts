import Node from "./node";

export class DummyNode extends Node {
  constructor() {
    super("dummy", "dummy", "dummy", [], -1);
  }

  cyDataObject() {
    return {};
  }
}
