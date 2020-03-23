const renderForm = require("./form");
const wrap = require("./wrap");
const { a } = require("./tags");

const mkTable = (hdrs, vs) => {
  var s = '<table class="table"><thead><tr>';
  hdrs.forEach(hdr => {
    s += `<th>${hdr.label}</th>`;
  });
  s += "</tr></thead><tbody>";
  (vs || []).forEach(v => {
    const tds = hdrs
      .map(
        hdr =>
          `<td>${typeof hdr.key === "string" ? v[hdr.key] : hdr.key(v)}</td>`
      )
      .join("");
    s += `<tr>${tds}</tr>`;
  });
  s += "</tbody></table>";
  return s;
};

const link = (href, s) => a({ href }, s);

const post_btn = (href, s) => `<form action="${href}" method="post">
<button type="submit" class="btn btn-primary">${s}</button></form>`;

module.exports = {
  mkTable,
  renderForm,
  wrap,
  link,
  post_btn
};
