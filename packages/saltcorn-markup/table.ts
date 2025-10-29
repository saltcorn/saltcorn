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
  button,
} = tags;
import helpers = require("./helpers");
import type { SearchBarOpts, RadioGroupOpts } from "./helpers";
const { pagination } = helpers;

/**
 * @param {any} hdr
 * @returns {th}
 */
const headerCell = (hdr: any, opts: any, ix: number): string => {
  const is_open =
    opts.header_filters_open?.has?.(hdr.row_key) ||
    opts.header_filters_open?.has?.(`_fromdate_${hdr.row_key}`) ||
    opts.header_filters_open?.has?.(`_todate_${hdr.row_key}`) ||
    opts.header_filters_open?.has?.(`_gte_${hdr.row_key}`) ||
    opts.header_filters_open?.has?.(`_lte_${hdr.row_key}`);
  const rndid =
    opts.header_filters_dropdown &&
    `hfdd${Math.floor(Math.random() * 16777215).toString(16)}`;

  return th(
    (hdr.align ||
      hdr.width ||
      (opts.header_filters_dropdown && hdr.header_filter)) && {
      style: {
        width: hdr.width || null,
        position:
          opts.header_filters_dropdown && hdr.header_filter ? "relative" : null,
      },
      ...(hdr.align ? { class: `text-align-${hdr.align}` } : {}),
    },
    hdr.sortlink
      ? span({ onclick: hdr.sortlink, class: "link-style" }, hdr.label)
      : hdr.label,
    opts.header_filters_dropdown &&
      hdr.header_filter &&
      span(
        { class: "dropdown float-end" },
        button({
          class: [
            `btn btn-${is_open ? "" : "outline-"}secondary btn-sm btn-xs dropdown-toggle`,
            is_open && "hdr-open",
          ],
          "data-boundary": "viewport",
          type: "button",
          "data-bs-toggle": "dropdown",
          "aria-haspopup": "true",
          "aria-expanded": "false",
          id: rndid,
        }),
        div(
          {
            class: ["hdrfiltdrop dropdown-menu", ix > 0 && "dropdown-menu-end"],
            "aria-labelledby": rndid,
          },
          div(
            { class: "p-2" },
            div("Filter ", hdr.row_label || ""),
            hdr.header_filter(rndid),
            button(
              {
                type: "button",
                class: "btn btn-secondary btn-sm mt-1",
                onclick: "clear_state('', this)",
              },
              "Clear all"
            )
          )
        )
      )
  );
};
const headerFilter = (hdr: any, isLast: boolean): string =>
  th(
    (hdr.align || hdr.width) && {
      style: hdr.width ? `width: ` + hdr.width : "",
      ...(hdr.align ? { class: `text-align-${hdr.align}` } : {}),
    },
    isLast
      ? div(
          { class: "d-flex" },
          hdr.header_filter() || null,
          button(
            {
              type: "button",
              class: "btn btn-xs btn-outline-secondary",
              onclick: "clear_state('', this)",
            },
            i({ class: "fas fa-times" })
          )
        )
      : hdr.header_filter() || null
  );

const headerCellWithToggle = (
  hdr: any,
  opts: any,
  isLast: boolean,
  ix: number
): string => {
  if (!(isLast && opts.header_filters && opts.header_filters_toggle))
    return headerCell(hdr, opts, ix);
  const content = hdr.sortlink
    ? span({ onclick: hdr.sortlink, class: "link-style" }, hdr.label)
    : hdr.label;
  const toggleIcon = span(
    {
      class: "header-filter-toggle link-style float-end",
      title: "Show/Hide filters",
      onclick: `toggle_header_filters(this)`,
      style:
        "cursor:pointer;margin-left:1rem;display:inline-flex;align-items:center;",
    },
    i({ class: "fas fa-chevron-down" })
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
    header_filter?: (id?: string) => string;
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
    row_color_formula?: string;
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
  if (opts.row_color_formula && !(opts as any)._rowColorFn) {
    (opts as any)._rowColorFn = new Function(
      "row",
      "with(row){return (" + opts.row_color_formula + ");}"
    );
  }
  const val_row = (v: any) => {
    let rowColor: string | undefined;
    if (opts.row_color_formula) {
      try {
        rowColor = (opts as any)._rowColorFn?.(v);
      } catch {
        rowColor = undefined;
      }
    }
    return tr(
      {
        ...(v[pk_name] ? { "data-row-id": v[pk_name] } : {}),
        ...mkClickHandler(opts, v),
        ...(rowColor ? { style: { backgroundColor: rowColor } } : {}),
      },
      hdrs.map((hdr: HeadersParams) =>
        td(
          {
            style: {
              ...(hdr.width && opts.noHeader ? { width: hdr.width } : {}),
              ...(rowColor ? { backgroundColor: rowColor } : {}),
            },
            ...(hdr.align ? { class: `text-align-${hdr.align}` } : {}),
          },
          typeof hdr.key === "string" ? text(v[hdr.key]) : hdr.key(v)
        )
      )
    );
  };
  const groupedBody = (groups: any) =>
    Object.entries(groups).map(
      ([group, rows]: [string, any]) =>
        tr(td({ colspan: "1000" }, h4({ class: "list-group-header" }, group))) +
        rows.map(val_row).join("")
    );

  return div(
    {
      class: [!opts.sticky_header && "table-responsive", opts.tableClass],
      id: opts.tableId,
    },
    table(
      {
        class: [
          "table table-sm",
          opts.class,
          ((hdrs.some((h: HeadersParams) => h.width) &&
            opts.table_layout !== "Auto") ||
            opts.table_layout === "Fixed") &&
            "table-layout-fixed",
          (opts.onRowSelect || (opts.hover && vs && vs.length > 1)) &&
            "table-hover",
        ],
        style: opts.style,
      },
      !opts.noHeader &&
        !opts.transpose &&
        thead(
          opts.sticky_header || opts.header_filters_dropdown
            ? {
                class: [
                  opts.sticky_header && "sticky-top",
                  opts.header_filters_dropdown && "header-filter-dropdown",
                ],
              }
            : "",
          tr(
            hdrs.map((hdr: HeadersParams, ix: number) =>
              headerCellWithToggle(hdr, opts, ix === hdrs.length - 1, ix)
            )
          ),
          opts.header_filters && !opts.header_filters_dropdown
            ? tr(
                {
                  class: "header-filters",
                  id: opts.header_filters_toggle
                    ? `${opts.tableId || "table"}_header_filters_row`
                    : null,
                  ...(opts.header_filters_toggle &&
                  !opts.header_filters_open?.size
                    ? { style: "display:none;" }
                    : {}),
                },
                hdrs.map((hdr: HeadersParams, ix: number) =>
                  headerFilter(hdr, ix === hdrs.length - 1)
                )
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
  #${opts.tableId} td.text-align-center,
  #${opts.tableId} th.text-align-right,
  #${opts.tableId} th.text-align-center {
     text-align: left !important;
  }

	#${opts.tableId} thead tr { 
		position: absolute;
		top: -9999px;
		left: -9999px;
	}
    
	
	#${opts.tableId} tr { border: 1px solid #ccc; }
	#${opts.tableId} tr:not(:first-child) { border-top-width: 3px }
	
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
