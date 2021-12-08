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

/*
 contract(
    is.fun(
      [
        is.array(is.obj({ label: is.str, key: is.or(is.str, is.fun()) })),
        is.array(is.obj()),
        is.maybe(
          is.obj({
            pagination: is.maybe(
              is.obj({
                current_page: is.posint,
                pages: is.posint,
                get_page_link: is.fun(),
              })
            ),
            noHeader: is.maybe(is.bool),
            hover: is.maybe(is.bool),
          })
        ),
      ],
      is.str
    ),*/

// declaration merging
namespace TableExports {
  export type HeadersParams = {
    label: string;
    key: string | Function;
    width: string;
    align: string;
  };

  // TOD ch
  export type OptsObject = {
    pagination?: {
      current_page: number;
      pages: number;
      get_page_link: any;
    };
    noHeader?: boolean;
    hover?: boolean;
  };
}

/**
 * @function
 * @param {object[]} hdrs
 * @param {object[]} vs
 * @param {object} [opts]
 * @returns {string}
 */
const mkTable = (
  hdrs: TableExports.HeadersParams[],
  vs: any[],
  opts: any = {}
): string =>
  div(
    { class: "table-responsive" },
    table(
      {
        class: [
          "table table-sm",
          opts.class,
          hdrs.some((h) => h.width) && "table-layout-fixed",
          (opts.onRowSelect || (opts.hover && vs && vs.length > 1)) &&
            "table-hover",
        ],
        style: opts.style,
      },
      !opts.noHeader && thead(tr(hdrs.map((hdr) => headerCell(hdr)))),
      tbody(
        (vs || []).map((v: any) =>
          tr(
            mkClickHandler(opts, v),
            hdrs.map((hdr) =>
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

const TableExports = mkTable;
export = TableExports;
