export const getHeaders = () => {
  const config = saltcorn.data.state.getState().mobileConfig;
  const versionTag = config.version_tag;
  const stdHeaders = [
    { css: `static_assets/${versionTag}/saltcorn.css` },
    { script: `static_assets/${versionTag}/saltcorn-common.js` },
    { script: "js/utils/iframe_view_utils.js" },
  ];
  return [...stdHeaders, ...config.pluginHeaders];
};

export const parseQuery = (queryStr) => {
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

export const layout = () => {
  const state = saltcorn.data.state.getState();
  return state.getLayout({ role_id: state.mobileConfig.role_id });
};

export const sbAdmin2Layout = () => {
  return saltcorn.data.state.getState().layouts["sbadmin2"];
};

export const getMenu = () => {
  const userName = saltcorn.data.state.getState().mobileConfig.user_name;
  const authItems = [
    {
      label: "User",
      icon: "far fa-user",
      isUser: true,
      subitems: [
        { label: userName },
        {
          link: `javascript:parent.callLogout();`,
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

export const prepareAlerts = (context, req) => {
  return [...(context.alerts || []), ...req.flashMessages()];
};

export const wrapContents = (contents, title, context, req) => {
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
