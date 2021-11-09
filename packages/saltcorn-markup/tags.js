/**
 * @category saltcorn-markup
 * @module tags
 */

const xss = require("xss");
const escape = require("escape-html");
const htmlTags = require("html-tags");
const voidHtmlTags = new Set(require("html-tags/void"));
const mkTag = require("./mktag");

//https://stackoverflow.com/a/59220393
/**
 * @param {string} js 
 * @returns {string}
 */
const domReady = (js) =>
  `(function(f){if (document.readyState === "complete") f(); else document.addEventListener('DOMContentLoaded',f,false)})(function(){${js}});`;

xss.whiteList.kbd = [];

/**
 * @param {string|number} t 
 * @returns {string}
 */
const text = (t) => (t === 0 ? "0" : xss(t));

/**
 * @param {string|number} t 
 * @returns {string}
 */
const text_attr = (t) => (t === 0 ? "0" : escape(t));

/**
 * @return {string[]}
 */
const allTags = Object.fromEntries(
  htmlTags.map((tag) => [tag, mkTag(tag, voidHtmlTags.has(tag))])
);

module.exports = {
  ...allTags,
  /**
   * @param {string} tagName 
   * @param  {...*} rest 
   * @returns {string}
   */
  genericElement: (tagName, ...rest) => mkTag(tagName, false)(...rest),
  domReady,
  text,
  text_attr,
  /** @type {string} */
  nbsp: "&nbsp;",
  /** @type {module:mktag} */
  mkTag,
};
