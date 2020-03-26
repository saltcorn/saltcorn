const renderForm = require("./form");
const { a, td, tr, th, text } = require("./tags");

const mkTable = (hdrs, vs) => {
  var s =
    '<div class="table-responsive"><table class="table table-sm"><thead><tr>';
  hdrs.forEach(hdr => {
    s += th(text(hdr.label));
  });
  s += "</tr></thead><tbody>";
  (vs || []).forEach(v => {
    const tds = hdrs.map(hdr =>
      td(typeof hdr.key === "string" ? text(v[hdr.key]) : hdr.key(v))
    );

    s += tr(tds);
  });
  s += "</tbody></table></div>";
  return s;
};

const link = (href, s) => a({ href: text(href) }, text(s));

const post_btn = (href, s) => `<form action="${text(href)}" method="post">
<button type="submit" class="btn btn-primary">${text(s)}</button></form>`;

module.exports = {
  mkTable,
  renderForm,
  link,
  post_btn
};
