/*global MobileRequest, parseQuery, MobileResponse, wrapContents, saltcorn*/

// post/page/:pagename/action/:rndid
const postPageAction = async (context) => {
  const state = saltcorn.data.state.getState();
  const req = new MobileRequest({ xhr: context.xhr });
  const { page_name, rndid } = context.params;
  const page = await saltcorn.data.models.Page.findOne({ name: page_name });
  if (!page) throw new Error(req.__("Page %s not found", page_name));
  if (state.mobileConfig.role_id > page.min_role) {
    throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
  }
  let col;
  saltcorn.data.models.layout.traverseSync(page.layout, {
    action(segment) {
      if (segment.rndid === rndid) col = segment;
    },
  });
  const result = await saltcorn.data.plugin_helper.run_action_column({
    col,
    referrer: "",
    req,
  });
  return result || {};
};

// get/page/pagename
const getPage = async (context) => {
  const state = saltcorn.data.state.getState();
  const req = new MobileRequest({ xhr: context.xhr });
  const { page_name } = context.params;
  const page = await saltcorn.data.models.Page.findOne({ name: page_name });
  if (!page) throw new Error(req.__("Page %s not found", page_name));
  if (state.mobileConfig.role_id > page.min_role) {
    throw new saltcorn.data.utils.NotAuthorized(req.__("Not authorized"));
  }
  const query = parseQuery(context.query);
  const res = new MobileResponse();
  const contents = await page.run(query, { res, req });
  const title = "title"; // TODO
  return wrapContents(contents, title, context, req);
};
