import { DummyNode } from "./nodes/dummy_node";
import Node from "./nodes/node";

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
    let maxRowInLine = 0;
    for (const node of entryNodes) {
      const dummyRoot = new DummyNode();
      dummyRoot.linked.push(node);
      const usedSpace = traverse(dummyRoot, visitor, startRow, startCol);
      if (usedSpace.maxRow > maxRowInLine) maxRowInLine = usedSpace.maxRow;
      if (usedSpace.maxCol < 10) {
        startCol = usedSpace.maxCol;
      } else {
        startRow = maxRowInLine;
        startCol = 2;
        maxRowInLine = 0;
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
            data: node.cyDataObject(),
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
  const allignTablesAndTrigger = (
    source: Node,
    tables: Array<Node>,
    row: number,
    col: number
  ) => {
    const triggerRow = row;
    let tableRow = row;
    let triggerCol = col;
    let tableCol = col;
    let anyNewTables = false;
    for (const table of tables) {
      if (!raster.hasId(table.cyId)) {
        anyNewTables = true;
        for (const trigger of table.trigger) {
          raster.addNode(trigger, triggerRow, triggerCol--);
          raster.addLink(table, trigger, "new_target");
        }
        if (table.trigger.length > 0) tableRow = row + 1;
        raster.addNode(table, tableRow, tableCol);
        raster.addLink(source, table, "new_target");
        tableCol = triggerCol;
      } else {
        raster.addLink(source, table, "existing_target");
      }
    }
    return { row: anyNewTables ? ++tableRow : tableRow, col: tableCol };
  };

  return {
    linked(
      source: Node,
      target: Node,
      row: number,
      col: number,
      noLink?: boolean
    ) {
      let insertRow = row;
      let insertCol = col;
      if (!raster.hasId(target.cyId)) {
        insertCol += leftDepth(target, raster);
        const newInsertPos = allignTablesAndTrigger(
          target,
          target.tables,
          insertRow,
          insertCol
        );
        if (newInsertPos) insertRow = newInsertPos.row;
        raster.addNode(target, insertRow, insertCol);
        if (!noLink) raster.addLink(source, target, "new_target");
        return { row: insertRow, col: insertCol };
      } else {
        raster.addLink(source, target, "existing_target");
        return null;
      }
    },
    embedded(source: Node, target: Node, row: number, col: number) {
      let insertRow = row;
      let insertCol = col;
      if (!raster.hasId(target.cyId)) {
        const newInsertPos = allignTablesAndTrigger(
          target,
          target.tables,
          insertRow,
          insertCol
        );
        if (newInsertPos) insertRow = newInsertPos.row;
        raster.addNode(target, insertRow, insertCol);
        raster.addLink(source, target, "new_target");
        return { row: insertRow, col: insertCol };
      } else {
        raster.addLink(source, target, "existing_target");
        return null;
      }
    },
  };
};

const traverse = (
  node: Node,
  visitor: any,
  startRow: number,
  startCol: number
): any => {
  let maxRow = startRow;
  let rootEmbedMax = maxRow;
  let maxCol = startCol;
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
    let insertEmbedRow = row > maxRow ? row : maxRow + 1;
    let insertLinkedRow = insertEmbedRow;
    // put links from embeds to the parent
    const embeddedLinks = new Array<Node>();
    collectEmbeddedLinks(current, embeddedLinks);
    if (shiftEmbedsY) insertEmbedRow++;
    // align embeds
    for (const embedded of current.embedded) {
      if (maxRow > insertEmbedRow) insertEmbedRow = maxRow;
      const rasterPos = visitor.embedded(
        current,
        embedded,
        insertEmbedRow,
        insertEmbedCol
      );
      if (rasterPos) {
        insertEmbedRow = rasterPos.row;
        insertEmbedCol = rasterPos.col;
        go(embedded, insertEmbedRow, insertEmbedCol, true);
        if (++insertEmbedRow > maxRow) maxRow = insertEmbedRow;
      }
    }
    if (parentIsDummy) {
      // branches left from the root shouldn't affect right branches
      rootEmbedMax = maxRow;
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
          insertLinkedRow = rasterPos.row;
          if (insertLinkedRow > maxRow) maxRow = insertLinkedRow;
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
  return {
    maxRow: (rootEmbedMax > maxRow ? rootEmbedMax : maxRow) + 1,
    maxCol,
  };
};

const leftDepth = (node: Node, raster: CytoscapeRaster) => {
  const tblDepth = tableDepth(node, raster);
  const embedDepth = maxEmbedDepth(node.embedded, raster);
  return tblDepth > embedDepth ? tblDepth : embedDepth;
};

const tableDepth = (parent: Node, raster: CytoscapeRaster) => {
  const usedIds = new Set<string>();
  let depth = 0;
  for (const tbl of parent.tables || []) {
    const triggerCount = tbl.trigger.length;
    if (!raster.hasId(tbl.cyId)) {
      usedIds.add(tbl.cyId);
      if (tbl.trigger.length > 1) {
        depth += triggerCount > 1 ? triggerCount : 1;
      }
    }
  }
  return depth;
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
  if (raster.hasId(parent.cyId)) return 0;
  let maxDepth = 0;
  for (const node of parent.embedded) {
    const branchDepth = embedDepth(node, raster);
    maxDepth = branchDepth > maxDepth ? branchDepth : maxDepth;
  }
  let tblSpace = tableDepth(parent, raster);
  return maxDepth + (tblSpace > 1 ? tblSpace : 1);
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
