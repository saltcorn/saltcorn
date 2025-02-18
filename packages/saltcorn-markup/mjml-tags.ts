/**
 * @category saltcorn-markup
 * @module mjml-tags
 */

import mkTag = require("./mktag");
const tags: string[] = [
  "head",
  "style",
  "body",
  "section",
  "column",
  "image",
  "text",
  "divider",
  "raw",
  "button",
  "group",
  "attributes",
];
const allTags: { [k: string]: (...args: any[]) => string } = Object.fromEntries(
  tags.map((tag) => [tag, mkTag(`mj-${tag}`)])
);
const mjml = mkTag("mjml");
type ExportsType = {
  [key: string]: any; // "...allTags" properties
};

//https://www.litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design
const emailButton = (
  { href, title, btnStyle }: { href: string; title: string; btnStyle: string },
  label: string
) => {
  const rawType = btnStyle.replace("btn ", "");
  console.log({href, rawType, label});
  
  let bgColor = `#1F7F4C`;
  let color = `#ffffff`;
  switch (rawType) {
    case "btn-primary":
      
      break;
  
    default:
      break;
  }
  return `<a rel="noopener" target="_blank" ${title ? `title="${title}" ` : ""}href="${href}" style="background-color: ${bgColor}; font-size: 18px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; text-decoration: none; padding: 14px 20px; color: ${color}; border-radius: 5px; display: inline-block; mso-padding-alt: 0;">
    <!--[if mso]>
    <i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i>
    <![endif]-->
    <span style="mso-text-raise: 15pt;">${label}</span>
    <!--[if mso]>
    <i style="letter-spacing: 25px; mso-font-width: -100%;">&nbsp;</i>
    <![endif]-->
</a>`;
};
const tagsExports: ExportsType = {
  ...allTags,
  mjml,
  emailButton,
};

export = tagsExports;
