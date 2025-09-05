/**
 * @category saltcorn-markup
 * @module table
 */

import tags = require("./tags");
const {
  a,
  td,
  tr,
  th,
  text,
  div,
  table,
  thead,
  tbody,
  ul,
  li,
  span,
  h4,
  style,
} = tags;
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
      style: hdr.width ? `width: ` + hdr.width : "",
      ...(hdr.align ? { class: `text-align-${hdr.align}` } : {}),
    },
    hdr.sortlink
      ? span({ onclick: hdr.sortlink, class: "link-style" }, hdr.label)
      : hdr.label
  );

const headerFilter = (hdr: any): string => th(hdr.header_filter || null);

// declaration merging
namespace TableExports {
  export type HeadersParams = {
    label: string;
    key: string | Function;
    width?: string;
    align?: string;
    header_filter?: string;
  };

  export type OptsParams = {
    pagination?: {
      current_page: number;
      pages: number;
      get_page_link: Function;
    };
    noHeader?: boolean;
    hover?: boolean;
    transpose?: boolean;
    tableClass?: string;
    tableId?: string;
    grouped?: string;
    header_filters?: boolean;
    responsiveCollapse?: boolean;
    collapse_breakpoint_px?: number;
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
const transposedBody = (
  hdrs: HeadersParams[],
  vs: any[],
  opts: OptsParams | any = {}
): string[] =>
  hdrs.map((hdr: HeadersParams, ix) =>
    tr(
      {
        "data-row-id": ix,
      },
      !opts.noHeader && th(hdr.label),
      (vs || []).map((v: any) =>
        td(
          ix === 0 && opts.transpose_width
            ? {
                style: {
                  width: `${opts.transpose_width}${opts.transpose_width_units}`,
                },
              }
            : null,
          typeof hdr.key === "string" ? text(v[hdr.key]) : hdr.key(v)
        )
      )
    )
  );

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
): string => {
  const val_row = (v: any, index: number) =>
    tr(
      {
        "data-row-id": index,
        ...mkClickHandler(opts, v),
      },
      hdrs.map((hdr: HeadersParams) =>
        td(
          {
            style: {
              ...(hdr.width && opts.noHeader ? { width: hdr.width } : {}),
            },
            ...(hdr.align ? { class: `text-align-${hdr.align}` } : {}),
          },
          typeof hdr.key === "string" ? text(v[hdr.key]) : hdr.key(v)
        )
      )
    );
  const groupedBody = (groups: any) =>
    Object.entries(groups).map(
      ([group, rows]: [string, any]) =>
        tr(td({ colspan: "1000" }, h4({ class: "list-group-header" }, group))) +
        rows.map(val_row).join("")
    );
  return div(
    {
      class: ["table-responsive", opts.tableClass],
      id: opts.tableId,
    },
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
        !opts.transpose &&
        thead(
          tr(hdrs.map((hdr: HeadersParams) => headerCell(hdr))),
          opts.header_filters
            ? tr(
                { class: "header-filters" },
                hdrs.map((hdr: HeadersParams) => headerFilter(hdr))
              )
            : null
        ),
      tbody(
        opts.transpose
          ? transposedBody(hdrs, vs, opts)
          : opts.grouped
            ? groupedBody(vs)
            : (vs || []).map(val_row)
      )
    ),
    opts.pagination && pagination(opts.pagination),
    //https://css-tricks.com/responsive-data-tables/
    opts.responsiveCollapse &&
      opts.tableId &&
      style(`@media 
only screen and (max-width: ${opts.collapse_breakpoint_px || 760}px) {
	#${opts.tableId} table, #${opts.tableId} thead, #${opts.tableId} tbody, #${opts.tableId} th, #${opts.tableId} td, #${opts.tableId} tr { 
		display: block; 
	}

  #${opts.tableId} tr.header-filter {
    display: none;
  }
  #${opts.tableId} td.text-align-right,
  #${opts.tableId} td.text-align-right,
  #${opts.tableId} th.text-align-center,
  #${opts.tableId} th.text-align-center {
     text-align: left !important;
  }

	#${opts.tableId} thead tr { 
		position: absolute;
		top: -9999px;
		left: -9999px;
	}
	
	#${opts.tableId} tr { border: 1px solid #ccc; }
	
	#${opts.tableId} td { 
		border: none;
		border-bottom: 1px solid #eee; 
		position: relative;
		padding-left: 50%; 
	}
	
	#${opts.tableId} td:before { 
		position: absolute;
		top: 6px;
		left: 6px;
		width: 45%; 
		padding-right: 10px; 
		white-space: nowrap;
	}

  ${hdrs.map((hdr: HeadersParams, ix: number) => `#${opts.tableId} td:nth-of-type(${ix + 1}):before { content: "${hdr.label}"; }`).join("\n")}	
}`)
  );
};

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
