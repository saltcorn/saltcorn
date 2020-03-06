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

const formRowWrap = (hdr, inner, error = "") => `<div class="form-group row">
    <label for="input${hdr.name}" class="col-sm-2 col-form-label">${hdr.label}</label>
    <div class="col-sm-10">
      ${inner}
      ${error}
    </div>
  </div>`;

const mkFormRow = (v, errors) => hdr => {
  const validClass = errors[hdr.name] ? "is-invalid" : "";
  const errorFeedback = errors[hdr.name]
    ? `<div class="invalid-feedback">${errors[hdr.name]}</div>`
    : "";
  switch (hdr.input_type) {
    case "fromtype":
      return formRowWrap(
        hdr,
        hdr.type.editAs(
          hdr.name,
          v && v[hdr.name] ? v[hdr.name] : undefined,
          validClass
        ),
        errorFeedback
      );
    case "hidden":
      return `<input type="hidden" class="form-control ${validClass}" name="${
        hdr.name
      }" ${v ? `value="${v[hdr.name]}"` : ""}>`;
    case "select":
      const opts = hdr.options
        .map(o => `<option value="${o}">${o}</option>`)
        .join("");
      return formRowWrap(
        hdr,
        `<select class="form-control ${validClass}" name="${
          hdr.name
        }" id="input${hdr.name}" ${
          v && v[hdr.name] ? `value="${v[hdr.name]}"` : ""
        }>${opts}</select>`,
        errorFeedback
      );
    case "ordered_multi_select":
      const mopts = hdr.options
        .map(o => `<option value="${o}">${o}</option>`)
        .join("");
      return formRowWrap(
        hdr,
        `<select class="form-control ${validClass}" class="chosen-select" multiple name="${
          hdr.name
        }" id="input${hdr.name}" ${
          v && v[hdr.name] ? `value="${v[hdr.name]}"` : ""
        }>${mopts}</select><script>$(function(){$("#input${
          hdr.name
        }").chosen()})</script>`,
        errorFeedback
      );

    default:
      return formRowWrap(
        hdr,
        `<input type="${hdr.input_type}" class="form-control" name="${
          hdr.name
        }" id="input${hdr.name}" ${
          v && v[hdr.name] ? `value="${v[hdr.name]}"` : ""
        }>`,
        errorFeedback
      );
  }
};
const mkHiddenFormFields = fldNms =>
  fldNms.map(fnm => ({ name: fnm, input_type: "hidden" }));

const renderForm = form =>
  mkForm(
    form.action,
    form.fields.map(f => f.to_formfield),
    form.values,
    form.submitLabel,
    form.errors
  );

const mkForm = (action, hdrs, v, submitLabel = "Save", errors = {}) => {
  const top = `<form action="${action}" method="post">`;
  //console.log(hdrs);
  const flds = hdrs.map(mkFormRow(v, errors)).join("");
  const bot = `<div class="form-group row">
  <div class="col-sm-10">
    <button type="submit" class="btn btn-primary">${submitLabel}</button>
  </div>
</div>
</form>`;
  return top + flds + bot;
};

const h = (sz, s) => `<h${sz}>${s}</h${sz}>`;
const ul = lis => `<ul>${lis.map(li => `<li>${li}</li>`).join("")}</ul>`;
const ul_nav = lis =>
  `<ul class="nav">${lis
    .map(
      li =>
        `<li class="nav-item"><a class="nav-link" href="${li[0]}">${li[1]}</a></li>`
    )
    .join("")}</ul>`;
const link = (href, s) => `<a href="${href}">${s}</a>`;
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
  mkForm,
  renderForm,
  wrap,
  h,
  ul,
  ul_nav,
  link,
  post_btn,
  mkHiddenFormFields,
  alert
};
