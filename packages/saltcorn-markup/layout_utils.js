/**
 * @category saltcorn-markup
 * @module layout_utils
 */

const {
  ul,
  li,
  ol,
  a,
  span,
  hr,
  div,
  text,
  img,
  button,
  nav,
  script,
  domReady,
  footer,
  i,
  small,
  br,
} = require("./tags");

/**
 * @param {string} item 
 * @returns {string}
 */
const labelToId = (item) => text(item.replace(" ", ""));

/**
 * @param {string} currentUrl 
 * @param {object} item 
 * @returns {boolean}
 */
const active = (currentUrl, item) =>
  (item.link && currentUrl.startsWith(item.link)) ||
  (item.subitems &&
    item.subitems.some((si) => si.link && currentUrl.startsWith(si.link)));

/**
 * @param {object[]} sections 
 * @returns {object[]}
 */
const innerSections = (sections) => {
  var items = [];
  (sections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      items.push(item);
    });
  });
  return items;
};

/**
 * @param {object} opts
 * @param {string} opts.label
 * @param {object[]} opts.subitems
 * @param {string} [opts.icon]
 * @returns {li}
 */
const navSubitems = ({ label, subitems, icon }) =>
  li(
    { class: "nav-item dropdown" },
    a(
      {
        class: "nav-link dropdown-toggle",
        href: "#",
        id: `dropdown${labelToId(label)}`,
        role: "button",
        "data-toggle": "dropdown",
        "aria-haspopup": "true",
        "aria-expanded": "false",
      },
      icon ? i({ class: `fa-fw mr-05 ${icon}` }) : "",
      label
    ),
    div(
      {
        class: "dropdown-menu",
        "aria-labelledby": `dropdown${labelToId(label)}`,
      },
      subitems.map((si) =>
        a(
          { class: ["dropdown-item", si.style || ""], href: si.link },
          si.icon ? i({ class: `fa-fw mr-05 ${si.icon}` }) : "",
          si.label
        )
      )
    )
  );

/**
 * @param {string} currentUrl 
 * @param {object[]} sections 
 * @returns {div}
 */
const rightNavBar = (currentUrl, sections) =>
  div(
    { class: "collapse navbar-collapse", id: "navbarResponsive" },
    ul(
      { class: "navbar-nav ml-auto my-2 my-lg-0" },

      innerSections(sections).map((s) =>
        s.location === "Mobile Bottom"
          ? ""
          : s.subitems
          ? navSubitems(s)
          : s.link
          ? li(
              {
                class: ["nav-item", active(currentUrl, s) && "active"],
              },
              a(
                {
                  class: ["nav-link js-scroll-trigger", s.style || ""],
                  href: text(s.link),
                },
                s.icon ? i({ class: `fa-fw mr-05 ${s.icon}` }) : "",
                text(s.label)
              )
            )
          : ""
      )
    )
  );

  /**
   * @param {object[]} sections 
   * @returns {boolean}
   */
const hasMobileItems = (sections) =>
  innerSections(sections).some((s) => s.location === "Mobile Bottom");

/**
 * @param {string} currentUrl 
 * @param {object[]} sections 
 * @param {string} [cls = ""]
 * @param {string} [clsLink = ""]
 * @returns {footer|string}
 */
const mobileBottomNavBar = (currentUrl, sections, cls = "", clsLink = "") =>
  hasMobileItems(sections)
    ? footer(
        {
          class:
            "bs-mobile-nav-footer d-flex justify-content-around d-sm-flex d-md-none " +
            cls,
        },
        innerSections(sections).map((s) =>
          s.location !== "Mobile Bottom"
            ? ""
            : //: s.subitems
            //? navSubitems(s)
            s.link
            ? div(
                {
                  class: [
                    "mt-2 text-center",
                    active(currentUrl, s) ? "active" : "opacity-50",
                  ],
                },
                a(
                  {
                    class: [s.style || "", clsLink],
                    href: text(s.link),
                  },
                  s.icon ? i({ class: `fa-lg ${s.icon}` }) : "",
                  br(),
                  small(text(s.label))
                )
              )
            : ""
        )
      )
    : "";

/**
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} opts.logo
 * @returns {string[]}
 */
const leftNavBar = ({ name, logo }) => [
  a(
    { class: "navbar-brand js-scroll-trigger", href: "/" },
    logo &&
      img({
        src: logo,
        width: "30",
        height: "30",
        class: "mx-1 d-inline-block align-top",
        alt: "Logo",
        loading: "lazy",
      }),
    name
  ),
  button(
    {
      class: "navbar-toggler navbar-toggler-right",
      type: "button",
      "data-toggle": "collapse",
      "data-target": "#navbarResponsive",
      "aria-controls": "navbarResponsive",
      "aria-expanded": "false",
      "aria-label": "Toggle navigation",
    },
    span({ class: "navbar-toggler-icon" })
  ),
];

/**
 * @param {object} brand 
 * @param {object[]} sections 
 * @param {string} currentUrl 
 * @param {object} opts
 * @param {boolean} [opts.fixedTop = true]
 * @returns {string}
 */
const navbar = (brand, sections, currentUrl, opts = { fixedTop: true }) =>
  nav(
    {
      class: `navbar navbar-expand-lg ${opts.class || ""} ${
        opts.colorscheme ? opts.colorscheme.toLowerCase() : "navbar-light"
      } ${opts.fixedTop ? "fixed-top" : ""}`,
      id: "mainNav",
    },
    div(
      { class: opts.fluid ? "container-fluid" : "container" },
      leftNavBar(brand),
      rightNavBar(currentUrl, sections)
    )
  );

/**
 * @param {string} type 
 * @param {string} s 
 * @returns {string}
 */
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

/**
 * @returns {string}
 */
const navbarSolidOnScroll = script(
  domReady(`$(window).scroll(function () {
    if ($(window).scrollTop() >= 10) {
    $('.navbar').css('background','white');
    } else {
    $('.navbar').css('background','transparent');
    }
    });`)
);

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
 * @param {number} len 
 * @returns {function}
 */
const standardBreadcrumbItem = (len) => ({ href, text }, ix) =>
  li(
    {
      class: ["breadcrumb-item", ix == len - 1 && "active"],
      "aria-current": ix == len - 1 && "page",
    },
    href ? a({ href }, text) : text
  );

/**
 * @param {object} opts
 * @param {Workflow} opts.workflow
 * @param {object} opts.step
 * @returns {string}
 */
const workflowBreadcrumbItem = ({ workflow, step }) =>
  workflow.steps
    .map((wfstep, ix) =>
      li(
        {
          class: [
            "breadcrumb-item breadcrumb-workflow",
            step.currentStep - 1 === ix && "active-step font-weight-bold",
          ],
        },
        span(wfstep.name)
      )
    )
    .join("");

/**
 * @param {object[]} crumbs 
 * @returns {string}
 */
const breadcrumbs = (crumbs) =>
  nav(
    { "aria-label": "breadcrumb" },
    ol(
      { class: "breadcrumb" },
      crumbs.map((c) =>
        c.workflow
          ? workflowBreadcrumbItem(c)
          : standardBreadcrumbItem(crumbs.length)(c)
      )
    )
  );

/**
 * @param {object[]} headers 
 * @returns {string}
 */
const headersInHead = (headers) =>
  headers
    .filter((h) => h.css)
    .map((h) => `<link href="${h.css}" rel="stylesheet">`)
    .join("") +
  headers
    .filter((h) => h.style)
    .map((h) => `<style>${h.style}</style>`)
    .join("") +
  headers
    .filter((h) => h.headerTag)
    .map((h) => h.headerTag)
    .join("");

/**
 * @param {object[]} headers 
 * @returns {string}
 */
const headersInBody = (headers) =>
  headers
    .filter((h) => h.script)
    .map(
      (h) =>
        `<script src="${h.script}" ${
          h.integrity
            ? `integrity="${h.integrity}" crossorigin="anonymous"`
            : ""
        }></script>`
    )
    .join("") +
  headers
    .filter((h) => h.scriptBody)
    .map((h) => `<script>${h.scriptBody}</script>`)
    .join("");

/**
 * @param {object[]} tabList 
 * @returns {ul}
 */
const cardHeaderTabs = (tabList) =>
  ul(
    { class: "nav nav-tabs card-header-tabs" },
    tabList.map(({ href, label, active }) =>
      li(
        { class: "nav-item" },
        a({ class: ["nav-link", active && "active"], href }, label)
      )
    )
  );

module.exports = {
  navbar,
  alert,
  logit,
  navbarSolidOnScroll,
  breadcrumbs,
  headersInHead,
  headersInBody,
  cardHeaderTabs,
  mobileBottomNavBar,
};
