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

type Visitors = { [key: string]: (segment: any) => any };

/**
 * @param layout
 * @param visitors
 * @returns
 */
const traverseSync = (layout: Layout, visitors: Visitors | Function): void => {
  const go = (segment: any) => {
    if (!segment) return;
    if (typeof visitors === "function") visitors(segment);
    else if (visitors[segment.type]) {
      visitors[segment.type](segment);
    }
    if (Array.isArray(segment)) {
      for (const seg of segment) go(seg);
      return;
    }
    if (segment.footer) {
      if (typeof segment.footer !== "string") go(segment.footer);
    }
    if (segment.titleRight) {
      if (typeof segment.titleRight !== "string") go(segment.titleRight);
    }
    if (segment.contents) {
      if (typeof segment.contents !== "string") go(segment.contents);
      return;
    }
    if (segment.above) {
      if (typeof visitors !== "function" && "above" in visitors) {
        visitors.above(segment);
      }
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
  //todo rewrite this without async/await to optimise?
  const go = async (segment: any) => {
    if (!segment) return;
    if (visitors[segment.type]) {
      const vres = visitors[segment.type](segment);
      if (vres && vres instanceof Promise) await vres;
    }
    if (Array.isArray(segment)) {
      for (const seg of segment) await go(seg);
      return;
    }
    if (segment.footer) {
      if (typeof segment.footer !== "string") await go(segment.footer);
    }
    if (segment.titleRight) {
      if (typeof segment.titleRight !== "string") await go(segment.titleRight);
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
const eachView = async (layout: Layout, f: any, state?: any): Promise<void> => {
  const go = async (segment: any, inLazy?: boolean) => {
    if (!segment) return;
    if (segment.type === "view") {
      const vres = f(segment, inLazy);
      if (vres && vres instanceof Promise) await vres;
    }
    if (Array.isArray(segment)) {
      for (const seg of segment) await go(seg, inLazy);
      return;
    }
    if (segment.footer) {
      if (typeof segment.footer !== "string") await go(segment.footer, inLazy);
    }
    if (segment.titleRight) {
      if (typeof segment.titleRight !== "string")
        await go(segment.titleRight, inLazy);
    }
    if (segment.contents) {
      if (
        segment.tabsStyle === "Tabs" &&
        segment.serverRendered &&
        Array.isArray(segment.contents)
      ) {
        const tabid = segment.tabId || "_tab";
        const curIx = +state[tabid] || 0;
        for (let index = 0; index < segment.contents.length; index++) {
          const seg = segment.contents[index];
          const makingLazy = index !== curIx;

          await go(seg, inLazy || makingLazy);
        }
        return;
      }
      if (segment.lazyLoadViews && Array.isArray(segment.contents)) {
        const curIx = 0;
        for (let index = 0; index < segment.contents.length; index++) {
          const seg = segment.contents[index];
          const makingLazy =
            !segment.acc_init_opens?.[index] &&
            (index !== curIx || segment.startClosed);

          await go(seg, inLazy || makingLazy);
        }
        return;
      }

      if (typeof segment.contents !== "string")
        await go(segment.contents, inLazy);
      return;
    }
    if (segment.above) {
      for (const seg of segment.above) await go(seg, inLazy);
      return;
    }
    if (segment.besides) {
      for (const seg of segment.besides) await go(seg, inLazy);
      return;
    }
  };
  await go(layout);
};

/**
 * execute a function on each page in the layout
 * @param layout
 * @param f
 * @returns
 */
const eachPage = (layout: Layout, f: any): Promise<void> =>
  traverse(layout, { page: f });

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
      else if (s.text_strings) strings.push(...s.text_strings);
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
    action(seg) {
      if (!seg.isFormula?.action_label) strings.push(seg.action_label);
    },
    view_link(seg) {
      if (!seg.isFormula?.label) strings.push(seg.view_label);
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
      if (s.text_strings && typeof s.contents === "string")
        for (const str of s.text_strings) {
          s.contents = s.contents.replaceAll(str, __(str));
        }
      else s.contents = __(s.contents);
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
    action(seg) {
      if (!seg.isFormula?.action_label) seg.action_label = __(seg.action_label);
    },
    view_link(seg) {
      if (!seg.isFormula?.label) seg.view_label = __(seg.view_label);
    },
  });
};

const countFields = (layout: Layout) => {
  let count = 0;
  traverseSync(layout, {
    field() {
      count += 1;
    },
  });

  return count;
};

const splitLayoutContainerFields = (layout: Layout) => {
  const findAllFieldsContainer = (l: Layout) => {
    let inner: any;
    //all-fields container is last container to have >1 field
    traverseSync(l, {
      blank(s) {
        if (countFields(s) > 1) inner = s;
      },
      container(s) {
        if (countFields(s) > 1) inner = s;
      },
      card(s) {
        if (countFields(s) > 1) inner = s;
      },
      above(s) {
        if (countFields(s) > 1) inner = s;
      },
    });
    return inner;
  };
  const inner = findAllFieldsContainer(layout);
  const outer = (newContents: Layout) => {
    const newLayout = structuredClone(layout);
    let replaceIt = (s: any) => {
      if (s.above) s.above = [newContents];
      else s.contents = newContents;
    };
    replaceIt(findAllFieldsContainer(newLayout));

    return newLayout;
  };

  return { outer, inner };
};

const findLayoutBranchWith = (
  layouts: Array<Layout>,
  pred: (l1: Layout) => boolean
) => {
  for (const layout of layouts) {
    let found = false;
    traverseSync(layout, (l: Layout) => {
      if (pred(l) && !found) found = true;
    });
    if (found) return layout;
  }
};

export = {
  eachView,
  eachPage,
  getViews,
  traverse,
  traverseSync,
  getStringsForI18n,
  translateLayout,
  countFields,
  splitLayoutContainerFields,
  findLayoutBranchWith,
};
