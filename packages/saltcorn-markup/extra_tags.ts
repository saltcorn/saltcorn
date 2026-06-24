/**
 * @category saltcorn-markup
 * @module tags
 */

import mkTag from "./mktag.js";
import xss from "xss";
import escape from "escape-html";
import type { Element, Attributes } from "./types.js";

// xss is a CommonJS module whose `whiteList` is added dynamically: it is neither
// detectable as a named ESM export nor declared on the callable default type, so
// read it off the default import with a cast.
import type { IWhiteList } from "xss";
const whiteList: IWhiteList = (xss as any).whiteList;

//https://stackoverflow.com/a/59220393
/**
 * @param {string} js
 * @returns {string}
 */
export const domReady = (js: string): string =>
  `(function(f){if (document.readyState === "complete") f(); else document.addEventListener('DOMContentLoaded',()=>setTimeout(f),false)})(function(){${js}});`;

export const with_curScript = (js: string): string =>
  `((curScript)=>{${js}})(document.currentScript)`;

whiteList.kbd = [];
whiteList.span = ["style"];
whiteList.div = ["style"];
whiteList.td = ["style"];

const mergeWhiteList = (customWhiteList: IWhiteList): IWhiteList => {
  const res = JSON.parse(JSON.stringify(whiteList));
  for (const [k, v] of Object.entries(customWhiteList)) {
    if (!v) continue;
    if (res[k]) res[k].push(...v);
    else res[k] = v;
  }
  return res;
};

/**
 * @param {string|number} t
 * @returns {string}
 */
export const text = (
  t: string | number,
  customWhiteList?: IWhiteList
): string =>
  t === 0
    ? "0"
    : xss(
        <string>t,
        customWhiteList
          ? { whiteList: mergeWhiteList(customWhiteList) }
          : undefined
      );

/**
 * @param {string|number} t
 * @returns {string}
 */
export const text_attr = (t: string | number) =>
  t === 0 ? "0" : escape(<string>t);

/**
 * @param {string} tagName
 * @param  {...*} rest
 * @returns {string}
 */
export const genericElement = (
  tagName: string,
  attributes_or_first_child?: Attributes | Element,
  ...children: Element[]
): string => mkTag(tagName, false)(attributes_or_first_child, ...children);

/** @type {string} */
export const nbsp = "&nbsp;";
