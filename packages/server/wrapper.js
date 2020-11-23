const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const { ul, li, h3, div, small } = require("@saltcorn/markup/tags");
const { renderForm, link } = require("@saltcorn/markup");

const getFlashes = (req) =>
  ["error", "success", "danger", "warning"]
    .map((type) => {
      return { type, msg: req.flash(type) };
    })
    .filter((a) => a.msg && a.msg.length && a.msg.length > 0);

const get_extra_menu = (role) => {
  const cfg = getState().getConfig("menu_items", []);

  const transform = (items) =>
    items
      .filter((item) => role <= +item.min_role)
      .map((item) => ({
        label: item.label,
        icon: item.icon,
        link:
          item.type === "Link"
            ? item.url
            : item.type === "View"
            ? `/view/${item.viewname}`
            : item.type === "Page"
            ? `/page/${item.pagename}`
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
  const extra_menu = get_extra_menu(role);
  const authItems = isAuth
    ? [
        {
          label: req.__("User"),
          isUser: true,
          subitems: [
            { label: small((req.user.email || "").split("@")[0]) },
            {
              label: req.__("User Settings"),
              link: "/auth/settings",
            },
            { link: "/auth/logout", label: req.__("Logout") },
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
  const tenant_list =
    db.is_it_multi_tenant() && schema === db.connectObj.default_schema;
  const isAdmin = role === 1;
  const adminItems = [
    { link: "/table", label: req.__("Tables") },
    { link: "/viewedit", label: req.__("Views") },
    { link: "/pageedit", label: req.__("Pages") },
    { link: "/files", label: req.__("Files") },
    {
      label: req.__("Settings"),
      subitems: [
        { link: "/plugins", label: req.__("Plugins") },
        { link: "/actions", label: req.__("Actions") },
        { link: "/menu", label: req.__("Menu") },
        { link: "/useradmin", label: req.__("Users and roles") },
        { link: "/search/config", label: req.__("Search") },
        { link: "/config", label: req.__("Configuration") },
        { link: "/admin", label: req.__("Admin") },
        ...(tenant_list
          ? [{ link: "/tenant/list", label: req.__("Tenants") }]
          : []),
        ...(schema === db.connectObj.default_schema
          ? [{ link: "/crashlog", label: req.__("Crash log") }]
          : []),
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

const get_headers = (req, description, extras = []) => {
  const state = getState();
  const favicon = state.favicon;

  const iconHeader = favicon
    ? [
        {
          headerTag: `<link rel="icon" type="image/png" href="/files/serve/${favicon.id}">`,
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
      headerTag: `<script>var _sc_globalCsrf = "${req.csrfToken()}"</script>`,
    },
    { css: "/saltcorn.css" },
    { script: "/saltcorn.js" },
  ];
  return [
    ...stdHeaders,
    ...iconHeader,
    ...meta_description,
    ...state.headers,
    ...extras,
  ];
};
const get_brand = (state) => {
  const logo_id = state.getConfig("site_logo_id", "");
  return {
    name: state.getConfig("site_name"),
    logo: logo_id && logo_id !== "0" ? `/files/serve/${logo_id}` : undefined,
  };
};
module.exports = function (req, res, next) {
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
          headers: get_headers(req),
          csrfToken: req.csrfToken(),
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
          headers: get_headers(req),
        })
      );
    }
  };
  res.sendWrap = function (opts, ...html) {
    const title = typeof opts === "string" ? opts : opts.title;
    if (req.xhr) {
      res.set("Page-Title", title);
      res.send(html.length === 1 ? html[0] : html.join(""));
      return;
    }

    const state = getState();
    const layout = state.getLayout(req.user);
    const currentUrl = req.originalUrl.split("?")[0];

    const pageHeaders = typeof opts === "string" ? [] : opts.headers;
    res.send(
      layout.wrap({
        title,
        brand: get_brand(state),
        menu: get_menu(req),
        currentUrl,
        alerts: getFlashes(req),
        body: html.length === 1 ? html[0] : html.join(""),
        headers: get_headers(req, opts.description, pageHeaders),
      })
    );
  };
  next();
};
