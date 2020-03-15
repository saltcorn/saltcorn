const renderForm = require("./form");
const { ul, li, a } = require("./tags");
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

const h = (sz, s) => `<h${sz}>${s}</h${sz}>`;
const ul_nav = lis =>
  ul(
    { class: "nav" },
    lis.map(item =>
      li(
        { class: "nav-item" },
        a({ class: "nav-link", href: item[0] }, item[1])
      )
    )
  );

const link = (href, s) => a({ href }, s);

const post_btn = (href, s) => `<form action="${href}" method="post">
<button type="submit" class="btn btn-primary">${s}</button></form>`;

const wrap = (title, ...s) => `<!doctype html>
<html lang="en">
  <head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chosen/1.8.7/chosen.min.css" crossorigin="anonymous">
    <title>${title}</title>
  </head>
  <body>
  <script src="https://code.jquery.com/jquery-3.4.1.slim.min.js" integrity="sha384-J6qa4849blE2+poT4WnyKhv5vZF5SrPo0iEjwBvKU7imGFAV0wwj1yYfoRSJoZ+n" crossorigin="anonymous"></script>

    <div class="container">${s.join("")}</div>

    <!-- Optional JavaScript -->
    <!-- jQuery first, then Popper.js, then Bootstrap JS -->
    <script src="https://code.jquery.com/jquery-3.4.1.slim.min.js" integrity="sha384-J6qa4849blE2+poT4WnyKhv5vZF5SrPo0iEjwBvKU7imGFAV0wwj1yYfoRSJoZ+n" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js" integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo" crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js" integrity="sha384-wfSDF2E50Y2D1uUdj0O3uMBJnjuUD4Ih7YwaYd1iqfktj0Uod8GCExl3Og8ifwB6" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/chosen/1.8.7/chosen.jquery.min.js" crossorigin="anonymous"></script>
  </body>
</html>`;

const alert = (type, s) => {
  //console.log("alert", type, s,s.length)
  const realtype = type === "error" ? "danger" : type;
  return s && s.length > 0
    ? `<div class="alert alert-${realtype} alert-dismissible fade show" role="alert">
  ${s}
  <button type="button" class="close" data-dismiss="alert" aria-label="Close">
    <span aria-hidden="true">&times;</span>
  </button>
</div>`
    : "";
};

module.exports = {
  mkTable,
  renderForm,
  wrap,
  h,
  ul,
  ul_nav,
  link,
  post_btn,
  alert
};
