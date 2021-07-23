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
  header,
  img,
  footer,
  button,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");
const { renderForm, link } = require("@saltcorn/markup");
const {
  alert,
  headersInHead,
  headersInBody,
} = require("@saltcorn/markup/layout_utils");
const subItem = (currentUrl) => (item) =>
  item.link
    ? a(
        {
          class: ["collapse-item", active(currentUrl, item) && "active"],
          href: text(item.link),
        },
        item.icon ? i({ class: `fa-fw mr-05 ${item.icon}` }) : "",
        item.label
      )
    : h6({ class: "collapse-header" }, item.label);

const labelToId = (item) => text(item.label.replace(" ", ""));

const logit = (x, s) => {
  if (s) console.log(s, x);
  else console.log(x);
  return x;
};
const active = (currentUrl, item) =>
  (item.link && currentUrl.startsWith(item.link)) ||
  (item.altlinks && item.altlinks.some((l) => currentUrl.startsWith(l))) ||
  (item.subitems &&
    item.subitems.some(
      (si) =>
        (si.link && currentUrl.startsWith(si.link)) ||
        (si.altlinks && si.altlinks.some((l) => currentUrl.startsWith(l)))
    ));

const sideBarItem = (currentUrl) => (item) => {
  const is_active = active(currentUrl, item);
  return li(
    { class: ["nav-item", is_active && "active"] },
    item.subitems
      ? [
          a(
            {
              class: ["nav-link", !is_active && "collapsed"],
              href: "#",
              "data-toggle": "collapse",
              "data-target": `#collapse${labelToId(item)}`,
              "aria-expanded": "true",
              "aria-controls": `collapse${labelToId(item)}`,
            },
            item.icon ? i({ class: `fa-fw ${item.icon}` }) : "",
            span(text(item.label))
          ),
          div(
            {
              id: `collapse${labelToId(item)}`,
              class: ["collapse", is_active && "show"],
              "data-parent": "#accordionSidebar",
            },
            div(
              { class: "bg-white py-2 collapse-inner rounded" },
              item.subitems.map(subItem(currentUrl))
            )
          ),
        ]
      : item.link
      ? a(
          { class: "nav-link", href: text(item.link) },
          item.icon ? i({ class: `fa-fw ${item.icon}` }) : "",
          span(text(item.label))
        )
      : span({ class: "nav-link" }, text(item.label))
  );
};

const sideBarSection = (currentUrl) => (section) => [
  section.section &&
    hr({ class: "sidebar-divider" }) +
      div({ class: "sidebar-heading" }, section.section),
  section.items.map(sideBarItem(currentUrl)).join(""),
];

const sidebar = (brand, sections, currentUrl) =>
  ul(
    {
      class:
        "navbar-nav bg-gradient-primary sidebar sidebar-dark accordion d-print-none",
      id: "accordionSidebar",
    },
    a(
      {
        class: "sidebar-brand d-flex align-items-center justify-content-center",
        href: "/",
      },
      brand.logo &&
        div(
          { class: "sidebar-brand-icon" },
          img({ src: brand.logo, width: "35", height: "35", alt: "Logo" })
        ),
      div({ class: "sidebar-brand-text mx-3" }, brand.name)
    ),
    sections.map(sideBarSection(currentUrl)),
    hr({ class: "sidebar-divider d-none d-md-block" }),
    div(
      { class: "text-center d-none d-md-inline" },
      button({ class: "rounded-circle border-0", id: "sidebarToggle" })
    )
  );

const blockDispatch = {
  pageHeader: ({ title, blurb }) =>
    div(
      h1({ class: "h3 mb-0 mt-2 text-gray-800" }, title),
      blurb && p({ class: "mb-0 text-gray-800" }, blurb)
    ),
  footer: ({ contents }) =>
    div(
      { class: "container" },
      footer(
        { id: "footer" },
        div({ class: "row" }, div({ class: "col-sm-12" }, contents))
      )
    ),
  hero: ({ caption, blurb }) =>
    header(
      { class: "masthead" },
      div(
        { class: "container h-100" },
        div(
          {
            class:
              "row h-100 align-items-center justify-content-center text-center",
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
    ),
};
const renderBody = (title, body, role) =>
  renderLayout({
    blockDispatch,
    role,
    layout:
      typeof body === "string" ? { type: "card", title, contents: body } : body,
  });

const renderAuthLinks = (authLinks) => {
  var links = [];
  if (authLinks.login)
    links.push(link(authLinks.login, "Already have an account? Login!"));
  if (authLinks.forgot) links.push(link(authLinks.forgot, "Forgot password?"));
  if (authLinks.signup)
    links.push(link(authLinks.signup, "Create an account!"));
  const meth_links = (authLinks.methods || [])
    .map(({ url, icon, label }) =>
      a(
        { href: url, class: "btn btn-secondary btn-user btn-block" },
        icon || "",
        `&nbsp;Login with ${label}`
      )
    )
    .join("");
  if (links.length === 0) return hr() + meth_links;
  else
    return (
      hr() +
      (meth_links ? meth_links + hr() : "") +
      links.map((l) => div({ class: "text-center" }, l)).join("")
    );
};

const formModify = (form) => {
  form.formStyle = "vert";
  form.submitButtonClass = "btn-primary btn-user btn-block";
  return form;
};

const wrapIt = (headers, title, bodyAttr, rest) =>
  `<!doctype html>
  <html lang="en">
  <head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.3/vendor/fontawesome-free/css/all.min.css" integrity="sha256-rx5u3IdaOCszi7Jb18XD9HSn8bNiEgAqWJbdBvIYYyU=" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">

    <!-- Custom styles for this template-->
    <link rel="stylesheet" href="/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2/4.1.4/css/sb-admin-2.min.css">
    ${headersInHead(headers)}
    <title>${text(title)}</title>
  </head>
  <body ${bodyAttr}>
    ${rest}
    <script src="https://code.jquery.com/jquery-3.4.1.min.js" 
            integrity="sha256-CSXorXvZcTkaix6Yvo6HppcZGetbYMGWSFlBw8HfCJo=" 
            crossorigin="anonymous"></script>
            <script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.3/vendor/bootstrap/js/bootstrap.bundle.min.js" integrity="sha256-jXCJJT3KKcnNjZ3rfsabCj1EX4j2omR4xxm+H5CtywE=" crossorigin="anonymous"></script>
            <script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.3/vendor/jquery-easing/jquery.easing.min.js" integrity="sha256-H3cjtrm/ztDeuhCN9I4yh4iN2Ybx/y1RM7rMmAesA0k=" crossorigin="anonymous"></script>
            <script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin-2@4.1.3/js/sb-admin-2.min.js" integrity="sha256-r6sYyPtYgtQcqf6OI1p+jx79L02Y5MVHGW6llKY24sI=" crossorigin="anonymous"></script>
    ${headersInBody(headers)}
    </body>
  </html>`;

const authWrap = ({
  title,
  alerts,
  form,
  afterForm,
  headers,
  csrfToken,
  authLinks,
}) =>
  wrapIt(
    headers,
    title,
    'class="bg-gradient-primary"',
    `<div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-10 col-lg-12 col-md-9">
          <div class="card o-hidden border-0 shadow-lg my-5">
            <div class="card-body p-0">
              <div class="row">
                <div class="col">
                  <div class="p-5">
                    ${alerts.map((a) => alert(a.type, a.msg)).join("")}
                    <div class="text-center">
                      <h1 class="h4 text-gray-900 mb-4">${title}</h1>
                    </div>
                    ${renderForm(formModify(form), csrfToken)}
                    ${renderAuthLinks(authLinks)}
                    ${afterForm}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  );

const wrap = ({
  title,
  menu,
  brand,
  alerts,
  currentUrl,
  body,
  headers,
  role,
}) =>
  wrapIt(
    headers,
    title,
    'id="page-top"',
    `<div id="wrapper">
      ${sidebar(brand, menu, currentUrl)}

      <div id="content-wrapper" class="d-flex flex-column">
        <div id="content">
          <div id="page-inner-content" class="container-fluid">
            <div id="alerts-area">
              ${alerts.map((a) => alert(a.type, a.msg)).join("")}
            </div>
            <div >
              ${renderBody(title, body, role)}
            <div>
          </div>
        </div>
      </div>
    </div>`
  );
const exportRenderBody = ({ title, body, alerts, role }) =>
  `<div id="alerts-area">
    ${alerts.map((a) => alert(a.type, a.msg)).join("")}
  </div>
  <div >
    ${renderBody(title, body, role)}
  <div>`;

module.exports = {
  sc_plugin_api_version: 1,
  serve_dependencies: {
    "startbootstrap-sb-admin-2": require.resolve("startbootstrap-sb-admin-2/package.json"),
  },
  layout: {
    wrap,
    authWrap,
    renderBody: exportRenderBody,
  },
};
