/**
 * @category saltcorn-markup
 * @module tags
 */
import mkTag from "./mktag";
import escape from "escape-html";
import { allTags } from "./generated_tags";
import {
  genericElement,
  domReady,
  with_curScript,
  text,
  text_attr,
  nbsp,
} from "./extra_tags";
import type { TagExports } from "./types";

// Named exports: one per HTML tag (a, div, span, …), generated from html-tags.
export * from "./generated_tags";
// Named exports: the hand-written helpers that live alongside the tags.
export {
  genericElement,
  domReady,
  with_curScript,
  text,
  text_attr,
  nbsp,
} from "./extra_tags";
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
