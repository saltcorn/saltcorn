const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const { ul, li, div, small } = require("@saltcorn/markup/tags");

const getFlashes = req =>
  ["error", "success", "danger", "warning"]
    .map(type => {
      return { type, msg: req.flash(type) };
    })
    .filter(a => a.msg && a.msg.length && a.msg.length > 0);

const get_extra_menu = role => {
  const cfg = getState().getConfig("menu_items", []);

  const items = cfg
    .filter(item => role <= +item.min_role)
    .map(item => ({
      label: item.label,
      link:
        item.type === "Link"
          ? item.url
          : item.type === "View"
          ? `/view/${item.viewname}`
          : `/page/${item.pagename}`
    }));
  return items;
};

module.exports = function(req, res, next) {
  res.sendWrap = function(opts, ...html) {
    const isAuth = req.isAuthenticated();
    const state = getState();
    const role = (req.user || {}).role_id || 10;
    const allow_signup = state.getConfig("allow_signup");
    const login_menu = state.getConfig("login_menu");
    const extra_menu = get_extra_menu(role);
    const authItems = isAuth
      ? [
          { label: small(req.user.email.split("@")[0]) },
          { link: "/auth/logout", label: "Logout" }
        ]
      : [
          ...(allow_signup ? [{ link: "/auth/signup", label: "Sign up" }] : []),
          ...(login_menu ? [{ link: "/auth/login", label: "Login" }] : [])
        ];
    const schema = db.getTenantSchema();
    const tenant_list = db.is_it_multi_tenant() && schema === "public";
    const isAdmin = role === 1;
    const adminItems = [
      { link: "/table", label: "Tables" },
      { link: "/viewedit", label: "Views" },
      { link: "/pageedit", label: "Pages" },
      { link: "/files", label: "Files" },
      {
        label: "Settings",
        subitems: [
          { link: "/plugins", label: "Plugins" },
          { link: "/menu", label: "Menu" },
          { link: "/useradmin", label: "Users" },
          { link: "/config", label: "Configuration" },
          { link: "/admin", label: "Admin" },
          ...(tenant_list ? [{ link: "/tenant/list", label: "Tenants" }] : []),
          ...(schema === "public"
            ? [{ link: "/crashlog", label: "Crash log" }]
            : [])
        ]
      }
    ];
    const currentUrl = req.originalUrl.split("?")[0];
    const favicon = state.favicon;

    const iconHeader = favicon
      ? [
          {
            headerTag: `<link rel="icon" type="image/png" href="/files/serve/${favicon.id}">`
          }
        ]
      : [];
    const meta_description = opts.description
      ? [
          {
            headerTag: `<meta name="description" content="${opts.description}">`
          }
        ]
      : [];
    const stdHeaders = [
      {
        headerTag: `<script>var _sc_globalCsrf = "${req.csrfToken()}"</script>`
      },
      { css: "/saltcorn.css" },
      { script: "/saltcorn.js" }
    ];
    const brand = {
      name: getState().getConfig("site_name")
    };
    const menu = [
      extra_menu.length > 0 && {
        section: "Menu",
        items: extra_menu
      },
      isAdmin && {
        section: "Admin",
        items: adminItems
      },
      {
        section: "User",
        items: authItems
      }
    ].filter(s => s);
    const title = typeof opts === "string" ? opts : opts.title;
    res.send(
      getState().layout.wrap({
        title,
        brand,
        menu,
        currentUrl,
        alerts: getFlashes(req),
        body: html.length === 1 ? html[0] : html.join(""),
        headers: [
          ...stdHeaders,
          ...iconHeader,
          ...meta_description,
          ...getState().headers
        ]
      })
    );
  };
  next();
};
