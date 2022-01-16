/**
 * @category saltcorn-markup
 * @module mktag
 */

//https://stackoverflow.com/a/54246501
/**
 * @param {string} str
 * @returns {string}
 */
const camelToCssCase = (str: string): string =>
  str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * @param {string|string[]} cs
 * @returns {string}
 */
const ppClasses = (cs: string | string[]): string =>
  typeof cs === "string" ? cs : !cs ? "" : cs.filter((c) => c).join(" ");

/**
 * @param {string|string[]} c
 * @returns {string}
 */
const ppClass = (c: string | string[]): string => {
  const clss = ppClasses(c);
  return clss ? `class="${clss}"` : "";
};

/**
 * @param {string|string[]|object} [cs]
 * @returns {string}
 */
const ppStyles = (cs: string | string[] | { [key: string]: string }): string =>
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
const ppStyle = (c: string | string[] | { [key: string]: string }): string => {
  const clss = ppStyles(c);
  return clss ? `style="${clss}"` : "";
};

/**
 * @param {object[]} opts
 * @param {string} opts.k
 * @param {boolean} [opts.v]
 * @returns {string}
 */
const ppAttrib = ([k, v]: [string, any]): string =>
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
const mkTag = (tnm: string, voidTag?: boolean) => (
  ...args: string | any
): string => {
  var body = "";
  var attribs = " ";

  const argIter = (arg: string | any) => {
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

export = mkTag;
