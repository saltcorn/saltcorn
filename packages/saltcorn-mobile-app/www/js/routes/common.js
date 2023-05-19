/*global saltcorn*/

const getHeaders = () => {
  const config = saltcorn.data.state.getState().mobileConfig;
  const versionTag = config.version_tag;
  const stdHeaders = [
    { css: `static_assets/${versionTag}/saltcorn.css` },
    { script: `static_assets/${versionTag}/saltcorn-common.js` },
    { script: "js/utils/iframe_view_utils.js" },
  ];
  return [...stdHeaders, ...config.pluginHeaders];
};

const parseQuery = (queryStr) => {
  let result = {};
  const parsedQuery =
    typeof queryStr === "string" ? new URLSearchParams(queryStr) : undefined;
  if (parsedQuery) {
    for (let [key, value] of parsedQuery) {
      result[key] = value;
    }
  }
  return result;
};

const layout = () => {
  const state = saltcorn.data.state.getState();
  return state.getLayout({ role_id: state.mobileConfig.role_id || 100 });
};

const sbAdmin2Layout = () => {
  return saltcorn.data.state.getState().layouts["sbadmin2"];
};

const getMenu = (req) => {
  const state = saltcorn.data.state.getState();
  const mobileCfg = state.mobileConfig;
  const role = mobileCfg.role_id || 100;
  const extraMenu = saltcorn.data.web_mobile_commons.get_extra_menu(
    role,
    req.__
  );
  if (mobileCfg.inErrorState) {
    const entryLink = mobileCfg.entry_point?.startsWith("get")
      ? mobileCfg.entry_point.substr(3)
      : null;
    return entryLink
      ? [
          {
            section: "Reload",
            items: [
              {
                link: `javascript:parent.gotoEntryView()`,
                icon: "fas fa-sync",
                label: "Reload",
              },
            ],
          },
        ]
      : [];
  } else {
    const allowSignup = state.getConfig("allow_signup");
    const userName = mobileCfg.user_name;
    const authItems = mobileCfg.isPublicUser
      ? [
          {
            link: "javascript:execLink('/auth/login')",
            label: req.__("Login"),
          },
          ...(allowSignup
            ? [
                {
                  link: "javascript:execLink('/auth/signup')",
                  label: req.__("Sign up"),
                },
              ]
            : []),
        ]
      : [
          {
            label: req.__("User"),
            icon: "far fa-user",
            isUser: true,
            subitems: [
              { label: userName },
              {
                link: `javascript:logout();`,
                icon: "fas fa-sign-out-alt",
                label: "Logout",
              },
            ],
          },
        ];
    const result = [];
    if (extraMenu.length > 0)
      result.push({
        section: req.__("Menu"),
        items: extraMenu,
      });
    result.push({
      section: req.__("User"),
      isUser: true,
      items: authItems,
    });
    if (mobileCfg.allowOfflineMode)
      result.push({
        section: "Network",
        items: [
          {
            link: "javascript:execLink('/sync/sync_settings')",
            icon: "fas fa-sync",
            label: "Network",
          },
        ],
      });
    return result;
  }
};

const prepareAlerts = (context, req) => {
  return [...(context.alerts || []), ...req.flashMessages()];
};

const wrapContents = (contents, title, context, req) => {
  const state = saltcorn.data.state.getState();
  const wrappedContent = context.fullWrap
    ? layout().wrap({
        title: title,
        body: { above: [contents] },
        alerts: prepareAlerts(context, req),
        role: state.mobileConfig.role_id,
        menu: getMenu(req),
        headers: getHeaders(),
        brand: { name: "Saltcorn" },
        bodyClass: "",
        currentUrl: "",
      })
    : layout().renderBody({
        title: title,
        body: { above: [contents] },
        alerts: prepareAlerts(context, req),
        role: state.mobileConfig.role_id,
      });
  return { content: wrappedContent, title: title };
};
