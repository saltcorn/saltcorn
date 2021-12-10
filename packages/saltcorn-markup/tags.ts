/**
 * @category saltcorn-markup
 * @module tags
 */

import mkTag = require("./mktag");
import xss, { whiteList } from "xss";
import escape from "escape-html";
import htmlTags from "html-tags";
import voidHtmlTags from "html-tags/void";

const voidHtmlTagsSet = new Set(voidHtmlTags);

//https://stackoverflow.com/a/59220393
/**
 * @param {string} js
 * @returns {string}
 */
const domReady = (js: string): string =>
  `(function(f){if (document.readyState === "complete") f(); else document.addEventListener('DOMContentLoaded',f,false)})(function(){${js}});`;

whiteList.kbd = [];

/**
 * @param {string|number} t
 * @returns {string}
 */
const text = (t: string | number): string => (t === 0 ? "0" : xss(<string>t));

/**
 * @param {string|number} t
 * @returns {string}
 */
const text_attr = (t: string | number) => (t === 0 ? "0" : escape(<string>t));

/**
 */
const allTags: { [k: string]: (...args: any[]) => string } = Object.fromEntries(
  htmlTags.map((tag) => [tag, mkTag(tag, voidHtmlTagsSet.has(tag))])
);

type ExportsType = {
  [key: string]: any; // "...allTags" properties
  genericElement: (tagName: string, ...rest: any[]) => string;
  domReady: (js: string) => string;
  text: (t: string | number) => string;
  text_attr: (t: string | number) => string;
  nbsp: string;
  mkTag: typeof mkTag;
};

const tagsExports: ExportsType = {
  ...allTags,
  /**
   * @param {string} tagName
   * @param  {...*} rest
   * @returns {string}
   */
  genericElement: (tagName: string, ...rest: any[]) =>
    mkTag(tagName, false)(...rest),
  domReady,
  text,
  text_attr,
  /** @type {string} */
  nbsp: "&nbsp;",
  /** @type {module:mktag} */
  mkTag,
};

export = tagsExports;
