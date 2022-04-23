const getHeaders = (versionTag) => {
  console.log("get Headers ->->");
  const stdHeaders = [
    { css: `static_assets/${versionTag}/saltcorn.css` },
    { script: "js/utils/iframe_view_utils.js" },
  ];
  console.log([...stdHeaders, ...window.config.pluginHeaders]);

  return [...stdHeaders, ...window.config.pluginHeaders];
};

function isRemoteTable(view) {
  if (!view.table_id) return false;
  const localTableIds = saltcorn.data.state.getState().localTableIds;
  return localTableIds.indexOf(view.table_id) < 0;
}

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
      req: new MobileRequest(),
      res: response,
      redirect,
    },
    isRemoteTable(view)
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
    new MobileRequest(),
    new MobileResponse(),
    isRemoteTable(view)
  );
  const state = saltcorn.data.state.getState();
  const layout = state.getLayout({ role_id: state.role_id });
  const wrappedContent = context.fullWrap
    ? layout.wrap({
        title: viewname,
        body: viewContent,
        alerts: [],
        role: state.role_id,
        headers: getHeaders(window.config.version_tag),
        bodyClass: "",
        brand: {},
      })
    : layout.renderBody({
        title: viewname,
        body: viewContent,
        alerts: [],
        role: state.role_id,
      });
  return { content: wrappedContent };
};
