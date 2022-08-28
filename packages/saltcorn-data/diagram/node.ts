/**
 * resembles a page or a view in the application object tree
 */
export default class Node {
  type: string;
  label: string;
  cyId: string;
  linked = new Array<Node>();
  embedded = new Array<Node>();

  /**
   * @param type page or view
   * @param label
   */
  constructor(type: string, label: string) {
    this.type = type;
    this.label = label;
    this.cyId = `${type}_${label}`;
  }
}
