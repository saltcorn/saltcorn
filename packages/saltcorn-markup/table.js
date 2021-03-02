const { contract, is } = require("contractis");

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
} = require("./tags");
const { pagination } = require("./helpers");
const headerCell = (hdr) =>
  th(
    !!hdr.align && { style: "text-align:" + hdr.align },
    !!hdr.sortlink ? a({ href: hdr.sortlink }, hdr.label) : hdr.label
  );

const mkTable = contract(
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
  ),
  (hdrs, vs, opts = {}) =>
    div(
      { class: "table-responsive" },
      table(
        {
          class: [
            "table table-sm",
            opts.class,
            (opts.onRowSelect || (opts.hover && vs && vs.length > 1)) &&
              "table-hover",
          ],
          style: opts.style,
        },
        !opts.noHeader && thead(tr(hdrs.map((hdr) => headerCell(hdr)))),
        tbody(
          (vs || []).map((v) =>
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
    )
);

const mkClickHandler = (opts, v) => {
  var attrs = {};
  if (opts.onRowSelect)
    attrs.onclick =
      typeof opts.onRowSelect === "function"
        ? opts.onRowSelect(v)
        : opts.onRowSelect;
  if (opts.selectedId && v.id && +v.id === +opts.selectedId)
    attrs.class = "table-active";
  return attrs;
};
module.exports = mkTable;
