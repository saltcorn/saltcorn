import Node from "./node";
import type { NodeType } from "./node";
import { AbstractView as View } from "@saltcorn/types/model-abstracts/abstract_view";
import { AbstractPage as Page } from "@saltcorn/types/model-abstracts/abstract_page";
import layout from "../models/layout";
const { traverseSync } = layout;
const {
  parse_view_select,
} = require("../base-plugin/viewtemplates/viewable_fields");
import type { ConnectedObjects } from "@saltcorn/types/base_types";

export type ExtractOpts = {
  entryPages?: Array<Page>;
  showViews: boolean;
  showPages: boolean;
  showTables: boolean;
  showTrigger: boolean;
};

/**
 * builds object trees for 'views/pages' with branches for all possible paths
 * @param entryPages if given, those will be the start nodes of the first graphs
 * @returns root nodes
 */
export async function buildObjectTrees(
  opts: ExtractOpts
): Promise<Array<Node>> {
  const result = new Array<Node>();
  const helper = new ExtractHelper(opts);
  if (opts.showPages) {
    const entryPages = opts.entryPages ? opts.entryPages : new Array<any>();
    const entryPageTrees = await buildTree("page", entryPages, helper);
    const allPages = await require("../models/page").find();
    const pageTrees = await buildTree("page", allPages, helper);
    result.push(...entryPageTrees, ...pageTrees);
  }
  if (opts.showViews) {
    const allViews = await require("../models/view").find();
    const viewTrees = await buildTree("view", allViews, helper);
    result.push(...viewTrees);
  }
  return result;
}

async function buildTree(
  type: NodeType,
  objects: Array<Page | View>,
  helper: ExtractHelper
) {
  const result = new Array<Node>();
  for (const object of objects) {
    const node = new Node(type, object.name);
    if (!helper.cyIds.has(node.cyId)) {
      helper.cyIds.add(node.cyId);
      const connected = await object.connected_objects();
      await helper.handleNodeConnections(node, connected);
      result.push(node);
    }
  }
  return result;
}

/**
 * extracts all 'views/pages' aligned in the layout
 * @param layout view or page layout
 * @returns all found objects
 */
export function extractFromLayout(layout: any): ConnectedObjects {
  const embeddedViews = new Array<View>();
  const linkedPages = new Array<Page>();
  const linkedViews = new Array<View>();
  const _View = require("../models/view");
  const _Page = require("../models/page");
  traverseSync(layout, {
    view(segment: any) {
      const select = parse_view_select(segment.view);
      const view = _View.findOne({ name: select.viewname });
      if (view) embeddedViews.push(view);
    },
    view_link(segment: any) {
      const select = parse_view_select(segment.view);
      const view = _View.findOne({ name: select.viewname });
      if (view) linkedViews.push(view);
    },
    link(segment: any) {
      if (segment.link_src === "View") {
        const parts = segment.url.split("/");
        const viewName = parts[parts.length - 1];
        const view = _View.findOne({ name: viewName });
        if (view) linkedViews.push(view!);
      } else if (segment.link_src === "Page") {
        const parts = segment.url.split("/");
        const pagename = parts[parts.length - 1];
        const page = _Page.findOne({ name: pagename });
        if (page) linkedPages.push(page!);
      }
    },
  });

  return {
    embeddedViews,
    linkedViews,
    linkedPages,
  };
}

/**
 * extracts all views from 'columns'
 * @param columns columns from a view configuration
 * @returns all found objects
 */
export function extractFromColumns(columns: any[]): ConnectedObjects {
  const linkedViews = new Array<View>();
  const _View = require("../models/view");
  for (const column of columns) {
    if (column.type === "ViewLink") {
      const select = parse_view_select(column.view);
      const view = _View.findOne({ name: select.viewname });
      if (view) linkedViews.push(view);
    }
  }
  // currently only used for list
  // TODO embedded views and linked pages for other templates
  return { linkedViews };
}

/**
 * extracts one view that is used to create new entries
 * e.g. an embedded edit under the table of a list
 * @param configuration config of the view
 * @returns
 */
export function extractViewToCreate(
  configuration: any
): ConnectedObjects | null {
  const { view_to_create, create_view_display } = configuration;
  if (view_to_create) {
    const View = require("../models/view");
    const viewToCreate = View.findOne({ name: view_to_create });
    if (viewToCreate) {
      if (create_view_display === "Link" || create_view_display === "Popup") {
        return {
          linkedViews: [viewToCreate],
        };
      } else {
        return {
          embeddedViews: [viewToCreate],
        };
      }
    }
  }
  return null;
}

/**
 * helper to keep track of added nodes ('cyIds')
 */
class ExtractHelper {
  cyIds = new Set<string>();
  opts: ExtractOpts;

  constructor(opts: ExtractOpts) {
    this.opts = opts;
  }

  public async handleNodeConnections(
    oldNode: Node,
    connected: ConnectedObjects
  ) {
    if (this.opts.showViews)
      for (const embeddedView of connected.embeddedViews || []) {
        if (embeddedView) await this.addEmbeddedView(oldNode, embeddedView);
      }
    if (this.opts.showPages)
      for (const linkedPage of connected.linkedPages || []) {
        if (linkedPage) await this.addLinkedPageNode(oldNode, linkedPage);
      }
    if (this.opts.showViews)
      for (const linkedView of connected.linkedViews || []) {
        if (linkedView) await this.addLinkedViewNode(oldNode, linkedView);
      }
    if (this.opts.showTables)
      for (const table of connected.tables || []) {
        if (table) {
          const tableNode = new Node("table", table.name);
          this.cyIds.add(tableNode.cyId);
          oldNode.tables.push(tableNode);
        }
      }
  }

  private async addLinkedViewNode(oldNode: Node, newView: View) {
    const newNode = new Node("view", newView.name);
    oldNode.linked.push(newNode);
    if (!this.cyIds.has(newNode.cyId)) {
      this.cyIds.add(newNode.cyId);
      const connections = await newView.connected_objects();
      await this.handleNodeConnections(newNode, connections);
    }
  }

  private async addEmbeddedView(oldNode: Node, embedded: View) {
    const newNode = new Node("view", embedded.name);
    oldNode.embedded.push(newNode);
    if (!this.cyIds.has(newNode.cyId)) {
      this.cyIds.add(newNode.cyId);
      const connections = await embedded.connected_objects();
      await this.handleNodeConnections(newNode, connections);
    }
  }

  private async addLinkedPageNode(oldNode: Node, newPage: Page) {
    const newNode = new Node("page", newPage.name);
    oldNode.linked.push(newNode);
    if (!this.cyIds.has(newNode.cyId)) {
      this.cyIds.add(newNode.cyId);
      const connections = await newPage.connected_objects();
      await this.handleNodeConnections(newNode, connections);
    }
  }
}
