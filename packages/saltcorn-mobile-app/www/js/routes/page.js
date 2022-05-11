// post/page/:pagename/action/:rndid
export const postPageAction = async (context) => {
  const { pagename, rndid } = context.params;
  const db_page = await saltcorn.data.models.Page.findOne({ name: pagename });
  let col;
  saltcorn.data.models.layout.traverseSync(db_page.layout, {
    action(segment) {
      if (segment.rndid === rndid) col = segment;
    },
  });
  const result = await saltcorn.data.plugin_helper.run_action_column({
    col,
    referrer: "",
    req: new MobileRequest(),
  });
  return result || {};
};
