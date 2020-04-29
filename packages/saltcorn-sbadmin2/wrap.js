const { ul, li, a, span, hr, div, text } = require("saltcorn-markup/tags");

const sideBarItem = item =>
  li(
    { class: "nav-item" },
    item.link
      ? a({ class: "nav-link", href: text(item.link) }, span(text(item.label)))
      : span({ class: "nav-link" }, text(item.label))
  );

const sideBarSection = section => [
  section.section &&
    hr({ class: "sidebar-divider" }) +
      div({ class: "sidebar-heading" }, section.section),
  section.items.map(sideBarItem).join("")
];

const sidebar = sections =>
  ul(
    {
      class: "navbar-nav bg-gradient-primary sidebar sidebar-dark accordion",
      id: "accordionSidebar"
    },
    sections.map(sideBarSection)
  );

const wrap = ({ title, menu, alerts, body, headers }) => `<!doctype html>
<html lang="en">
  <head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    <link href="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.0.7/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">
  
    <!-- Custom styles for this template-->
    <link href="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.0.7/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="/saltcorn.css" rel="stylesheet">
    ${headers
      .filter(h => h.css)
      .map(h => `<link href="${h.css}" rel="stylesheet">`)
      .join("")}
    <title>${text(title)}</title>
  </head>
  <body id="page-top">
    <div id="wrapper">
      ${sidebar(menu)}

      <div id="content-wrapper" class="d-flex flex-column">
        <div id="content">
          <div class="container-fluid">
            ${alerts.map(a => alert(a.type, a.msg)).join("")}
            <div class="card shadow mb-4 mt-4">
              <div class="card-header py-3">
                <h6 class="m-0 font-weight-bold text-primary">${text(
                  title
                )}</h6>
              </div>
              <div class="card-body">
                ${body}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Optional JavaScript -->
    <!-- jQuery first, then Popper.js, then Bootstrap JS -->
    <script src="https://code.jquery.com/jquery-3.5.0.min.js" integrity="sha256-xNzN2a4ltkB44Mc/Jz3pT4iU1cmeR0FkXs4pru/JxaQ=" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.0.7/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>

    <!-- Core plugin JavaScript-->
    <script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.0.7/vendor/jquery-easing/jquery.easing.min.js"></script>
  
    <!-- Custom scripts for all pages-->
    <script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.0.7/js/sb-admin-2.min.js"></script>
    <script src="/saltcorn.js"></script>
    ${headers
      .filter(h => h.script)
      .map(h => `<script src="${h.script}"></script>`)
      .join("")}
  </body>
</html>`;

const alert = (type, s) => {
  //console.log("alert", type, s,s.length)
  const realtype = type === "error" ? "danger" : type;
  return s && s.length > 0
    ? `<div class="alert alert-${realtype} alert-dismissible fade show" role="alert">
  ${text(s)}
  <button type="button" class="close" data-dismiss="alert" aria-label="Close">
    <span aria-hidden="true">&times;</span>
  </button>
</div>`
    : "";
};

module.exports = wrap;
