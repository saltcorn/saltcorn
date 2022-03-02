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
 * @param {object} layout
 * @param {object[]} visitors
 * @returns {void}
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
 * @param {object} layout
 * @param {object[]} visitors
 * @returns {Promise<void>}
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
 * @param {object} layout
 * @param {*} f
 * @returns {void}
 */
const eachView = (layout: Layout, f: any): Promise<void> =>
  traverse(layout, { view: f });

/**
 * @param {object} layout
 * @returns {Promise<object[]>}
 */
const getViews = async (layout: Layout): Promise<any[]> => {
  const views: any[] = [];
  await eachView(layout, (segment: any) => {
    views.push(segment);
  });
  return views;
};

/**
 * @param {object} layout
 * @returns {string[]}
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
 * @param {object} layout
 * @param {object} locale
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
//getViews: is.fun([], is.promise(is.array(is.obj()))),
//eachView: is.fun(is.fun(is.obj(), is.any), is.promise(is.undefined)),
export = {
  eachView,
  getViews,
  traverse,
  traverseSync,
  getStringsForI18n,
  translateLayout,
};
