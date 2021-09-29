const xss = require("xss");
const escape = require("escape-html");
const htmlTags = require("html-tags");
const voidHtmlTags = new Set(require("html-tags/void"));

//https://stackoverflow.com/a/54246501
const camelToCssCase = (str) =>
  str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const ppClasses = (cs) =>
  typeof cs === "string" ? cs : !cs ? "" : cs.filter((c) => c).join(" ");
const ppClass = (c) => {
  const clss = ppClasses(c);
  return clss ? `class="${clss}"` : "";
};
const ppStyles = (cs) =>
  typeof cs === "string"
    ? cs
    : !cs
    ? ""
    : Array.isArray(cs)
    ? cs.filter((c) => c).join(";")
    : typeof cs === "object"
    ? Object.entries(cs)
        .map(([k, v]) => `${camelToCssCase(k)}:${v}`)
        .join(";")
    : "";
const ppStyle = (c) => {
  const clss = ppStyles(c);
  return clss ? `style="${clss}"` : "";
};
const ppAttrib = ([k, v]) =>
  typeof v === "boolean"
    ? v
      ? k
      : ""
    : typeof v === "undefined"
    ? ""
    : k === "class"
    ? ppClass(v)
    : k === "style"
    ? ppStyle(v)
    : `${k}="${v}"`;
const mkTag = (tnm, voidTag) => (...args) => {
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
        attribs += Object.entries(arg)
          .map(ppAttrib)
          .filter((s) => s)
          .join(" ");
      }
    } else body += arg;
  };
  args.forEach(argIter);
  if (attribs === " ") attribs = "";
  return voidTag ? `<${tnm}${attribs}>` : `<${tnm}${attribs}>${body}</${tnm}>`;
};

//https://stackoverflow.com/a/59220393
const domReady = (js) =>
  `(function(f){if (document.readyState === "complete") f(); else document.addEventListener('DOMContentLoaded',f,false)})(function(){${js}});`;

xss.whiteList.kbd = [];

const text = (t) => (t === 0 ? "0" : xss(t));
const text_attr = (t) => (t === 0 ? "0" : escape(t));

const allTags = Object.fromEntries(
  htmlTags.map((tag) => [tag, mkTag(tag, voidHtmlTags.has(tag))])
);

module.exports = {
  ...allTags,
  domReady,
  text,
  text_attr,
  nbsp: "&nbsp;",
  mkTag,
};
