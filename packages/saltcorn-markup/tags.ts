/**
 * @category saltcorn-markup
 * @module tags
 */
import mkTag from "./mktag.js";
import escape from "escape-html";
import { allTags } from "./generated_tags.js";
import {
  genericElement,
  domReady,
  with_curScript,
  text,
  text_attr,
  nbsp,
} from "./extra_tags.js";
import type { TagExports } from "./types.js";

// Named exports: one per HTML tag (a, div, span, …), generated from html-tags.
export * from "./generated_tags.js";
// Named exports: the hand-written helpers that live alongside the tags.
export {
  genericElement,
  domReady,
  with_curScript,
  text,
  text_attr,
  nbsp,
} from "./extra_tags.js";
export { mkTag, escape };

// Back-compat default export: the whole tag surface as a single object, so that
// `import tags from "@saltcorn/markup/tags"; tags.div(...)` and
// `const tags = require("@saltcorn/markup/tags")` keep working.
const tagsExports: TagExports = {
  ...allTags,
  genericElement,
  domReady,
  with_curScript,
  text,
  text_attr,
  nbsp,
  mkTag,
  escape,
} as TagExports;

export default tagsExports;
