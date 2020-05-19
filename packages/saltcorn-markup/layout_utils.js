const {
  ul,
  li,
  a,
  span,
  hr,
  div,
  text,

  button,
  nav,
  script,
  domReady
} = require("./tags");

const labelToId = item => text(item.replace(" ", ""));

const active = (currentUrl, item) =>
  (item.link && currentUrl.startsWith(item.link)) ||
  (item.subitems &&
    item.subitems.some(si => si.link && currentUrl.startsWith(si.link)));

const innerSections = sections => {
  var items = [];
  (sections || []).forEach(section => {
    (section.items || []).forEach(item => {
      items.push(item);
    });
  });
  return items;
};

const navSubitems = ({ label, subitems }) =>
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
        "aria-expanded": "false"
      },
      label
    ),
    div(
      {
        class: "dropdown-menu",
        "aria-labelledby": `dropdown${labelToId(label)}`
      },
      subitems.map(si => a({ class: "dropdown-item", href: si.link }, si.label))
    )
  );
const rightNavBar = (currentUrl, sections) =>
  div(
    { class: "collapse navbar-collapse", id: "navbarResponsive" },
    ul(
      { class: "navbar-nav ml-auto my-2 my-lg-0" },

      innerSections(sections).map(s =>
        s.link
          ? li(
              { class: ["nav-item", active(currentUrl, s) && "active"] },
              a(
                { class: "nav-link js-scroll-trigger", href: text(s.link) },
                text(s.label)
              )
            )
          : s.subitems
          ? navSubitems(s)
          : ""
      )
    )
  );

const leftNavBar = ({ name }) => [
  a({ class: "navbar-brand js-scroll-trigger", href: "/" }, name),
  button(
    {
      class: "navbar-toggler navbar-toggler-right",
      type: "button",
      "data-toggle": "collapse",
      "data-target": "#navbarResponsive",
      "aria-controls": "navbarResponsive",
      "aria-expanded": "false",
      "aria-label": "Toggle navigation"
    },
    span({ class: "navbar-toggler-icon" })
  )
];

const navbar = (brand, sections, currentUrl) =>
  nav(
    {
      class: "navbar navbar-expand-lg navbar-light fixed-top py-3",
      id: "mainNav"
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
    if ($(window).scrollTop() >= 50) {
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

module.exports = { navbar, alert, logit, navbarSolidOnScroll };
