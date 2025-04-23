import type {
  ClassVal,
  StyleVal,
  Element,
  Attributes,
  AttributeVal,
} from "./types";

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
 * @param {string|string[]} c
 * @returns {string}
 */
const ppClass = (cs: ClassVal): string => {
  const clss =
    typeof cs === "string" ? cs : !cs ? "" : cs.filter((c) => c).join(" ");
  return clss ? `class="${clss}"` : "";
};

/**
 * @param {string|string[]|object} [cs]
 * @returns {string}
 */
const ppStyle = (cs: StyleVal): string => {
  const clss =
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
  return clss ? `style="${clss}"` : "";
};

/**
 * @param {object[]} opts
 * @param {string} opts.k
 * @param {boolean} [opts.v]
 * @returns {string}
 */
const ppAttrib = ([k, v]: [
  string,
  AttributeVal | ClassVal | StyleVal,
]): string =>
  typeof v === "boolean"
    ? v
      ? k
      : ""
    : typeof v === "undefined"
      ? ""
      : k === "class"
        ? ppClass(v as ClassVal)
        : k === "style"
          ? ppStyle(v as StyleVal)
          : `${k}="${v}"`;

/**
 * @param {string} tnm
 * @param {boolean} voidTag
 * @returns {function}
 */
const mkTag =
  (tnm: string, voidTag?: boolean) =>
  (
    attributes_or_first_child?: Attributes | Element,
    ...children: Element[]
  ): string => {
    var body = "";
    var attribs = " ";

    const argIter = (arg: Element) => {
      if (typeof arg === "undefined" || arg === null || arg === false) {
        //do nothing
      } else if (typeof arg === "string") {
        body += arg;
      } else if (Array.isArray(arg)) {
        arg.forEach(argIter);
      } else body += arg;
    };
    if (
      typeof attributes_or_first_child === "object" &&
      !Array.isArray(attributes_or_first_child) &&
      attributes_or_first_child !== null
    ) {
      attribs += Object.entries(attributes_or_first_child as Attributes)
        .map(ppAttrib)
        .filter((s) => s)
        .join(" ");
      children.forEach(argIter);
    } else {
      [attributes_or_first_child, ...children].forEach(argIter);
    }
    if (attribs === " ") attribs = "";
    return voidTag
      ? `<${tnm}${attribs}>`
      : `<${tnm}${attribs}>${body}</${tnm}>`;
  };

export = mkTag;
