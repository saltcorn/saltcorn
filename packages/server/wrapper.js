/**
 * @category server
 * @module wrapper
 */
const { getState } = require("@saltcorn/data/db/state");
const { get_extra_menu } = require("@saltcorn/data/web-mobile-commons");
//const db = require("@saltcorn/data/db");
const { h3, div, small, domReady } = require("@saltcorn/markup/tags");
const { renderForm, link } = require("@saltcorn/markup");
const renderLayout = require("@saltcorn/markup/layout");
const { isPushEnabled } = require("@saltcorn/data/utils");
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
  const role = (req.user || {}).role_id || 100;

  const locale = req.getLocale();
  const __ = (s) => state.i18n.__({ phrase: s, locale }) || s;
  const extra_menu_all = get_extra_menu(role, __, req.user || {}, locale);
  const extra_menu = extra_menu_all.filter((item) => !item.isUser);
  const user_menu = extra_menu_all.filter((item) => item.isUser);
  // return menu
  return [
    extra_menu.length > 0 && {
      section: req.__("Menu"),
      items: extra_menu,
    },
    ...(user_menu.length
      ? [
          {
            section: req.__("User"),
            isUser: true,
            items: user_menu,
          },
        ]
      : []),
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
  const notification_in_menu = JSON.stringify(
    state.getConfig("menu_items", [])
  ).includes('"Notifications');
  const pwa_enabled = state.getConfig("pwa_enabled");
  const push_notify_enabled = state.getConfig("enable_push_notify", false);
  const dynamic_updates_enabled = state.getConfig(
    "enable_dynamic_updates",
    true
  );
  const is_root = req.user?.role_id === 1;

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
  const locale = req.getLocale();
  const stdHeaders = [
    {
      headerTag: `<script>var _sc_loglevel = ${
        state.logLevel
      }, _sc_globalCsrf = "${req.csrfToken()}", _sc_version_tag = "${version_tag}"${
        locale ? `, _sc_locale = "${locale}"` : ""
      }, _sc_lightmode = ${JSON.stringify(
        state.getLightDarkMode?.(req.user) || "light"
      )}, _sc_pageloadtag = Math.floor(Math.random() * 16777215).toString(16);</script>`,
    },
    { css: `/static_assets/${version_tag}/saltcorn.css` },
    { script: `/static_assets/${version_tag}/saltcorn-common.js` },
    { script: `/static_assets/${version_tag}/saltcorn.js` },
    { script: `/static_assets/${version_tag}/dayjs.min.js` },
  ];
  if (dynamic_updates_enabled) {
    stdHeaders.push({
      script: `/static_assets/${version_tag}/socket.io.min.js`,
    });
  }
  if (locale !== "en") {
    stdHeaders.push({
      script: `/static_assets/${version_tag}/dayjslocales/${locale}.js`,
    });
  }
  let from_cfg = [];
  if (state.getConfig("page_custom_css", ""))
    from_cfg.push({ style: state.getConfig("page_custom_css", "") });
  if (state.getConfig("page_custom_html", ""))
    from_cfg.push({ headerTag: state.getConfig("page_custom_html", "") });
  if (state.getConfig("log_client_errors", false))
    from_cfg.push({ scriptBody: `enable_error_catcher()` });
  const state_headers = [];
  const assets_by_role = state.assets_by_role || {};
  const roleHeaders = assets_by_role[req.user?.role_id || 100];
  if (roleHeaders && roleHeaders.length) {
    state_headers.push(...roleHeaders);
  } else {
    for (const hs of Object.values(state.headers)) {
      state_headers.push(...hs);
    }
  }

  if (notification_in_menu)
    from_cfg.push({ scriptBody: domReady(`check_saltcorn_notifications()`) });
  if (pwa_enabled) {
    from_cfg.push({
      headerTag: `<link rel="manifest" href="/notifications/manifest.json${
        is_root ? new Date().valueOf() : ""
      }">`,
    });
  }
  if (pwa_enabled || (push_notify_enabled && req.user?.id)) {
    from_cfg.push({
      scriptBody: `if('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/serviceworker.js', { scope: '/' });
      }`,
    });
  }
  if (push_notify_enabled && req.user?.id) {
    const allSubs = getState().getConfig("push_notification_subscriptions", {});
    const userSubs = allSubs[req.user.id];
    const userEnabled = !!userSubs || isPushEnabled(req.user);
    const vapidPublicKey = getState().getConfig("vapid_public_key");
    const userEndpoints = userSubs ? userSubs.map((sub) => sub.endpoint) : [];
    from_cfg.push({
      scriptBody: `var push_notify_cfg = ${JSON.stringify({
        enabled: true,
        userEnabled: userEnabled,
        vapidPublicKey,
        endpoints: userEndpoints,
      })}`,
    });
  }
  from_cfg.push({
    scriptBody: `var dynamic_updates_cfg = ${JSON.stringify({
      enabled: dynamic_updates_enabled && req.user?.id,
    })}`,
  });
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
const get_brand = (state, req) => {
  const logo_id = state.getConfig("site_logo_id", "");
  const locale = req.getLocale();
  const __ = (s) => state.i18n.__({ phrase: s, locale }) || s;
  const name = __(state.getConfig("site_name", "Saltcorn"));
  return {
    name,
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
    const role = (req.user || {}).role_id || 100;

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
            brand: get_brand(state, req),
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
            brand: get_brand(state, req),
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
      const no_menu = opts.no_menu;

      if (req.xhr) {
        const renderToHtml = layout.renderBody
          ? (h, role, req) =>
              layout.renderBody({
                title,
                body: h,
                role,
                alerts,
                req,
                hints: layout.hints,
              })
          : defaultRenderToHtml;
        res.header(
          "Cache-Control",
          "private, no-cache, no-store, must-revalidate"
        );

        res.set("Page-Title", encodeURIComponent(title));
        res.send(
          html.length === 1
            ? renderToHtml(html[0], role, req)
            : html.map((h) => renderToHtml(h, role, req)).join("")
        );
        return;
      }
      const currentUrl = req.originalUrl.split("?")[0];

      const pageHeaders = typeof opts === "string" ? [] : opts.headers;

      res.send(
        layout.wrap({
          title,
          brand: no_menu ? undefined : get_brand(state, req),
          menu: no_menu ? undefined : get_menu(req),
          currentUrl,
          originalUrl: req.originalUrl,
          requestFluidLayout:
            typeof opts === "string" ? false : opts.requestFluidLayout,
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
const defaultRenderToHtml = (s, role, req) =>
  typeof s === "string"
    ? s
    : renderLayout({
        blockDispatch: {},
        role,
        req,
        layout: s,
      });
