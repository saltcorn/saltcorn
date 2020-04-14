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
  span
} = require("./tags");

const headerCell = hdr =>
  hdr.sortlink
    ? th(a({ href: hdr.sortlink }, text(hdr.label)))
    : th(text(hdr.label));

const pagination = ({ current_page, pages, get_page_link }) => {
  const from = Math.max(1, current_page - 3);
  const to = Math.min(pages, current_page + 3);
  var lis = [];
  if (from > 1) {
    lis.push(
      li(
        { class: `page-item` },
        a({ class: "page-link", href: get_page_link(1) }, 1)
      )
    );
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
  }

  for (let index = from; index <= to; index++) {
    lis.push(
      li(
        { class: `page-item ${index === current_page ? "active" : ""}` },
        a({ class: "page-link", href: get_page_link(index) }, index)
      )
    );
  }
  if (to < pages) {
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
    lis.push(
      li(
        { class: `page-item` },
        a({ class: "page-link", href: get_page_link(pages) }, pages)
      )
    );
  }
  return ul({ class: "pagination" }, lis);
};

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
              get_page_link: is.fun()
            })
          )
        })
      )
    ],
    is.str
  ),
  (hdrs, vs, opts = {}) =>
    div(
      { class: "table-responsive" },
      table(
        { class: "table table-sm" },
        thead(tr(hdrs.map(hdr => headerCell(hdr)))),
        tbody(
          (vs || []).map(v =>
            tr(
              mkClickHandler(opts, v),
              hdrs.map(hdr =>
                td(typeof hdr.key === "string" ? text(v[hdr.key]) : hdr.key(v))
              )
            )
          )
        )
      ),
      opts.pagination && pagination(opts.pagination)
    )
);

const mkClickHandler = (opts, v) =>
  !opts.onRowSelect
    ? {}
    : {
        onclick:
          typeof opts.onRowSelect === "function"
            ? opts.onRowSelect(v)
            : opts.onRowSelect
      };

module.exports = mkTable;
