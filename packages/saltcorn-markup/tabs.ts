/**
 * @category saltcorn-markup
 * @module tabs
 */

import tags from "./tags.js";
import { validID } from "./layout_utils.js";
const { a, text, div, ul, li } = tags;

/**
 * @param {string} str
 * @returns {string}
 */
const mkId = (str: string): string => text(str.split(" ").join("_"));

/**
 * ids that survive the URL hash unchanged: ASCII only, unique, non-empty
 * @param {string[]} names
 * @returns {string[]}
 */
const mkDeeplinkIds = (names: string[]): string[] => {
  const seen = new Set<string>();
  return names.map((nm, ix) => {
    let id = validID(nm);
    if (!id || seen.has(id)) id = `tab${ix}`;
    while (seen.has(id)) id += "_";
    seen.add(id);
    return id;
  });
};

/**
 * @param {object} obj
 * @param {object} [opts]
 * @param {boolean} [opts.deeplink] keep the selected tab in the URL hash
 * @returns {object}
 */
const tabs = (obj: any | any[], opts: { deeplink?: boolean } = {}) => {
  const entries = Array.isArray(obj) ? obj : Object.entries(obj);
  const ids = opts.deeplink
    ? mkDeeplinkIds(entries.map((e) => e[0]))
    : entries.map((e) => mkId(e[0]));
  const lis = entries.map((e, ix) =>
    li(
      { class: "nav-item" },
      a(
        {
          class: ["nav-link", ix == 0 && "active", opts.deeplink && "deeplink"],
          "data-bs-toggle": "tab",
          href: `#${ids[ix]}`,
          id: `${ids[ix]}-tab`,
          role: "tab",
          "aria-controls": "home",
          "aria-selected": "true",
        },
        text(e[0])
      )
    )
  );
  const divs = entries.map((e, ix) =>
    div(
      {
        class: ["tab-pane fade", ix == 0 && "show active"],
        id: `${ids[ix]}`,
        role: "tabpanel",
        "aria-labelledby": `${ids[ix]}-tab`,
      },
      e[1]
    )
  );
  return (
    ul({ class: "nav nav-tabs", role: "tablist" }, lis) +
    div({ class: "tab-content" }, divs)
  );
};

export default tabs;
