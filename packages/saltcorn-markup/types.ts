import type { IWhiteList } from "xss";

export type Falsy = null | false | 0 | undefined;

export type ClassVal = string | Falsy | (string | Falsy)[];
export type StyleVal =
  | string
  | null
  | (string | Falsy)[]
  | { [key: string]: string | number };
export type AttributeVal = string | boolean | undefined | null;
export type Element = string | number | boolean | null | undefined | Element[];
export type Attributes = {
  [attribute: string]: AttributeVal | ClassVal | StyleVal;
  class?: ClassVal;
  style?: StyleVal;
};

export type TagFunction = (
  attributes_or_first_child?: Attributes | Element,
  ...children: Element[]
) => string;

type TagNames =
  | "a"
  | "abbr"
  | "address"
  | "area"
  | "article"
  | "aside"
  | "audio"
  | "b"
  | "base"
  | "bdi"
  | "bdo"
  | "blockquote"
  | "body"
  | "br"
  | "button"
  | "canvas"
  | "caption"
  | "cite"
  | "code"
  | "col"
  | "colgroup"
  | "data"
  | "datalist"
  | "dd"
  | "del"
  | "details"
  | "dfn"
  | "dialog"
  | "div"
  | "dl"
  | "dt"
  | "em"
  | "embed"
  | "fieldset"
  | "figcaption"
  | "figure"
  | "footer"
  | "form"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "head"
  | "header"
  | "hgroup"
  | "hr"
  | "html"
  | "i"
  | "iframe"
  | "img"
  | "input"
  | "ins"
  | "kbd"
  | "label"
  | "legend"
  | "li"
  | "link"
  | "main"
  | "map"
  | "mark"
  | "math"
  | "menu"
  | "menuitem"
  | "meta"
  | "meter"
  | "nav"
  | "noscript"
  | "object"
  | "ol"
  | "optgroup"
  | "option"
  | "output"
  | "p"
  | "param"
  | "picture"
  | "pre"
  | "progress"
  | "q"
  | "rb"
  | "rp"
  | "rt"
  | "rtc"
  | "ruby"
  | "s"
  | "samp"
  | "script"
  | "search"
  | "section"
  | "select"
  | "slot"
  | "small"
  | "source"
  | "span"
  | "strong"
  | "style"
  | "sub"
  | "summary"
  | "sup"
  | "svg"
  | "table"
  | "tbody"
  | "td"
  | "template"
  | "textarea"
  | "tfoot"
  | "th"
  | "thead"
  | "time"
  | "title"
  | "tr"
  | "track"
  | "u"
  | "ul"
  | "var"
  | "video"
  | "wbr";

type TagFunctionExports = {
  [key in `${TagNames}`]: TagFunction; // "...allTags" properties
};

export interface TagExports extends TagFunctionExports {
  genericElement: (
    tagName: string,
    attributes_or_first_child?: Attributes | Element,
    ...children: Element[]
  ) => string;
  domReady: (js: string) => string;
  text: (t: string | number, customWhiteList?: IWhiteList) => string;
  text_attr: (t: string | number) => string;
  nbsp: string;
  mkTag: (tnm: string, voidTag?: boolean) => TagFunction;
}
