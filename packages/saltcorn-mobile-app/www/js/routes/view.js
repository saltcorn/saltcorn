/*global MobileRequest, MobileResponse, parseQuery, wrapContents, saltcorn, offlineHelper, routingHistory*/

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
  const refererRoute =
    routingHistory?.length > 1
      ? routingHistory[routingHistory.length - 2]
      : undefined;
  const req = new MobileRequest({
    xhr: context.xhr,
    files: context.files,
    refererRoute,
  });
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  if (!view)
    throw new Error(req.__("No such view: %s", context.params.viewname));
  const res = new MobileResponse();
  const state = saltcorn.data.state.getState();
  const mobileCfg = state.mobileConfig;
  if (
    mobileCfg.role_id > view.min_role &&
    !(await view.authorise_post({ body, req, ...view }))
  ) {
    throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
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
  if (mobileCfg.isOfflineMode) await offlineHelper.setHasOfflineData(true);
  const wrapped = res.getWrapHtml();
  if (wrapped) {
    return wrapContents(
      wrapped,
      res.getWrapViewName() || "viewname",
      context,
      req
    );
  }
  const json = res.getJson();
  if (json) return json;
  throw new Error(req.__("%s finished without a result", `POST ${view.name}`));
};

/**
 *
 * @param {*} context
 */
const postViewRoute = async (context) => {
  const query = context.query ? parseQuery(context.query) : {};
  const refererRoute =
    routingHistory?.length > 1
      ? routingHistory[routingHistory.length - 2]
      : undefined;
  const req = new MobileRequest({
    xhr: context.xhr,
    query,
    refererRoute,
  });
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  if (!view)
    throw new Error(req.__("No such view: %s", context.params.viewname));
  const res = new MobileResponse();
  const state = saltcorn.data.state.getState();
  const { role_id, isOfflineMode } = state.mobileConfig;
  if (role_id > view.min_role)
    throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
  await view.runRoute(
    context.params.route,
    context.data,
    res,
    { req, res },
    view.isRemoteTable()
  );
  if (isOfflineMode) await offlineHelper.setHasOfflineData(true);
  const wrapped = res.getWrapHtml();
  if (wrapped)
    return wrapContents(
      wrapped,
      res.getWrapViewName() || "viewname",
      context,
      req
    );
  const json = res.getJson();
  if (json) return json;
  throw new Error(
    req.__(
      "%s finished without a result",
      `POST ${view.name}: ${context.params.route}`
    )
  );
};

/**
 *
 * @param {*} context
 * @returns
 */
const getView = async (context) => {
  const state = saltcorn.data.state.getState();
  const query = context.query ? parseQuery(context.query) : {};
  const refererRoute =
    routingHistory?.length > 1
      ? routingHistory[routingHistory.length - 2]
      : undefined;
  const req = new MobileRequest({ xhr: context.xhr, query, refererRoute });
  const { viewname } = context.params;
  const view = saltcorn.data.models.View.findOne({ name: viewname });
  if (!view) throw new Error(req.__("No such view: %s", viewname));
  const res = new MobileResponse();
  if (
    state.mobileConfig.role_id > view.min_role &&
    !(await view.authorise_get({ query, req, ...view }))
  )
    throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
  const contents = await view.run_possibly_on_page(
    query,
    req,
    res,
    view.isRemoteTable()
  );
  const wrapped = res.getWrapHtml();
  if (wrapped)
    return wrapContents(
      wrapped,
      res.getWrapViewName() || "viewname",
      context,
      req
    );
  else return wrapContents(contents, viewname, context, req);
};
