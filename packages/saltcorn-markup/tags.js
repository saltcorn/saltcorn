const xss = require("xss");

const mkTag = (tnm, forceStandAloneClosingTag) => (...args) => {
  var body = "";
  var attribs = " ";
  const ppAttrib = ([k, v]) =>
    typeof v === "boolean"
      ? v
        ? k
        : ""
      : typeof v === "undefined"
      ? ""
      : `${k}="${v}"`;

  const argIter = arg => {
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
          .join(" ");
      }
    } else body += arg;
  };
  args.forEach(argIter);
  if (attribs === " ") attribs = "";
  return body.length > 0 || forceStandAloneClosingTag
    ? `<${tnm}${attribs}>${body}</${tnm}>`
    : `<${tnm}${attribs} />`;
};
const input = kvs => {
  const attribs = Object.entries(kvs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<input ${attribs}>`;
};

const domReady = js => `$(function(){${js}})`;

const text = t => xss(t);

module.exports = {
  a: mkTag("a"),
  div: mkTag("div"),
  span: mkTag("span"),
  label: mkTag("label"),
  option: mkTag("option"),
  select: mkTag("select"),
  button: mkTag("button"),
  textarea: mkTag("textarea", true),
  form: mkTag("form"),
  script: mkTag("script"),
  p: mkTag("p"),
  table: mkTag("table"),
  thead: mkTag("thead"),
  tbody: mkTag("tbody"),
  small: mkTag("small"),
  tr: mkTag("tr"),
  th: mkTag("th"),
  td: mkTag("td"),
  ul: mkTag("ul"),
  li: mkTag("li"),
  h1: mkTag("h1"),
  h2: mkTag("h2"),
  h3: mkTag("h3"),
  h4: mkTag("h4"),
  h5: mkTag("h5"),
  i: mkTag("i", true),
  hr: mkTag("hr"),
  domReady,
  input,
  text
};
