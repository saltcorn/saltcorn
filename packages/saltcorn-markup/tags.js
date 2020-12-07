const xss = require("xss");
const escape = require("escape-html");

const ppClasses = (cs) =>
  typeof cs === "string" ? cs : !cs ? "" : cs.filter((c) => c).join(" ");

const ppAttrib = ([k, v]) =>
  typeof v === "boolean"
    ? v
      ? k
      : ""
    : typeof v === "undefined"
    ? ""
    : k === "class"
    ? `class="${ppClasses(v)}"`
    : `${k}="${v}"`;
const mkTag = (tnm, forceStandAloneClosingTag) => (...args) => {
  var body = "";
  var attribs = " ";

  const argIter = (arg) => {
    if (typeof arg === "undefined" || arg === null || arg === false) {
      //do nothing
    } else if (typeof arg === "string") {
      body += arg;
    } else if (typeof arg === "object") {
      if (Array.isArray(arg)) {
        arg.forEach(argIter);
      } else {
        attribs += Object.entries(arg).map(ppAttrib).join(" ");
      }
    } else body += arg;
  };
  args.forEach(argIter);
  if (attribs === " ") attribs = "";
  return body.length > 0 || forceStandAloneClosingTag
    ? `<${tnm}${attribs}>${body}</${tnm}>`
    : `<${tnm}${attribs} />`;
};
const input = (kvs) => {
  const attribs = Object.entries(kvs).map(ppAttrib).join(" ");
  return `<input ${attribs}>`;
};

//https://stackoverflow.com/a/59220393
const domReady = (js) =>
  `(function(f){if (document.readyState === "complete") f(); else document.addEventListener('DOMContentLoaded',f,false)})(function(){${js}});`;

const text = (t) => (t === 0 ? "0" : xss(t));
const text_attr = (t) => (t === 0 ? "0" : escape(t));
const escapeHTML = (str) =>
  str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[tag])
  );
const nbsp = "&nbsp;";
module.exports = {
  a: mkTag("a"),
  div: mkTag("div", true),
  span: mkTag("span"),
  label: mkTag("label"),
  option: mkTag("option"),
  select: mkTag("select"),
  button: mkTag("button"),
  textarea: mkTag("textarea", true),
  form: mkTag("form"),
  script: mkTag("script", true),
  style: mkTag("style"),
  p: mkTag("p"),
  table: mkTag("table"),
  img: mkTag("img"),
  thead: mkTag("thead"),
  tbody: mkTag("tbody"),
  small: mkTag("small"),
  pre: mkTag("pre"),
  code: mkTag("code"),
  header: mkTag("header"),
  footer: mkTag("footer"),
  section: mkTag("section"),
  tr: mkTag("tr"),
  th: mkTag("th"),
  td: mkTag("td"),
  ul: mkTag("ul"),
  ol: mkTag("ol"),
  li: mkTag("li"),
  h1: mkTag("h1"),
  h2: mkTag("h2"),
  h3: mkTag("h3"),
  h4: mkTag("h4"),
  h5: mkTag("h5"),
  h6: mkTag("h6"),
  nav: mkTag("nav"),
  i: mkTag("i", true),
  hr: mkTag("hr"),
  domReady,
  input,
  text,
  text_attr,
  nbsp,
  mkTag,
  escapeHTML,
};
