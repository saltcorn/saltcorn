const {
  ul,
  li,
  a,
  span,
  hr,
  div,
  text,
  i,
  h6,
  h1,
  p,
  header
} = require("saltcorn-markup/tags");

const subItem = currentUrl => item =>
  item.link
    ? a(
        {
          class: ["collapse-item", active(currentUrl, item) && "active"],
          href: text(item.link)
        },
        item.label
      )
    : h6({ class: "collapse-header" }, item.label);

const labelToId = item => text(item.label.replace(" ", ""));

const logit = (x, s) => {
  if (s) console.log(s, x);
  else console.log(x);
  return x;
};
const active = (currentUrl, item) =>
  (item.link && currentUrl.startsWith(item.link)) ||
  (item.subitems &&
    item.subitems.some(si => si.link && currentUrl.startsWith(si.link)));

const sideBarItem = currentUrl => item => {
  const is_active = active(currentUrl, item);
  return li(
    { class: ["nav-item", is_active && "active"] },
    item.link
      ? a({ class: "nav-link", href: text(item.link) }, span(text(item.label)))
      : item.subitems
      ? [
          a(
            {
              class: ["nav-link", !is_active && "collapsed"],
              href: "#",
              "data-toggle": "collapse",
              "data-target": `#collapse${labelToId(item)}`,
              "aria-expanded": "true",
              "aria-controls": `collapse${labelToId(item)}`
            },
            //i({ class: "fas fa-fw fa-wrench" }),
            span(text(item.label))
          ),
          div(
            {
              id: `collapse${labelToId(item)}`,
              class: ["collapse", is_active && "show"],
              "data-parent": "#accordionSidebar"
            },
            div(
              { class: "bg-white py-2 collapse-inner rounded" },
              item.subitems.map(subItem(currentUrl))
            )
          )
        ]
      : span({ class: "nav-link" }, text(item.label))
  );
};

const sideBarSection = currentUrl => section =>
  section.brandName
    ? a(
        {
          class:
            "sidebar-brand d-flex align-items-center justify-content-center",
          href: "/"
        },
        //div({class:"sidebar-brand-icon rotate-n-15"},
        //i({class:"fas fa-laugh-wink"})),
        div({ class: "sidebar-brand-text mx-3" }, section.brandName)
      )
    : [
        section.section &&
          hr({ class: "sidebar-divider" }) +
            div({ class: "sidebar-heading" }, section.section),
        section.items.map(sideBarItem(currentUrl)).join("")
      ];

const sidebar = (sections, currentUrl) =>
  ul(
    {
      class: "navbar-nav bg-gradient-primary sidebar sidebar-dark accordion",
      id: "accordionSidebar"
    },
    sections.map(sideBarSection(currentUrl))
  );

const renderCard = (title, body) =>
  div(
    { class: "card shadow mt-4" },
    div(
      { class: "card-header py-3" },
      h6({ class: "m-0 font-weight-bold text-primary" }, text(title))
    ),
    div({ class: "card-body" }, Array.isArray(body) ? body.join("") : body)
  );

const renderHero = (caption, blurb) =>
  header(
    { class: "masthead" },
    div(
      { class: "container h-100" },
      div(
        {
          class:
            "row h-100 align-items-center justify-content-center text-center"
        },
        div(
          { class: "col-lg-10 align-self-end" },
          h1({ class: "text-uppercase font-weight-bold" }, caption),
          hr({ class: "divider my-4" })
        ),
        div(
          { class: "col-lg-8 align-self-baseline" },
          p({ class: "font-weight-light mb-5" }, blurb)
          /*a(
            {
              class: "btn btn-primary btn-xl",
              href: "#about"
            },
            "Find Out More"
          )*/
        )
      )
    )
  );

const renderContainer = ({ type, ...rest }) =>
  type === "card"
    ? renderCard(rest.title, rest.contents)
    : type === "hero"
    ? renderHero(rest.caption, rest.blurb)
    : "";

const renderBesides = elems => {
  const w = Math.round(12 / elems.length);
  const row = elems.map(e =>
    div(
      { class: `col-sm-${w}` },
      e.above ? renderAbove(e.above) : renderContainer(e)
    )
  );
  return div({ class: "row" }, row);
};

const renderAbove = elems =>
  elems
    .map(e => (e.besides ? renderBesides(e.besides) : renderContainer(e)))
    .join("");

const renderBody = (title, body) =>
  [
    body.pageHeader
      ? h1({ class: "h3 mb-0 mt-2 text-gray-800" }, body.pageHeader)
      : "",
    body.pageBlurb ? p({ class: "mb-0 text-gray-800" }, body.pageBlurb) : "",
    typeof body === "string"
      ? renderCard(title, body)
      : body.above
      ? renderAbove(body.above)
      : renderBesides(body.besides)
  ].join("");

const wrap = ({
  title,
  menu,
  alerts,
  currentUrl,
  body,
  headers
}) => `<!doctype html>
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
      ${sidebar(menu, currentUrl)}

      <div id="content-wrapper" class="d-flex flex-column">
        <div id="content">
          <div class="container-fluid">
            ${alerts.map(a => alert(a.type, a.msg)).join("")}
            ${renderBody(title, body)}
          </div>
        </div>
      </div>
    </div>
    <!-- Optional JavaScript -->
    <!-- jQuery first, then Popper.js, then Bootstrap JS -->
    <script src="https://code.jquery.com/jquery-3.4.1.min.js" 
            integrity="sha256-CSXorXvZcTkaix6Yvo6HppcZGetbYMGWSFlBw8HfCJo=" 
            crossorigin="anonymous"></script>
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
