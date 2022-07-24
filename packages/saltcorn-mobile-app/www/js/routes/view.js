import { parseQuery, wrapContents } from "./common.js";

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
  const query = parseQuery(context.query);
  const { viewname } = context.params;
  const view = saltcorn.data.models.View.findOne({ name: viewname });
  const req = new MobileRequest(context.xhr);
  const contents = await view.run_possibly_on_page(
    query,
    req,
    new MobileResponse(),
    view.isRemoteTable()
  );
  return wrapContents(contents, viewname, context, req);
};
