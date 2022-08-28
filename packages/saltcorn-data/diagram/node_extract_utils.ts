import Node from "./node";
import { AbstractView as View } from "@saltcorn/types/model-abstracts/abstract_view";
import { AbstractPage as Page } from "@saltcorn/types/model-abstracts/abstract_page";
import layout from "../models/layout";
const { traverseSync } = layout;
const {
  parse_view_select,
} = require("../base-plugin/viewtemplates/viewable_fields");
import type { ConnectedObjects } from "@saltcorn/types/base_types";

/**
 * builds an object tree with all possible paths from 'entryPage'
 * @param entryPage start of user journey
 * @returns the root node of the object tree
 */
export function buildObjectTree(entryPage: Page): Node {
  const entryNode = new Node("page", entryPage.name);
  const connected = entryPage.connected_objects();
  handleConnected(entryNode, connected);
  return entryNode;
}

/**
 * extracts all 'views / pages' aligned within the layout
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
        linkedViews.push(view!);
      } else if (segment.link_src === "Page") {
        const parts = segment.url.split("/");
        const pagename = parts[parts.length - 1];
        const page = _Page.findOne({ name: pagename });
        linkedPages.push(page!);
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
  // TODO extract embedded views and linked pages for other templates
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
  return null;
}

function addLinkedViewNode(oldNode: Node, newView: View) {
  const newNode = new Node("view", newView.name);
  oldNode.linked.push(newNode);
  const yielded = newView.connected_objects();
  handleConnected(newNode, yielded);
}

function addEmbeddedView(oldNode: Node, embedded: View) {
  const newNode = new Node("view", embedded.name);
  oldNode.embedded.push(newNode);
  const yielded = embedded.connected_objects();
  handleConnected(newNode, yielded);
}

function addLinkedPageNode(oldNode: Node, newPage: Page) {
  const newNode = new Node("page", newPage.name);
  oldNode.linked.push(newNode);
  const yielded = newPage.connected_objects();
  handleConnected(newNode, yielded);
}

function handleConnected(oldNode: Node, yielded: ConnectedObjects) {
  for (const embeddedView of yielded.embeddedViews || []) {
    addEmbeddedView(oldNode, embeddedView);
  }
  for (const linkedPage of yielded.linkedPages || []) {
    addLinkedPageNode(oldNode, linkedPage);
  }
  for (const linkedView of yielded.linkedViews || []) {
    addLinkedViewNode(oldNode, linkedView);
  }
}
