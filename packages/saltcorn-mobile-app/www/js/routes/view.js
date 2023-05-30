/*global MobileRequest, MobileResponse, parseQuery, wrapContents, saltcorn, offlineHelper*/

/**
 *
 * @param {*} context
 * @returns
 */
const postView = async (context) => {
  let body = {};
  let redirect = undefined;
  for (const [k, v] of new URLSearchParams(context.query).entries()) {
    body[k] = v;
    if (k === "redirect") redirect = v;
  }
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  const req = new MobileRequest({ xhr: context.xhr, files: context.files });
  const res = new MobileResponse();
  const state = saltcorn.data.state.getState();
  const mobileCfg = state.mobileConfig;
  if (
    mobileCfg.role_id > view.min_role &&
    !(await view.authorise_post({ body, req, ...view }))
  ) {
    throw new Error(req.__("Not authorized"));
  }
  await view.runPost(
    {},
    body,
    {
      req,
      res,
      redirect,
    },
    view.isRemoteTable()
  );
  if (mobileCfg.isOfflineMode && !(await offlineHelper.getLastOfflineSession()))
    await offlineHelper.setOfflineSession({ offlineUser: mobileCfg.user_name });
  return res.getJson();
};

/**
 *
 * @param {*} context
 */
const postViewRoute = async (context) => {
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  const req = new MobileRequest({ xhr: context.xhr });
  const res = new MobileResponse();
  const state = saltcorn.data.state.getState();
  const { role_id, isOfflineMode, user_name } = state.mobileConfig;
  if (role_id > view.min_role) throw new Error(req.__("Not authorized"));
  await view.runRoute(
    context.params.route,
    context.data,
    res,
    { req, res },
    view.isRemoteTable()
  );
  if (isOfflineMode && !(await offlineHelper.getLastOfflineSession()))
    await offlineHelper.setOfflineSession({ offlineUser: user_name });
  return res.getJson();
};

/**
 *
 * @param {*} context
 * @returns
 */
const getView = async (context) => {
  const state = saltcorn.data.state.getState();
  const query = parseQuery(context.query);
  const { viewname } = context.params;
  const view = saltcorn.data.models.View.findOne({ name: viewname });
  const req = new MobileRequest({ xhr: context.xhr, query });
  if (
    state.mobileConfig.role_id > view.min_role &&
    !(await view.authorise_get({ query, req, ...view }))
  )
    throw new Error(req.__("Not authorized"));
  const contents = await view.run_possibly_on_page(
    query,
    req,
    new MobileResponse(),
    view.isRemoteTable()
  );
  return wrapContents(contents, viewname, context, req);
};
