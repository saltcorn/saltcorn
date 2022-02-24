/**
 * @category saltcorn-markup
 * @module mjml-tags
 */

import mkTag = require("./mktag");
const tags: string[] = [
  "body",
  "section",
  "column",
  "image",
  "text",
  "divider",
  "raw",
  "button",
];
const allTags: { [k: string]: (...args: any[]) => string } = Object.fromEntries(
  tags.map((tag) => [tag, mkTag(`mj-${tag}`)])
);
const mjml = mkTag("mjml");
type ExportsType = {
  [key: string]: any; // "...allTags" properties
};

const tagsExports: ExportsType = {
  ...allTags,
  mjml,
};

export = tagsExports;
