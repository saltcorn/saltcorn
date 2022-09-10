import Node from "./node";


/**
 * aligns the nodes from the application object tree on a raster
 */
export default class CytoscapeRaster {
  private raster = new Array<Array<Node | null>>();
  private cyIds = new Set<string>();
  private links = new Array<Link>();

  constructor(entryNodes: Array<Node>) {
    this.initRaster();
    this.alignNodes(entryNodes);
  }

  private initRaster(): void {
    const initialRows = 2;
    const initialCols = 2;
    for (let row = 0; row < initialRows; row++) {
      const row = new Array<Node | null>();
      for (let col = 0; col < initialCols; col++) {
        row.push(null);
      }
      this.raster.push(row);
    }
  }

  private alignNodes(entryNodes: Array<Node>): void {
    let startRow = 10;
    let startCol = 2;
    const visitor = buildVisitor(this);
    for (const node of entryNodes) {
      const dummyRoot = new Node("dummy", "");
      dummyRoot.linked.push(node);
      const usedSpace = traverse(dummyRoot, visitor, startRow, startCol);
      if (usedSpace.maxCol < 5) {
        startCol = usedSpace.maxCol;
      } else {
        startRow = usedSpace.maxRow;
        startCol = 2;
      }
    }
  }

  public addNode(node: Node, row: number, col: number) {
    this.enlargeIfNecessary(row, col);
    this.raster[row][col] = node;
    this.cyIds.add(node.cyId);
  }

  public addLink(source: Node, target: Node, type: LinkType) {
    this.links.push({
      source,
      target,
      type,
    });
  }

  /**
   * builds cytoscape.js nodes with 'data' and 'position'
   * @returns
   */
  public buildCyNodes(): any[] {
    const hSpacing = 150;
    const vSpacing = 90;
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
              x: col * hSpacing,
              y: row * vSpacing,
            },
          });
        }
      }
    }
    return cyNodes;
  }

  /**
   * builds cytoscape.js edges with 'data'
   * @returns
   */
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

  hasId(cyId: string): boolean {
    return this.cyIds.has(cyId);
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

const buildVisitor = (raster: CytoscapeRaster): any => {
  return {
    linked(
      source: Node,
      target: Node,
      row: number,
      col: number,
      noLink?: boolean
    ) {
      if (!raster.hasId(target.cyId)) {
        const pos = { row: row, col: col };
        const embedDepth = maxEmbedDepth(target.embedded, raster);
        if (embedDepth > 0) pos.col += embedDepth + 1;
        raster.addNode(target, pos.row, pos.col);
        if (!noLink) raster.addLink(source, target, "new_target");
        return pos;
      } else {
        raster.addLink(source, target, "existing_target");
        return null;
      }
    },
    embedded(source: Node, target: Node, row: number, col: number) {
      if (!raster.hasId(target.cyId)) {
        raster.addNode(target, row, col);
        raster.addLink(source, target, "new_target");
        return { row, col };
      } else {
        raster.addLink(source, target, "existing_target");
        return null;
      }
    },
    table(node: Node, row: number, col: number) {
      return true;
    },
  };
};

const traverse = (
  node: Node,
  visitor: any,
  startRow: number,
  startCol: number
): any => {
  let maxRow = 0;
  let maxCol = 0;
  const go = (
    current: Node,
    row: number,
    col: number,
    ignoreLinks?: boolean,
    parentIsDummy?: boolean,
    shiftEmbedsY?: boolean
  ) => {
    let insertEmbedCol = col - 1;
    let insertLinkedCol = col + 1;
    let insertEmbedRow = row > maxRow ? row : maxRow;
    let insertLinkedRow = insertEmbedRow;
    // put links from embeds to the parent
    const embeddedLinks = new Array<Node>();
    collectEmbeddedLinks(current, embeddedLinks);
    if (shiftEmbedsY) insertEmbedRow++;
    // align embeds
    for (const embedded of current.embedded) {
      if (visitor.embedded(current, embedded, insertEmbedRow, insertEmbedCol)) {
        go(embedded, insertEmbedRow, insertEmbedCol, true);
        if (++insertEmbedRow > maxRow) maxRow = insertEmbedRow;
      }
    }
    if (parentIsDummy) {
      // branches left from the root shouldn't affect right branches
      maxRow = 0;
      insertEmbedRow = row;
      insertLinkedRow = row;
    }
    if (!ignoreLinks) {
      const currentIsDummy = current.type === "dummy";
      let shiftEmbedsY = !currentIsDummy; // don't shift embeds from the first node
      // align links
      for (const linked of [...current.linked, ...embeddedLinks]) {
        const rasterPos = visitor.linked(
          current,
          linked,
          insertLinkedRow,
          insertLinkedCol,
          currentIsDummy
        );
        if (rasterPos) {
          insertLinkedCol = rasterPos.col;
          go(
            linked,
            insertLinkedRow,
            insertLinkedCol,
            false,
            currentIsDummy,
            shiftEmbedsY
          );
          if (maxRow > insertLinkedRow) insertLinkedRow = maxRow;
          else if (++insertLinkedRow > maxRow) maxRow = insertLinkedRow;
        }
      }
    }
    if (insertLinkedCol > maxCol) maxCol = insertLinkedCol;
    if (insertEmbedCol > maxCol) maxCol = insertEmbedCol;
  };
  go(node, startRow, startCol, false);
  return { maxRow: maxRow + 1, maxCol };
};

const maxEmbedDepth = (nodes: Node[], raster: CytoscapeRaster): number => {
  let max = 0;
  for (const node of nodes) {
    const depth = embedDepth(node, raster);
    if (depth > max) max = depth;
  }
  return max;
};

const embedDepth = (parent: Node, raster: CytoscapeRaster) => {
  if (parent.embedded.length === 0) return 0;
  let maxDepth = 0;
  for (const node of parent.embedded) {
    const branchDepth = embedDepth(node, raster);
    maxDepth = branchDepth > maxDepth ? branchDepth : maxDepth;
  }
  return maxDepth + (!raster.hasId(parent.cyId) ? 1 : 0);
};

const collectEmbeddedLinks = (parent: Node, result: Array<Node>) => {
  for (const embedded of parent.embedded) {
    result.push(...embedded.linked);
    collectEmbeddedLinks(embedded, result);
  }
};

type LinkType = "new_target" | "existing_target";

type Link = {
  source: Node;
  target: Node;
  type: LinkType;
};
