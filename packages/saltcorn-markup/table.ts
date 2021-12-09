import tags = require("./tags");
const { a, td, tr, th, text, div, table, thead, tbody, ul, li, span } = tags;
import helpers = require("./helpers");
import type { SearchBarOpts, RadioGroupOpts } from "./helpers";
const { pagination } = helpers;

/**
 * @param {any} hdr
 * @returns {th}
 */
const headerCell = (hdr: any): string =>
  th(
    (hdr.align || hdr.width) && {
      style:
        (hdr.align ? `text-align: ` + hdr.align : "") +
        (hdr.width ? `width: ` + hdr.width : ""),
    },
    hdr.sortlink ? a({ href: hdr.sortlink }, hdr.label) : hdr.label
  );

// declaration merging
namespace TableExports {
  export type HeadersParams = {
    label: string;
    key: string | Function;
    width: string;
    align: string;
  };

  export type OptsParams = {
    pagination?: {
      current_page: number;
      pages: number;
      get_page_link: Function;
    };
    noHeader?: boolean;
    hover?: boolean;
  };
}
type HeadersParams = TableExports.HeadersParams;
type OptsParams = TableExports.OptsParams;

/**
 * @function
 * @param {object[]} hdrs
 * @param {object[]} vs
 * @param {object} [opts]
 * @returns {string}
 */
const mkTable = (
  hdrs: HeadersParams[],
  vs: any[],
  opts: OptsParams | any = {}
): string =>
  div(
    { class: "table-responsive" },
    table(
      {
        class: [
          "table table-sm",
          opts.class,
          hdrs.some((h: HeadersParams) => h.width) && "table-layout-fixed",
          (opts.onRowSelect || (opts.hover && vs && vs.length > 1)) &&
            "table-hover",
        ],
        style: opts.style,
      },
      !opts.noHeader &&
        thead(tr(hdrs.map((hdr: HeadersParams) => headerCell(hdr)))),
      tbody(
        (vs || []).map((v: any) =>
          tr(
            mkClickHandler(opts, v),
            hdrs.map((hdr: HeadersParams) =>
              td(
                !!hdr.align && { style: "text-align:" + hdr.align },
                typeof hdr.key === "string" ? text(v[hdr.key]) : hdr.key(v)
              )
            )
          )
        )
      )
    ),
    opts.pagination && pagination(opts.pagination)
  );

/**
 * @param {object} opts
 * @param {object} v
 * @returns {object}
 */
const mkClickHandler = (opts: any, v: any): any => {
  var attrs: any = {};
  if (opts.onRowSelect)
    attrs.onclick =
      typeof opts.onRowSelect === "function"
        ? opts.onRowSelect(v)
        : opts.onRowSelect;
  if (opts.selectedId && v.id && +v.id === +opts.selectedId)
    attrs.class = "table-active";
  return attrs;
};

// declaration merging
const TableExports = mkTable;
export = TableExports;
