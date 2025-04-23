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

type ClassVal = string | string[];
type StyleVal = string | string[] | { [key: string]: string };

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

type Element = string | number | boolean | null | undefined | Element[];
type Attributes =
  | {
      [attribute: string]: string | boolean | undefined | null;
    }
  | { class?: ClassVal; style?: StyleVal };

/**
 * @param {string} tnm
 * @param {boolean} voidTag
 * @returns {function}
 */
const mkTag =
  (tnm: string, voidTag?: boolean) =>
  (first?: Attributes | Element, ...args: Element[]): string => {
    var body = "";
    var attribs = " ";

    const argIter = (arg: string | any) => {
      if (typeof arg === "undefined" || arg === null || arg === false) {
        //do nothing
      } else if (typeof arg === "string") {
        body += arg;
      } else if (Array.isArray(arg)) {
        arg.forEach(argIter);
      } else body += arg;
    };
    if (typeof first === "object" && !Array.isArray(first)) {
      attribs += Object.entries(first as Attributes)
        .map(ppAttrib)
        .filter((s) => s)
        .join(" ");
      args.forEach(argIter);
    } else {
      [first, ...args].forEach(argIter);
    }
    if (attribs === " ") attribs = "";
    return voidTag
      ? `<${tnm}${attribs}>`
      : `<${tnm}${attribs}>${body}</${tnm}>`;
  };

export = mkTag;
