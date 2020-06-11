const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const { ul, li, div, small } = require("@saltcorn/markup/tags");

const getFlashes = req =>
  ["error", "success", "danger", "warning"]
    .map(type => {
      return { type, msg: req.flash(type) };
    })
    .filter(a => a.msg && a.msg.length && a.msg.length > 0);

const get_extra_menu = () => {
  const cfg = getState().getConfig("extra_menu");
  const items = cfg.split(",");
  return items
    .map(item => {
      const [nm, url] = item.split("::");
      return { link: url, label: nm };
    })
    .filter(item => item.link || item.label);
};

module.exports = function(req, res, next) {
  res.sendWrap = function(title, ...html) {
    const isAuth = req.isAuthenticated();
    const allow_signup = getState().getConfig("allow_signup");
    const login_menu = getState().getConfig("login_menu");
    const extra_menu = get_extra_menu();
    const views = getState()
      .views.filter(v => v.on_menu && (isAuth || v.is_public))
      .map(v => ({ link: `/view/${v.name}`, label: v.name }));
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
    const isAdmin = (req.user || {}).role_id === 1;
    const adminItems = [
      { link: "/table", label: "Tables" },
      { link: "/viewedit", label: "Views" },
      { link: "/files", label: "Files" },
      {
        label: "Settings",
        subitems: [
          { link: "/plugins", label: "Plugins" },
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
    const stdHeaders = [{ css: "/saltcorn.css" }, { script: "/saltcorn.js" }];
    const brand = {
      name: getState().getConfig("site_name")
    };
    const menu = [
      views.length > 0 && {
        section: "Views",
        items: views
      },
      extra_menu.length > 0 && {
        section: "Links",
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
    res.send(
      getState().layout.wrap({
        title,
        brand,
        menu,
        currentUrl,
        alerts: getFlashes(req),
        body: html.length === 1 ? html[0] : html.join(""),
        headers: [...stdHeaders, ...getState().headers]
      })
    );
  };
  next();
};
