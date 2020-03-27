const { a, td, tr, th, text, div, table, thead, tbody } = require("./tags");

const mkTable = (hdrs, vs, opts) =>
  div(
    { class: "table-responsive" },
    table(
      { class: "table table-sm" },
      thead(tr(hdrs.map(hdr => th(text(hdr.label))))),
      tbody(
        (vs || []).map(v =>
          tr(
            hdrs.map(hdr =>
              td(typeof hdr.key === "string" ? text(v[hdr.key]) : hdr.key(v))
            )
          )
        )
      )
    )
  );

module.exports = mkTable;
