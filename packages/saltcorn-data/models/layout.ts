/**
 * @category saltcorn-data
 * @module models/layout
 * @subcategory models
 */

import state from "../db/state";
const { getState } = state;
import { Layout } from "@saltcorn/types/base_types";
import db from "../db/index";
const { is_node } = db;

type Visitors = { [key: string]: (segment: any) => void };

/**
 * @param layout
 * @param visitors
 * @returns
 */
const traverseSync = (layout: Layout, visitors: Visitors): void => {
  const go = (segment: any) => {
    if (!segment) return;
    if (visitors[segment.type]) {
      visitors[segment.type](segment);
    }
    if (Array.isArray(segment)) {
      for (const seg of segment) go(seg);
      return;
    }
    if (segment.contents) {
      if (typeof segment.contents !== "string") go(segment.contents);
      return;
    }
    if (segment.above) {
      for (const seg of segment.above) go(seg);
      return;
    }
    if (segment.besides) {
      for (const seg of segment.besides) go(seg);
      return;
    }
  };
  go(layout);
};

/**
 * @param layout
 * @param visitors
 * @returns
 */
const traverse = async (layout: Layout, visitors: Visitors): Promise<void> => {
  const go = async (segment: any) => {
    if (!segment) return;
    if (visitors[segment.type]) {
      await visitors[segment.type](segment);
      return;
    }
    if (Array.isArray(segment)) {
      for (const seg of segment) await go(seg);
      return;
    }
    if (segment.contents) {
      if (typeof segment.contents !== "string") await go(segment.contents);
      return;
    }
    if (segment.above) {
      for (const seg of segment.above) await go(seg);
      return;
    }
    if (segment.besides) {
      for (const seg of segment.besides) await go(seg);
      return;
    }
  };
  await go(layout);
};

/**
 * execute a function on each view in the layout
 * @param layout
 * @param f
 * @returns
 */
const eachView = (layout: Layout, f: any): Promise<void> =>
  traverse(layout, { view: f });

/**
 * execute a function on each page in the layout
 * @param layout 
 * @param f 
 * @returns 
 */
const eachPage = (layout: Layout, f: any): Promise<void> =>
  traverse(layout, { page: f});

/**
 * @param layout
 * @returns
 */
const getViews = async (layout: Layout): Promise<any[]> => {
  const views: any[] = [];
  await eachView(layout, (segment: any) => {
    views.push(segment);
  });
  return views;
};

/**
 * @param layout
 * @returns
 */
const getStringsForI18n = (layout: Layout): string[] => {
  const strings: string[] = [];
  traverseSync(layout, {
    blank(s: any) {
      if (typeof s === "string") strings.push(s);
      else if (s.contents) strings.push(s.contents);
    },
    link({ text }: { text: string }) {
      strings.push(text);
    },
    card({ title }: { title: string }) {
      strings.push(title);
    },
    tabs({ titles }: { titles: string[] }) {
      strings.push(...titles);
    },
  });
  return strings;
};

/**
 * @param layout
 * @param locale
 */
const translateLayout = (layout: Layout, locale: string): void => {
  const appState = getState();
  const __ =
    is_node && appState
      ? (s: string) => appState.i18n.__({ phrase: s, locale }) || s
      : (s: string) => {
          return s;
        };

  traverseSync(layout, {
    blank(s: any) {
      s.contents = __(s.contents);
    },
    link(s: { text: string }) {
      s.text = __(s.text);
    },
    card(s: { title: string }) {
      s.title = __(s.title);
    },
    tabs(s: { titles: string[] }) {
      s.titles = s.titles.map((t: string) => __(t));
    },
  });
};

export = {
  eachView,
  eachPage,
  getViews,
  traverse,
  traverseSync,
  getStringsForI18n,
  translateLayout,
};
