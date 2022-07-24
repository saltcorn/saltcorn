import { parseQuery, wrapContents } from "./common.js";

// post/page/:pagename/action/:rndid
export const postPageAction = async (context) => {
  const { page_name, rndid } = context.params;
  const page = await saltcorn.data.models.Page.findOne({ name: page_name });
  let col;
  saltcorn.data.models.layout.traverseSync(page.layout, {
    action(segment) {
      if (segment.rndid === rndid) col = segment;
    },
  });
  const result = await saltcorn.data.plugin_helper.run_action_column({
    col,
    referrer: "",
    req: new MobileRequest(context.xhr),
  });
  return result || {};
};

// get/page/pagename
export const getPage = async (context) => {
  const { page_name } = context.params;
  const page = await saltcorn.data.models.Page.findOne({ name: page_name });
  const query = parseQuery(context.query);
  const req = new MobileRequest(context.xhr);
  const res = new MobileResponse();
  const contents = await page.run(query, { res, req });
  const title = "title"; // TODO
  return wrapContents(contents, title, context, req);
};
