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
  i,
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

const headerCellWithToggle = (hdr: any, opts: any, isLast: boolean): string => {
  if (!(isLast && opts.header_filters && opts.header_filters_toggle))
    return headerCell(hdr);
  const idBase = opts.tableId || "table";
  const filterRowId = `${idBase}_header_filters_row`;
  const content = hdr.sortlink
    ? span({ onclick: hdr.sortlink, class: "link-style" }, hdr.label)
    : hdr.label;
  const toggleIcon = span(
    {
      class: "header-filter-toggle link-style",
      title: "Show/Hide filters",
      onclick: `var r=document.getElementById('${filterRowId}');
                  if(r){
                    var hidden = (r.style.display==='none' || window.getComputedStyle(r).display==='none');
                    if(hidden){
                      r.style.display='table-row';
                      var ic=this.querySelector('i');
                      if(ic){ ic.classList.remove('fa-chevron-down'); ic.classList.add('fa-chevron-up'); }
                    } else {
                      r.style.display='none';
                      var ic2=this.querySelector('i');
                      if(ic2){ ic2.classList.remove('fa-chevron-up'); ic2.classList.add('fa-chevron-down'); }
                    }
                  }
                return false;`,
      style:
        "cursor:pointer;margin-left:1rem;display:inline-flex;align-items:center;",
    },
    i({ class: "fas fa-chevron-up" })
  );
  return th(
    (hdr.align || hdr.width) && {
      style: hdr.width ? `width: ` + hdr.width : "",
      ...(hdr.align ? { class: `text-align-${hdr.align}` } : {}),
    },
    content,
    toggleIcon
  );
};

// declaration merging
namespace TableExports {
  export type HeadersParams = {
    label: string;
    key: string | Function;
    width?: string;
    align?: string;
    header_filter?: string;
    row_key?: string;
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
    header_filters_toggle?: boolean;
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
  hdrs.map((hdr: HeadersParams, ix) => {
    const row_key =
      hdr.row_key || (typeof hdr.key === "string" ? hdr.key : null);
    return tr(
      row_key ? { "row-key": row_key } : {},
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
    );
  });

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
  const pk_name = opts.pk_name || "id";
  const val_row = (v: any) =>
    tr(
      {
        ...(v[pk_name] ? { "data-row-id": v[pk_name] } : {}),
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
          tr(
            hdrs.map((hdr: HeadersParams, ix: number) =>
              headerCellWithToggle(hdr, opts, ix === hdrs.length - 1)
            )
          ),
          opts.header_filters
            ? tr(
                {
                  class: "header-filters",
                  id: opts.header_filters_toggle
                    ? `${opts.tableId || "table"}_header_filters_row`
                    : null,
                },
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
}`),
    opts.header_filters_toggle &&
      style(
        `#${opts.tableId || "table"} .header-filter-toggle i{transition:transform .2s;}
#${opts.tableId || "table"} .header-filter-toggle .fa-chevron-up{transform:rotate(0deg);}
#${opts.tableId || "table"} .header-filter-toggle .fa-chevron-down{transform:rotate(180deg);}`
      )
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
