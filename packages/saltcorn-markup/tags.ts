/**
 * @category saltcorn-markup
 * @module tags
 */

import mkTag = require("./mktag");
import escape from "escape-html";
import htmlTags from "html-tags";
import voidHtmlTags from "html-tags/void";
import type {
  ClassVal,
  StyleVal,
  Element,
  Attributes,
  AttributeVal,
  TagFunction,
  TagExports,
} from "./types";
import {
  genericElement,
  domReady,
  with_curScript,
  text,
  text_attr,
  nbsp,
} from "./extra_tags";
const voidHtmlTagsSet = new Set<string>(voidHtmlTags);

const allTags: { [k: string]: TagFunction } = Object.fromEntries(
  htmlTags.map((tag) => [tag, mkTag(tag, voidHtmlTagsSet.has(tag))])
);

const tagsExports: TagExports = {
  ...allTags,
  /**
   * @param {string} tagName
   * @param  {...*} rest
   * @returns {string}
   */
  genericElement,
  domReady,
  with_curScript,
  text,
  text_attr,
  /** @type {string} */
  nbsp,
  /** @type {module:mktag} */
  mkTag,
  escape,
} as TagExports;

export = tagsExports;
