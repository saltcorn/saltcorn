/**
 * @category saltcorn-sbadmin2
 * @module saltcorn-sbadmin2/index
 */

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
  form,
  input,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");
const { renderForm, link } = require("@saltcorn/markup");
const {
  alert,
  headersInHead,
  headersInBody,
} = require("@saltcorn/markup/layout_utils");
const db = require("@saltcorn/data/db");

/**
 * @param {string} currentUrl
 * @returns {function}
 */
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

/**
 * @param {object} item
 * @returns {string}
 */
const labelToId = (item) => text(item.label.replace(" ", ""));

/**
 * @param {object} x
 * @param {object} s
 * @returns {object}
 */
const logit = (x, s) => {
  if (s) console.log(s, x);
  else console.log(x);
  return x;
};

/**
 * @param {string} currentUrl
 * @param {object} item
 * @returns {boolean}
 */
const active = (currentUrl, item) =>
  (item.link && currentUrl.startsWith(item.link)) ||
  (item.altlinks && item.altlinks.some((l) => currentUrl.startsWith(l))) ||
  (item.subitems &&
    item.subitems.some(
      (si) =>
        (si.link && currentUrl.startsWith(si.link)) ||
        (si.altlinks && si.altlinks.some((l) => currentUrl.startsWith(l)))
    ));

/**
 * @param {string} currentUrl
 * @returns {function}
 */
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
              "data-bs-toggle": "collapse",
              "data-bs-target": `#collapse${labelToId(item)}`,
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
      : item.type === "Search"
      ? form(
          { action: "/search", class: "menusearch ms-2 me-3", method: "get" },
          div(
            { class: "input-group search-bar" },

            input({
              type: "search",
              class: "form-control search-bar pl-2p5",
              placeholder: item.label,
              id: "inputq",
              name: "q",
              "aria-label": "Search",
              "aria-describedby": "button-search-submit",
            }),

            button(
              {
                class: "btn btn-outline-secondary search-bar",
                type: "submit",
              },
              i({ class: "fas fa-search" })
            )
          )
        )
      : span({ class: "nav-link" }, text(item.label))
  );
};

/**
 * @param {string} currentUrl
 * @returns {function}
 */
const sideBarSection = (currentUrl) => (section) =>
  [
    section.section &&
      hr({ class: "sidebar-divider" }) +
        div({ class: "sidebar-heading" }, section.section),
    section.items.map(sideBarItem(currentUrl)).join(""),
  ];

/**
 * @param {object} brand
 * @param {string[]} sections
 * @param {string} currentUrl
 * @returns {ul}
 */
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

/**
 * @namespace
 * @category saltcorn-sbadmin2
 */
const blockDispatch = {
  /**
   *
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} opts.blurb
   * @returns {div}
   */
  pageHeader: ({ title, blurb }) =>
    div(
      h1({ class: "h3 mb-0 mt-2 text-gray-800" }, title),
      blurb && p({ class: "mb-0 text-gray-800" }, blurb)
    ),
  /**
   * @param {object} opts
   * @param {string} opts.contents
   * @returns {div}
   */
  footer: ({ contents }) =>
    div(
      { class: "container" },
      footer(
        { id: "footer" },
        div({ class: "row" }, div({ class: "col-sm-12" }, contents))
      )
    ),
  /**
   * @param {object} opts
   * @param {string} opts.caption
   * @param {string} opts.blurb
   * @returns {header}
   */
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
            h1({ class: "text-uppercase fw-bold" }, caption),
            hr({ class: "divider my-4" })
          ),
          div(
            { class: "col-lg-8 align-self-baseline" },
            p({ class: "fw-light mb-5" }, blurb)
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

/**
 * @param {string} title
 * @param {string|object} body
 * @param {*} role
 * @returns {string}
 */
const renderBody = (title, body, role) =>
  renderLayout({
    blockDispatch,
    role,
    layout:
      typeof body === "string" ? { type: "card", title, contents: body } : body,
  });

/**
 * @param {object} authLinks
 * @returns {hr|a}
 */
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

/**
 * @param {Form} form
 * @returns {Form}
 */
const formModify = (form) => {
  form.formStyle = "vert";
  form.submitButtonClass = "btn-primary btn-user btn-block";
  return form;
};

const allCssLink = db.is_node
  ? `<link rel="stylesheet" href="/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.0/vendor/fontawesome-free/css/all.min.css">`
  : `<link rel="stylesheet" href="plugin_sources/all.min.css">`;
const sbadmin2CssLink = db.is_node
  ? `<link rel="stylesheet" href="/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.0/css/sb-admin-2.css">`
  : `<link rel="stylesheet" href="plugin_sources/sb-admin-2.css">`;
const jqueryScript = db.is_node
  ? `<script src="/static_assets/${db.connectObj.version_tag}/jquery-3.6.0.min.js"></script>`
  : `<script src="public/jquery-3.6.0.min.js"></script>`;
const bootstrapScript = db.is_node
  ? `<script src="/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.0/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>`
  : `<script src="plugin_sources/bootstrap.bundle.min.js"></script>`;
const jqueryEasingScript = db.is_node
  ? `<script src="/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.0/vendor/jquery-easing/jquery.easing.min.js"></script>`
  : `<script src="plugin_sources/jquery.easing.min.js"></script>`;
const sbadmin2JsLink = db.is_node
  ? `<script src="/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.0/js/sb-admin-2.min.js"></script>`
  : `<script src="plugin_sources/sb-admin-2.min.js"></script>`;

/**
 * @param {*} headers
 * @param {string} title
 * @param {string} bodyAttr
 * @param {string} rest
 * @returns {string}
 */
const wrapIt = (headers, title, bodyAttr, rest) =>
  `<!doctype html>
  <html lang="en">
  <head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    ${allCssLink}
    <link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">

    <!-- Custom styles for this template-->
    ${sbadmin2CssLink}
    ${headersInHead(headers)}
    <title>${text(title)}</title>
  </head>
  <body ${bodyAttr}>
    ${rest}
    ${jqueryScript}
            ${bootstrapScript}
            ${jqueryEasingScript}
            ${sbadmin2JsLink}
    ${headersInBody(headers)}
    </body>
  </html>`;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {object[]} opts.alerts
 * @param {object} opts.form
 * @param {string} opts.afterForm
 * @param {*} opts.headers
 * @param {string} opts.csrfToken
 * @param {object} opts.authLinks
 * @returns {string}
 */
const authWrap = ({
  title,
  alerts,
  form,
  afterForm,
  headers,
  csrfToken,
  authLinks,
  bodyClass,
}) =>
  wrapIt(
    headers,
    title,
    `class="bg-gradient-primary ${bodyClass || ""}"`,
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

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {menu} opts.menu
 * @param {object} opts.brand
 * @param {object[]} opts.alerts
 * @param {string} opts.currentUrl
 * @param {string|object} opts.body
 * @param {*} opts.headers
 * @param {*} opts.role
 * @returns {string}
 */
const wrap = ({
  title,
  menu,
  brand,
  alerts,
  currentUrl,
  body,
  headers,
  role,
  bodyClass,
}) =>
  wrapIt(
    headers,
    title,
    `id="page-top" class="${bodyClass || ""}"`,
    `<div id="wrapper">
      ${db.is_node ? sidebar(brand, menu, currentUrl) : ""}

      <div id="content-wrapper" class="d-flex flex-column">
        <div id="content">
          <div id="page-inner-content" class="container-fluid px-2">
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

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {object[]} opts.alerts
 * @param {*} opts.role
 * @returns {string}
 */
const exportRenderBody = ({ title, body, alerts, role }) =>
  `<div id="alerts-area">
    ${alerts.map((a) => alert(a.type, a.msg)).join("")}
  </div>
  <div >
    ${renderBody(title, body, role)}
  <div>`;

module.exports = {
  /** @type {number} */
  sc_plugin_api_version: 1,
  /** @type {object} */
  serve_dependencies: {
    "startbootstrap-sb-admin-2-bs5": require.resolve(
      "startbootstrap-sb-admin-2-bs5/package.json"
    ),
  },
  /** @type {object} */
  layout: {
    wrap,
    authWrap,
    renderBody: exportRenderBody,
  },
};
