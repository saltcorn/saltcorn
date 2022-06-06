const getHeaders = (versionTag) => {
  const stdHeaders = [
    { css: `static_assets/${versionTag}/saltcorn.css` },
    { script: `static_assets/${versionTag}/saltcorn-common.js` },
    { script: "js/utils/iframe_view_utils.js" },
  ];
  return [...stdHeaders, ...window.config.pluginHeaders];
};

/**
 *
 * @param {*} context
 * @returns
 */
export const postView = async (context) => {
  let body = {};
  let redirect = undefined;
  for (const [k, v] of new URLSearchParams(context.query).entries()) {
    body[k] = v;
    if (k === "redirect") redirect = v;
  }
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  const response = new MobileResponse();
  await view.runPost(
    {},
    body,
    {
      req: new MobileRequest(context.xhr, context.files),
      res: response,
      redirect,
    },
    view.isRemoteTable()
  );
  return response.getJson();
};

/**
 *
 * @param {*} context
 */
export const postViewRoute = async (context) => {
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  const response = new MobileResponse();
  const request = new MobileRequest(context.xhr);
  await view.runRoute(
    context.params.route,
    context.data,
    response,
    { req: request, res: response },
    view.isRemoteTable()
  );
  return response.getJson();
};

/**
 *
 * @param {*} context
 * @returns
 */
export const getView = async (context) => {
  let query = {};
  const parsedQuery =
    typeof context.query === "string"
      ? new URLSearchParams(context.query)
      : undefined;
  if (parsedQuery) {
    for (let [key, value] of parsedQuery) {
      query[key] = value;
    }
  }
  const viewname = context.params.viewname;
  const view = saltcorn.data.models.View.findOne({ name: viewname });
  const viewContent = await view.run_possibly_on_page(
    query,
    new MobileRequest(context.xhr),
    new MobileResponse(),
    view.isRemoteTable()
  );
  const state = saltcorn.data.state.getState();
  const layout = state.getLayout({ role_id: state.role_id });
  const wrappedContent = context.fullWrap
    ? layout.wrap({
        title: viewname,
        body: { above: [viewContent] },
        alerts: [],
        role: state.role_id,
        headers: getHeaders(window.config.version_tag),
        bodyClass: "",
        brand: {},
      })
    : layout.renderBody({
        title: viewname,
        body: { above: [viewContent] },
        alerts: [],
        role: state.role_id,
      });
  return { content: wrappedContent, title: viewname };
};
