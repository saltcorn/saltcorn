const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const { ul, li, h3, div, small } = require("@saltcorn/markup/tags");
const { renderForm, link } = require("@saltcorn/markup");
const renderLayout = require("@saltcorn/markup/layout");

const getFlashes = (req) =>
  ["error", "success", "danger", "warning"]
    .map((type) => {
      return { type, msg: req.flash(type) };
    })
    .filter((a) => a.msg && a.msg.length && a.msg.length > 0);

const get_extra_menu = (role, state, req) => {
  const cfg = getState().getConfig("menu_items", []);
  const locale = req.getLocale();
  const __ = (s) => state.i18n.__({ phrase: s, locale }) || s;
  const transform = (items) =>
    items
      .filter((item) => role <= +item.min_role)
      .map((item) => ({
        label: __(item.label),
        icon: item.icon,
        style: item.style || "",
        link:
          item.type === "Link"
            ? item.url
            : item.type === "View"
            ? `/view/${encodeURIComponent(item.viewname)}`
            : item.type === "Page"
            ? `/page/${encodeURIComponent(item.pagename)}`
            : undefined,
        ...(item.subitems ? { subitems: transform(item.subitems) } : {}),
      }));
  return transform(cfg);
};

const get_menu = (req) => {
  const isAuth = req.isAuthenticated();
  const state = getState();
  const role = (req.user || {}).role_id || 10;

  const allow_signup = state.getConfig("allow_signup");
  const login_menu = state.getConfig("login_menu");
  const extra_menu = get_extra_menu(role, state, req);
  const authItems = isAuth
    ? [
        {
          label: req.__("User"),
          icon: "far fa-user",
          isUser: true,
          subitems: [
            { label: small((req.user.email || "").split("@")[0]) },
            {
              label: req.__("User Settings"),
              icon: "fas fa-user-cog",

              link: "/auth/settings",
            },
            {
              link: "/auth/logout",
              icon: "fas fa-sign-out-alt",
              label: req.__("Logout"),
            },
          ],
        },
      ]
    : [
        ...(allow_signup
          ? [{ link: "/auth/signup", label: req.__("Sign up") }]
          : []),
        ...(login_menu
          ? [{ link: "/auth/login", label: req.__("Login") }]
          : []),
      ];
  const schema = db.getTenantSchema();
  const isAdmin = role === 1;
  const adminItems = [
    { link: "/table", icon: "fas fa-table", label: req.__("Tables") },
    { link: "/viewedit", icon: "far fa-eye", label: req.__("Views") },
    { link: "/pageedit", icon: "far fa-file", label: req.__("Pages") },
    { link: "/files", icon: "far fa-images", label: req.__("Files") },
    {
      label: req.__("Settings"),
      icon: "fas fa-wrench",
      subitems: [
        {
          link: "/admin",
          icon: "fas fa-tools",
          label: req.__("About application"),
        },
        { link: "/plugins", icon: "fas fa-plug", label: req.__("Plugins") },
        {
          link: "/useradmin",
          icon: "fas fa-users-cog",
          label: req.__("Users and security"),
        },
        {
          link: "/site-structure",
          altlinks: ["/menu", "/search/config", "/tenant/list"],
          icon: "fas fa-compass",
          label: req.__("Site structure"),
        },

        {
          link: "/events",
          altlinks: ["/actions", "/crashlog"],

          icon: "fas fa-calendar-check",
          label: req.__("Events"),
        },
      ],
    },
  ];

  const menu = [
    extra_menu.length > 0 && {
      section: req.__("Menu"),
      items: extra_menu,
    },
    isAdmin && {
      section: req.__("Admin"),
      items: adminItems,
    },
    {
      section: req.__("User"),
      isUser: true,
      items: authItems,
    },
  ].filter((s) => s);
  return menu;
};

const get_headers = (req, version_tag, description, extras = []) => {
  const state = getState();
  const favicon = state.getConfig("favicon_id", null);

  const iconHeader = favicon
    ? [
        {
          headerTag: `<link rel="icon" type="image/png" href="/files/serve/${favicon}">`,
        },
      ]
    : [];
  const meta_description = description
    ? [
        {
          headerTag: `<meta name="description" content="${description}">`,
        },
      ]
    : [];
  const stdHeaders = [
    {
      headerTag: `<script>var _sc_globalCsrf = "${req.csrfToken()}"; var _sc_version_tag = "${version_tag}";</script>`,
    },
    { css: `/static_assets/${version_tag}/saltcorn.css` },
    { script: `/static_assets/${version_tag}/saltcorn.js` },
  ];
  let from_cfg = [];
  if (state.getConfig("page_custom_css", ""))
    from_cfg.push({ style: state.getConfig("page_custom_css", "") });
  if (state.getConfig("page_custom_html", ""))
    from_cfg.push({ headerTag: state.getConfig("page_custom_html", "") });

  return [
    ...stdHeaders,
    ...iconHeader,
    ...meta_description,
    ...state.headers,
    ...extras,
    ...from_cfg,
  ];
};
const get_brand = (state) => {
  const logo_id = state.getConfig("site_logo_id", "");
  return {
    name: state.getConfig("site_name"),
    logo: logo_id && logo_id !== "0" ? `/files/serve/${logo_id}` : undefined,
  };
};
module.exports = (version_tag) =>
  function (req, res, next) {
    const role = (req.user || {}).role_id || 10;

    res.sendAuthWrap = function (title, form, authLinks, ...html) {
      const state = getState();

      const layout = state.getLayout(req.user);
      if (layout.authWrap) {
        res.send(
          layout.authWrap({
            title,
            form,
            authLinks,
            afterForm: html.length === 1 ? html[0] : html.join(""),
            brand: get_brand(state),
            menu: get_menu(req),
            alerts: getFlashes(req),
            headers: get_headers(req, version_tag),
            csrfToken: req.csrfToken(),
            role,
            req,
          })
        );
      } else {
        var links = [];
        if (authLinks.login)
          links.push(
            link(authLinks.login, req.__("Already have an account? Login"))
          );
        if (authLinks.forgot)
          links.push(link(authLinks.forgot, req.__("Forgot password?")));
        if (authLinks.signup)
          links.push(link(authLinks.signup, req.__("Create an account")));
        const body = div(
          h3(title),
          renderForm(form, req.csrfToken()),
          links.join(" | "),
          ...html
        );
        const currentUrl = req.originalUrl.split("?")[0];

        res.send(
          layout.wrap({
            title,
            brand: get_brand(state),
            menu: get_menu(req),
            currentUrl,
            alerts: getFlashes(req),
            body,
            headers: get_headers(req, version_tag),
            role,
            req,
          })
        );
      }
    };
    res.sendWrap = function (opts, ...html) {
      const title = typeof opts === "string" ? opts : opts.title;
      const alerts = getFlashes(req);
      const state = getState();
      const layout = state.getLayout(req.user);

      if (req.xhr) {
        const renderToHtml = layout.renderBody
          ? (h, role) => layout.renderBody({ title, body: h, role, alerts })
          : defaultRenderToHtml;
        res.set("Page-Title", encodeURIComponent(title));
        res.send(
          html.length === 1
            ? renderToHtml(html[0], role)
            : html.map((h) => renderToHtml(h, role)).join("")
        );
        return;
      }
      const currentUrl = req.originalUrl.split("?")[0];

      const pageHeaders = typeof opts === "string" ? [] : opts.headers;
      res.send(
        layout.wrap({
          title,
          brand: get_brand(state),
          menu: get_menu(req),
          currentUrl,
          alerts,
          body: html.length === 1 ? html[0] : html.join(""),
          headers: get_headers(req, version_tag, opts.description, pageHeaders),
          role,
          req,
        })
      );
    };
    next();
  };

const defaultRenderToHtml = (s, role) =>
  typeof s === "string"
    ? s
    : renderLayout({
        blockDispatch: {},
        role,
        layout: s,
      });
