/**
 * @category saltcorn-markup
 * @module layout_utils
 */

import tags = require("./tags");
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
  form,
  h2,
  input,
} = tags;

declare const window: any;
const isNode = typeof window === "undefined";

/**
 * @param {string} item
 * @returns {string}
 */
const labelToId = (item: string): string => text(item.replace(" ", ""));

/**
 * @param {string} currentUrl
 * @param {object} item
 * @returns {boolean}
 */
const active = (currentUrl: string, item: any): boolean =>
  (item.link && currentUrl.startsWith(item.link)) ||
  (item.subitems &&
    item.subitems.some((si: any) => si.link && currentUrl.startsWith(si.link)));

/**
 * @param {object[]} [sections]
 * @returns {object[]}
 */
const innerSections = (sections?: any[]) => {
  var items = new Array<any>();
  (sections || []).forEach((section) => {
    (section.items || []).forEach((item: any) => {
      items.push(item);
    });
  });
  return items;
};

type NavSubItemsOpts = {
  label: string;
  subitems: any[];
  icon?: string;
  isUser: boolean;
};

/**
 * @param {object} opts
 * @param {string} opts.label
 * @param {object[]} opts.subitems
 * @param {string} [opts.icon]
 * @param {boolean} opts.isUser
 * @returns {li}
 */
const navSubitems = ({
  label,
  subitems,
  icon,
  isUser,
}: NavSubItemsOpts): string =>
  li(
    { class: "nav-item dropdown" },
    a(
      {
        class: ["nav-link dropdown-toggle", isUser && "user-nav-section"],
        href: "#",
        id: `dropdown${labelToId(label)}`,
        role: "button",
        "data-bs-toggle": "dropdown",
        "aria-haspopup": "true",
        "aria-expanded": "false",
      },
      icon ? i({ class: `fa-fw mr-05 ${icon}` }) : "",
      label
    ),
    div(
      {
        class: ["dropdown-menu", isUser && "dropdown-menu-end"],
        "aria-labelledby": `dropdown${labelToId(label)}`,
      },
      subitems.map((si) =>
        si?.type === "Separator"
          ? hr({ class: "mx-3 my-1" })
          : a(
              {
                class: ["dropdown-item", si.style || "", si.class],
                href: si.link,
              },
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
const rightNavBar = (currentUrl: string, sections: any[]): string =>
  div(
    { class: "collapse navbar-collapse", id: "navbarResponsive" },
    ul(
      { class: "navbar-nav ms-auto my-2 my-lg-0" },

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
          : s.type === "Separator"
          ? div({ class: "border-start", style: "width:1px" })
          : s.type === "Search"
          ? li(
              form(
                {
                  action: "/search",
                  class: "menusearch",
                  method: "get",
                },
                div(
                  { class: "input-group search-bar" },

                  input({
                    type: "search",
                    class: "form-control search-bar ps-2 hasbl",
                    placeholder: s.label,
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
            )
          : ""
      )
    )
  );

/**
 * @param {object[]} sections
 * @returns {boolean}
 */
const hasMobileItems = (sections: any[]): boolean =>
  innerSections(sections).some((s) => s.location === "Mobile Bottom");

/**
 * @param {string} currentUrl
 * @param {object[]} sections
 * @param {string} [cls = ""]
 * @param {string} [clsLink = ""]
 * @returns {footer|string}
 */
const mobileBottomNavBar = (
  currentUrl: string,
  sections: any[],
  cls: string = "",
  clsLink: string = ""
): string =>
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

type LeftNavBarOpts = {
  name: string;
  logo: string;
};

/**
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} opts.logo
 * @returns {string[]}
 */
const leftNavBar = ({ name, logo }: LeftNavBarOpts): string[] => [
  a(
    {
      class: "navbar-brand js-scroll-trigger",
      href: isNode ? "/" : "javascript:parent.gotoEntryView()",
    },
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
      "data-bs-toggle": "collapse",
      "data-bs-target": "#navbarResponsive",
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
const navbar = (
  brand: LeftNavBarOpts,
  sections: any[],
  currentUrl: string,
  opts: any = { fixedTop: true }
): string =>
  nav(
    {
      class: `navbar d-print-none navbar-expand-md ${opts.class || ""} ${
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
const alert = (type: string, s: string): string => {
  //console.log("alert", type, s,s.length)
  const realtype = type === "error" ? "danger" : type;
  const icon =
    realtype === "success"
      ? "fa-check-circle"
      : realtype === "danger"
      ? "fa-times-circle"
      : realtype === "warning"
      ? "fa-exclamation-triangle"
      : "";
  return s && s.length > 0
    ? `<div class="alert alert-${realtype} alert-dismissible fade show" role="alert">
        <i class="fas ${icon} me-1"></i>${text(s)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close">
        </button>
      </div>`
    : "";
};

/**
 * @type {string}
 */
const navbarSolidOnScroll: string = script(
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
const logit = (x: any, s: any): any => {
  if (s) console.log(s, x);
  else console.log(x);
  return x;
};

/**
 * @param {number} len
 * @returns {function}
 */
const standardBreadcrumbItem =
  (len: number) =>
  (
    {
      href,
      text,
      postLinkText,
    }: { href?: string; text: string; postLinkText?: string },
    ix: number
  ): string =>
    li(
      {
        class: ["breadcrumb-item", ix == len - 1 && "active"],
        "aria-current": ix == len - 1 && "page",
      },
      href ? a({ href }, text) : text,
      postLinkText ? "&nbsp;" + postLinkText : ""
    );

/**
 * @param {object} opts
 * @param {Workflow} opts.workflow
 * @param {object} opts.step
 * @returns {string}
 */
const workflowBreadcrumbItem = ({
  workflow,
  step,
}: {
  workflow: any;
  step: any;
}): string =>
  workflow.steps
    .map((wfstep: any, ix: number) =>
      li(
        {
          class: [
            "breadcrumb-item breadcrumb-workflow",
            step.currentStep - 1 === ix && "active-step fw-bold",
          ],
        },
        workflow.startAtStepURL &&
          workflow.saveURL &&
          step.currentStep - 1 !== ix
          ? a(
              {
                href: `javascript:applyViewConfig($('form.form-namespace,form#scbuildform'), '${
                  workflow.saveURL
                }',()=>{location.href='${workflow.startAtStepURL(
                  wfstep.name
                )}'})`,
              },
              wfstep.name
            )
          : span(wfstep.name)
      )
    )
    .join("");

/**
 * @param {object[]} crumbs
 * @returns {string}
 */
const breadcrumbs = (crumbs: any[], right: any, after: any): string =>
  nav(
    { "aria-label": "breadcrumb" },
    ol(
      { class: "breadcrumb" },
      crumbs.map((c: any, ix: number) =>
        c.workflow
          ? workflowBreadcrumbItem(c)
          : standardBreadcrumbItem(crumbs.length)(c, ix)
      ),
      after ? li({ class: "ms-3" }, after) : "",
      right ? li({ class: "ms-auto" }, right) : ""
    )
  );

/**
 * @param {object[]} headers
 * @returns {string}
 */
const headersInHead = (headers: any[]): string =>
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
const headersInBody = (headers: any[]): string =>
  headers
    .filter((h) => h.script)
    .map(
      (h) =>
        `<script ${h.defer ? "defer " : ""}src="${h.script}" ${
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
const cardHeaderTabs = (tabList: any): string =>
  ul(
    { class: "nav nav-tabs card-header-tabs" },
    tabList.map(
      ({
        href,
        label,
        active,
      }: {
        href: string;
        label: string;
        active: boolean;
      }): string =>
        li(
          { class: "nav-item" },
          a({ class: ["nav-link", active && "active"], href }, label)
        )
    )
  );

// declaration merging
namespace LayoutExports {
  export type RenderTabsOpts = {
    contents: any[];
    titles: string[];
    tabsStyle: string;
    ntabs?: any;
    deeplink?: boolean;
    bodyClass?: string;
    outerClass?: string;
    independent: boolean;
    startClosed?: boolean;
  };
}
type RenderTabsOpts = LayoutExports.RenderTabsOpts;

function validID(s: string) {
  return s
    ? s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^[^a-z]+|[^\w:.-]+/gi, "")
    : s;
}

/**
 * @param {object} opts
 * @param {object[]} opts.contents
 * @param {string[]} opts.titles
 * @param {string} opts.tabsStyle
 * @param {*} opts.ntabs
 * @param {independent} boolean
 * @param {function} go
 * @returns {ul_div}
 */
const renderTabs = (
  {
    contents,
    titles,
    tabsStyle,
    ntabs,
    independent,
    bodyClass,
    outerClass,
    deeplink,
    startClosed,
  }: RenderTabsOpts,
  go: (segment: any, isTop: boolean, ix: number) => any
) => {
  const rndid = `tab${Math.floor(Math.random() * 16777215).toString(16)}`;
  if (tabsStyle === "Accordion")
    return div(
      { class: ["accordion", outerClass], id: `${rndid}top` },
      contents.map((t, ix) =>
        div(
          { class: "accordion-item" },

          h2(
            { class: "accordion-header", id: `${rndid}head${ix}` },
            button(
              {
                class: [
                  "accordion-button",
                  (ix > 0 || startClosed) && "collapsed",
                ],
                type: "button",
                "data-bs-toggle": "collapse",
                "data-bs-target": `#${rndid}tab${ix}`,
                "aria-expanded": ix === 0 ? "true" : "false",
                "aria-controls": `${rndid}tab${ix}`,
              },
              titles[ix]
            )
          ),

          div(
            {
              class: [
                "accordion-collapse",
                "collapse",
                !startClosed && ix === 0 && "show",
              ],
              id: `${rndid}tab${ix}`,
              "aria-labelledby": `${rndid}head${ix}`,
              "data-parent": independent ? undefined : `#${rndid}top`,
            },
            div(
              { class: ["accordion-body", bodyClass || ""] },
              go(t, false, ix)
            )
          )
        )
      )
    );
  else
    return (
      ul(
        {
          role: "tablist",
          id: `${rndid}`,
          class: `nav ${tabsStyle === "Tabs" ? "nav-tabs" : "nav-pills"}`,
        },
        contents.map((t, ix) =>
          li(
            { class: "nav-item", role: "presentation" },
            a(
              {
                class: [
                  "nav-link",
                  ix === 0 && "active",
                  deeplink && "deeplink",
                ],
                id: `${rndid}link${ix}`,
                "data-bs-toggle": "tab",
                href: `#${validID(titles[ix])}`,
                role: "tab",
                "aria-controls": `${rndid}tab${ix}`,
                "aria-selected": ix === 0 ? "true" : "false",
              },
              titles[ix]
            )
          )
        )
      ) +
      div(
        { class: "tab-content", id: `${rndid}content` },
        contents.map((t, ix) =>
          div(
            {
              class: [
                "tab-pane fade",
                bodyClass || "",
                ix === 0 && "show active",
              ],
              role: "tabpanel",
              id: `${validID(titles[ix])}`,
              "aria-labelledby": `${rndid}link${ix}`,
            },
            go(t, false, ix)
          )
        )
      )
    );
};

export = {
  navbar,
  alert,
  logit,
  navbarSolidOnScroll,
  breadcrumbs,
  headersInHead,
  headersInBody,
  cardHeaderTabs,
  mobileBottomNavBar,
  renderTabs,
};
