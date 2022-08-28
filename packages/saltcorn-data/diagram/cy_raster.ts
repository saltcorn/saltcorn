import Node from "./node";

/**
 * aligns the nodes from the application object tree on a raster
 */
export default class CytoscapeRaster {
  private raster: Array<Array<Node | null>>;
  private cyIds = new Set<string>();
  private links = new Array<Link>();

  private initialRows = 2;
  private initialCols = 2;

  private entryNodeRow = 10;
  private entryNodeCol = 0;

  constructor(entryNode: Node) {
    this.raster = new Array<Array<Node>>();
    for (let row = 0; row < this.initialRows; row++) {
      const row = new Array<Node | null>();
      for (let col = 0; col < this.initialCols; col++) {
        row.push(null);
      }
      this.raster.push(row);
    }
    const rootNodeCol = this.entryNodeCol + this.embedDepth(entryNode) * 2;
    const embeddedLinks = new Array<Node>();
    this.collectEmbeddedLinks(entryNode, embeddedLinks);
    entryNode.linked.push(...embeddedLinks);
    this.iterateEmbedded(entryNode, this.entryNodeRow, rootNodeCol, true);
    this.addNode(entryNode, this.entryNodeRow, rootNodeCol);
    this.iterateLinked(entryNode, this.entryNodeRow, rootNodeCol);
  }

  /**
   * iterate recursively linked nodes and put them to the right of parent
   * @param parent
   * @param row
   * @param col
   * @returns the last used row index
   */
  private iterateLinked(parent: Node, row: number, col: number) {
    let maxRow = row;
    let linkedCol = col + 2 + this.maxEmbedDepth(parent.linked) * 2;
    for (const linkedNode of parent.linked) {
      if (!this.cyIds.has(linkedNode.cyId)) {
        this.addNode(linkedNode, maxRow, linkedCol);
        const embeddedLinks = new Array<Node>();
        this.collectEmbeddedLinks(linkedNode, embeddedLinks);
        linkedNode.linked.push(...embeddedLinks);
        const embedBranchMax = this.iterateEmbedded(
          linkedNode,
          maxRow,
          linkedCol
        );
        this.links.push({
          source: parent,
          target: linkedNode,
          type: "new_target",
        });
        const linkedbranchMax = this.iterateLinked(
          linkedNode,
          maxRow,
          linkedCol
        );
        maxRow = linkedbranchMax > maxRow ? linkedbranchMax : maxRow + 2;
        if (embedBranchMax > maxRow) maxRow = embedBranchMax;
      } else {
        this.links.push({
          source: parent,
          target: linkedNode,
          type: "existing_target",
        });
      }
    }
    return maxRow;
  }

  /**
   * iterate recursively embedded nodes and put them to the right of parent
   * @param parent
   * @param row
   * @param col
   * @param noVerticalShift
   * @returns the last used row index
   */
  private iterateEmbedded(
    parent: Node,
    row: number,
    col: number,
    noVerticalShift?: boolean
  ) {
    let maxRow = noVerticalShift ? row : row + 1;
    let insertCol = col - 2;
    for (const embedded of parent.embedded) {
      if (!this.cyIds.has(embedded.cyId)) {
        this.addNode(embedded, maxRow, insertCol);
        this.links.push({
          source: parent,
          target: embedded,
          type: "new_target",
        });
        const branchMax = this.iterateEmbedded(
          embedded,
          maxRow,
          insertCol,
          true
        );
        maxRow = branchMax > maxRow ? branchMax : maxRow + 1;
      } else {
        this.links.push({
          source: parent,
          target: embedded,
          type: "existing_target",
        });
      }
    }
    return maxRow;
  }

  /**
   * collect all nodes, linked from embedded views,
   * so that they can be shown on the right of the parent node
   * @param parent
   * @param result
   */
  private collectEmbeddedLinks(parent: Node, result: Array<Node>) {
    for (const embedded of parent.embedded) {
      result.push(...embedded.linked);
      this.collectEmbeddedLinks(embedded, result);
    }
  }

  private maxEmbedDepth(nodes: Node[]): number {
    let max = 0;
    for (const node of nodes) {
      const depth = this.embedDepth(node);
      if (depth > max) max = depth;
    }
    return max;
  }

  private embedDepth(parent: Node) {
    if (parent.embedded.length === 0) return 0;
    let maxDepth = 0;
    for (const node of parent.embedded) {
      const branchDepth = this.embedDepth(node);
      maxDepth = branchDepth > maxDepth ? branchDepth : maxDepth;
    }
    return maxDepth + 1;
  }

  private addNode(node: Node, row: number, col: number) {
    this.enlargeIfNecessary(row, col);
    this.raster[row][col] = node;
    this.cyIds.add(node.cyId);
  }

  public buildCyNodes(): any[] {
    const cyNodes = new Array<any>();
    const rowsCount = this.rowsCount();
    const colsCount = this.colsCount();
    for (let row = 0; row < rowsCount; row++) {
      for (let col = 0; col < colsCount; col++) {
        const node = this.raster[row][col];
        if (node) {
          cyNodes.push({
            data: {
              id: node.cyId,
              type: node.type,
              label: node.label,
            },
            position: {
              x: col * 90,
              y: row * 90,
            },
          });
        }
      }
    }
    return cyNodes;
  }

  public buildCyEdges(): any[] {
    return this.links.map((link: Link) => {
      return {
        data: {
          id: `${link.source.cyId}-${link.target.cyId}`,
          source: link.source.cyId,
          target: link.target.cyId,
          type: link.type,
        },
      };
    });
  }

  rowsCount(): number {
    return this.raster.length;
  }

  colsCount(): number {
    return this.raster[0].length;
  }

  private enlargeIfNecessary(row: number, col: number) {
    const currentColSize = this.raster[0].length;
    if (row >= this.raster.length) {
      const diff = row - this.raster.length;
      for (let i = 0; i <= diff; i++) {
        const newRow = new Array<Node | null>();
        for (let j = 0; j < currentColSize; j++) newRow.push(null);
        this.raster.push(newRow);
      }
    }
    if (col >= currentColSize) {
      const diff = col - currentColSize;
      for (let i = 0; i < this.raster.length; i++) {
        for (let j = 0; j <= diff; j++) this.raster[i].push(null);
      }
    }
  }
}

type Link = {
  source: Node;
  target: Node;
  type: string;
};
