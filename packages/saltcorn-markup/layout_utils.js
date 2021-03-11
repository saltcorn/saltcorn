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
  i,
} = require("./tags");

const labelToId = (item) => text(item.replace(" ", ""));

const active = (currentUrl, item) =>
  (item.link && currentUrl.startsWith(item.link)) ||
  (item.subitems &&
    item.subitems.some((si) => si.link && currentUrl.startsWith(si.link)));

const innerSections = (sections) => {
  var items = [];
  (sections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      items.push(item);
    });
  });
  return items;
};

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
const rightNavBar = (currentUrl, sections) =>
  div(
    { class: "collapse navbar-collapse", id: "navbarResponsive" },
    ul(
      { class: "navbar-nav ml-auto my-2 my-lg-0" },

      innerSections(sections).map((s) =>
        s.subitems
          ? navSubitems(s)
          : s.link
          ? li(
              { class: ["nav-item", active(currentUrl, s) && "active"] },
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

const navbar = (brand, sections, currentUrl, opts = { fixedTop: true }) =>
  nav(
    {
      class: `navbar navbar-expand-lg ${
        opts.colorscheme ? opts.colorscheme.toLowerCase() : "navbar-light"
      } ${opts.fixedTop ? "fixed-top" : ""}`,
      id: "mainNav",
    },
    div(
      { class: "container" },
      leftNavBar(brand),
      rightNavBar(currentUrl, sections)
    )
  );

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
const navbarSolidOnScroll = script(
  domReady(`$(window).scroll(function () {
    if ($(window).scrollTop() >= 10) {
    $('.navbar').css('background','white');
    } else {
    $('.navbar').css('background','transparent');
    }
    });`)
);

const logit = (x, s) => {
  if (s) console.log(s, x);
  else console.log(x);
  return x;
};

const standardBreadcrumbItem = (len) => ({ href, text }, ix) =>
  li(
    {
      class: ["breadcrumb-item", ix == len - 1 && "active"],
      "aria-current": ix == len - 1 && "page",
    },
    href ? a({ href }, text) : text
  );

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
};
