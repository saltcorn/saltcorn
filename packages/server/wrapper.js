/**
 * @category server
 * @module wrapper
 */
const { getState } = require("@saltcorn/data/db/state");
const { get_extra_menu } = require("@saltcorn/data/web-mobile-commons");
//const db = require("@saltcorn/data/db");
const { h3, div, small } = require("@saltcorn/markup/tags");
const { renderForm, link } = require("@saltcorn/markup");
const renderLayout = require("@saltcorn/markup/layout");
/**
 * get flashes
 * @param req
 * @returns {T[]}
 */
const getFlashes = (req) =>
  ["error", "success", "danger", "warning", "information"]
    .map((type) => {
      return { type, msg: req.flash(type) };
    })
    .filter((a) => a.msg && a.msg.length && a.msg.length > 0);
/**
 * Get menu
 * @param req
 * @returns {(false|{section: *, items}|{section: *, items: [{link: string, icon: string, label: *},{link: string, icon: string, label: *},{link: string, icon: string, label: *},{icon: string, subitems: [{link: string, icon: string, label: *},{link: string, icon: string, label: *},{link: string, icon: string, altlinks: string[], label: *},{link: string, altlinks: string[], icon: string, label: *},{link: string, icon: string, label: *},null], label: *}]}|{section: *, isUser: boolean, items: ([{icon: string, subitems: [{label: *},{icon: string, link: string, label: *},{link: string, icon: string, label: *}], label: *, isUser: boolean}]|*[])})[]}
 */
const get_menu = (req) => {
  const isAuth = req.user && req.user.id;
  const state = getState();
  const role = (req.user || {}).role_id || 10;

  const allow_signup = state.getConfig("allow_signup");
  const login_menu = state.getConfig("login_menu");
  const locale = req.getLocale();
  const __ = (s) => state.i18n.__({ phrase: s, locale }) || s;
  const extra_menu = get_extra_menu(role, __);
  const authItems = isAuth
    ? [
        {
          label: req.__("User"),
          icon: "far fa-user",
          isUser: true,
          subitems: [
            { label: small((req.user.email || "").split("@")[0]) },
            {
              label: req.__("Notifications"),
              icon: "fas fa-bell",

              link: "/notifications",
            },
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
          ? [
              {
                link: "/auth/signup",
                icon: "fas fa-user-plus",
                label: req.__("Sign up"),
              },
            ]
          : []),
        ...(login_menu
          ? [
              {
                link: "/auth/login",
                icon: "fas fa-sign-in-alt",
                label: req.__("Login"),
              },
            ]
          : []),
      ];
  // const schema = db.getTenantSchema();
  // Admin role id (todo move to common constants)
  const isAdmin = role === 1;
  /*
   * Admin Menu items
   *
   */
  const adminItems = [
    { link: "/table", icon: "fas fa-table", label: req.__("Tables") },
    { link: "/viewedit", icon: "far fa-eye", label: req.__("Views") },
    { link: "/pageedit", icon: "far fa-file", label: req.__("Pages") },
    {
      label: req.__("Settings"),
      icon: "fas fa-wrench",
      subitems: [
        {
          link: "/admin",
          icon: "fas fa-tools",
          label: req.__("About application"),
        },
        { link: "/plugins", icon: "fas fa-cubes", label: req.__("Modules") },
        {
          link: "/useradmin",
          icon: "fas fa-users-cog",
          altlinks: ["/roleadmin"],
          label: req.__("Users and security"),
        },
        {
          link: "/site-structure",
          altlinks: [
            "/menu",
            "/search/config",
            "/library/list",
            "/tenant/list",
          ],
          icon: "fas fa-compass",
          label: req.__("Site structure"),
        },
        { link: "/files", icon: "far fa-images", label: req.__("Files") },
        {
          link: "/events",
          altlinks: ["/actions", "/eventlog", "/crashlog"],
          icon: "fas fa-calendar-check",
          label: req.__("Events"),
        },
      ],
    },
  ];

  // return menu
  return [
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
};
/**
 * Get Headers
 * @param req
 * @param version_tag
 * @param description
 * @param extras
 * @returns {*[]}
 */
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
    { script: `/static_assets/${version_tag}/saltcorn-common.js` },
    { script: `/static_assets/${version_tag}/saltcorn.js` },
  ];
  let from_cfg = [];
  if (state.getConfig("page_custom_css", ""))
    from_cfg.push({ style: state.getConfig("page_custom_css", "") });
  if (state.getConfig("page_custom_html", ""))
    from_cfg.push({ headerTag: state.getConfig("page_custom_html", "") });
  if (state.getConfig("log_client_errors", false))
    from_cfg.push({ scriptBody: `enable_error_catcher()` });
  const state_headers = [];
  for (const hs of Object.values(state.headers)) {
    state_headers.push(...hs);
  }
  return [
    ...stdHeaders,
    ...iconHeader,
    ...meta_description,
    ...state_headers,
    ...extras,
    ...from_cfg,
  ];
};
/**
 * Get brand
 * @param state
 * @returns {{name: *, logo: (string|undefined)}}
 */
const get_brand = (state) => {
  const logo_id = state.getConfig("site_logo_id", "");
  return {
    name: state.getConfig("site_name"),
    logo: logo_id && logo_id !== "0" ? `/files/serve/${logo_id}` : undefined,
  };
};
module.exports = (version_tag) =>
  /**
   *
   * @param req
   * @param res
   * @param next
   */
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
        let links = [];
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
            originalUrl: req.originalUrl,
            alerts: getFlashes(req),
            body,
            headers: get_headers(req, version_tag),
            role,
            req,
            bodyClass: "auth",
          })
        );
      }
    };
    res.sendWrap = function (opts, ...html) {
      const title = typeof opts === "string" ? opts : opts.title;
      const bodyClass = opts.bodyClass || "";
      const alerts = getFlashes(req);
      const state = getState();
      const layout = state.getLayout(req.user);

      if (req.xhr) {
        const renderToHtml = layout.renderBody
          ? (h, role) => layout.renderBody({ title, body: h, role, alerts })
          : defaultRenderToHtml;
        res.header(
          "Cache-Control",
          "private, no-cache, no-store, must-revalidate"
        );

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
          originalUrl: req.originalUrl,

          alerts,
          body: html.length === 1 ? html[0] : html.join(""),
          headers: get_headers(req, version_tag, opts.description, pageHeaders),
          role,
          req,
          bodyClass,
        })
      );
    };
    next();
  };
/**
 * Default render to HTML
 * @param s
 * @param role
 * @returns {string|string|*}
 */
const defaultRenderToHtml = (s, role) =>
  typeof s === "string"
    ? s
    : renderLayout({
        blockDispatch: {},
        role,
        layout: s,
      });
