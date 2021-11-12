/**
 * @category saltcorn-markup
 * @module mktag
 */

//https://stackoverflow.com/a/54246501
/**
 * @param {string} str 
 * @returns {string}
 */
const camelToCssCase = (str) =>
  str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * @param {string|object} cs 
 * @returns {string}
 */
const ppClasses = (cs) =>
  typeof cs === "string" ? cs : !cs ? "" : cs.filter((c) => c).join(" ");

/**
 * @param {string|object} c 
 * @returns {string}
 */
const ppClass = (c) => {
  const clss = ppClasses(c);
  return clss ? `class="${clss}"` : "";
};

/**
 * @param {string|string[]|object} [cs]
 * @returns {string}
 */
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

/**
 * @param {string|string[]|object} [cs]
 * @returns {string}
 */
const ppStyle = (c) => {
  const clss = ppStyles(c);
  return clss ? `style="${clss}"` : "";
};

/**
 * @param {object[]} opts
 * @param {string} opts.k
 * @param {boolean} [opts.v]
 * @returns {string}
 */
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

/**
 * @param {string} tnm 
 * @param {boolean} voidTag 
 * @returns {function}
 */
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

module.exports = mkTag;
