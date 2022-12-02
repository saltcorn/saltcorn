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
  return state.getLayout({ role_id: state.mobileConfig.role_id });
};

const sbAdmin2Layout = () => {
  return saltcorn.data.state.getState().layouts["sbadmin2"];
};

const getMenu = () => {
  const state = saltcorn.data.state.getState();
  const allowSignup = state.getConfig("allow_signup");
  const mobileCfg = saltcorn.data.state.getState().mobileConfig;
  const userName = mobileCfg.user_name;
  const authItems = mobileCfg.isPublicUser
    ? [
        { link: "javascript:execLink('/auth/login')", label: "Login" },
        ...(allowSignup
          ? [{ link: "javascript:execLink('/auth/signup')", label: "Sign up" }]
          : []),
      ]
    : [
        {
          label: "User",
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

  return [
    {
      section: "User",
      isUser: true,
      items: authItems,
    },
  ];
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
        menu: getMenu(),
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
