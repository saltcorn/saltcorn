/*global saltcorn */

import { MobileRequest } from "../mocks/request";
import { MobileResponse } from "../mocks/response";
import { parseQuery, wrapContents } from "../utils";
import { setHasOfflineData } from "../../helpers/offline_mode";
import { routingHistory } from "../../helpers/navigation";
import { apiCall } from "../../helpers/api";

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
  const refererRoute =
    routingHistory?.length > 1
      ? routingHistory[routingHistory.length - 2]
      : undefined;
  const req = new MobileRequest({
    xhr: context.xhr,
    files: context.files,
    refererRoute,
    body: body,
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
    mobileCfg.user.role_id > view.min_role &&
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
  if (mobileCfg.isOfflineMode) await setHasOfflineData(true);
  const wrapped = res.getWrapHtml();
  if (wrapped) {
    return await wrapContents(
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
export const postViewRoute = async (context) => {
  const query = context.query ? parseQuery(context.query) : {};
  const refererRoute =
    routingHistory?.length > 1
      ? routingHistory[routingHistory.length - 2]
      : undefined;
  const req = new MobileRequest({
    xhr: context.xhr,
    query,
    refererRoute,
    body: context.data || {},
  });
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  if (!view)
    throw new Error(req.__("No such view: %s", context.params.viewname));
  const res = new MobileResponse();
  const state = saltcorn.data.state.getState();
  const { user, isOfflineMode } = state.mobileConfig;
  if (user.role_id > view.min_role)
    throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));

  if (!isOfflineMode && view.viewtemplateObj?.name === "WorkflowRoom") {
    const response = await apiCall({
      method: "POST",
      path: `/view/${encodeURIComponent(view.name)}/${encodeURIComponent(
        context.params.route
      )}`,
      body: context.data,
    });
    if (response.data.success === "ok") return response.data;
    else throw new Error(`Unable to run route ${context.params.route}`);
  } else
    await view.runRoute(
      context.params.route,
      context.data,
      res,
      { req, res },
      view.isRemoteTable()
    );
  if (isOfflineMode) await setHasOfflineData(true);
  const wrapped = res.getWrapHtml();
  if (wrapped)
    return await wrapContents(
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
export const getView = async (context) => {
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
  if (
    state.mobileConfig.user.role_id > view.min_role &&
    !(await view.authorise_get({ query, req, ...view }))
  ) {
    const additionalInfos = `: your role: ${state.mobileConfig.user.role_id}, view min_role: ${view.min_role}`;
    throw new saltcorn.data.utils.NotAuthorized(
      req.__("Not authorized") + additionalInfos
    );
  }
  let contents0 = null;
  if (!view.renderLocally()) {
    const response = await apiCall({
      method: "GET",
      path: `/view/${encodeURIComponent(viewname)}${context.query ? `?${context.query}` : ""}`,
    });
    const data = response.data;
    contents0 = data;
  } else {
    const res = new MobileResponse();
    state.queriesCache = {};
    try {
      contents0 = await view.run_possibly_on_page(
        query,
        req,
        res,
        view.isRemoteTable()
      );
    } finally {
      state.queriesCache = null;
    }
    const wrapped = res.getWrapHtml();
    if (wrapped)
      return await wrapContents(
        wrapped,
        res.getWrapViewName() || "viewname",
        context,
        req
      );
  }
  const contents =
    typeof contents0 === "string"
      ? saltcorn.markup.div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-sc-view-source": `/view/${context.params.viewname}${
              context.query
                ? context.query.startsWith("?")
                  ? context.query
                  : `?${context.query}`
                : ""
            }`,
          },
          contents0
        )
      : contents0;

  return await wrapContents(contents, viewname, context, req);
};
