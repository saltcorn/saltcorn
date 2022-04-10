const getHeaders = (versionTag) => {
  const stdHeaders = [
    { css: `static_assets/${versionTag}/saltcorn.css` },
    { script: "js/delegates.js"}
  ];
  return [...stdHeaders];
};


const ident = (s) => s;

const dummyReq = {
  __: ident,
  getLocale: () => "en",
  user: {
    role_id: 1,
  },
  flash: (str) => {
    console.log("flash ->->");
    console.log(str);
  },
  csrfToken: () => "",
};

const dummmyRes = {
};

export const postView = async (context) => {
  let body = {};
  let redirect = undefined;
  let sp = new URLSearchParams(context.query);
  for (const [k, v] of sp.entries()) {
    body[k] = v;
    if (k === "redirect") redirect = v;
  }
  const view = await saltcorn.data.models.View.findOne({
    name: context.params.viewname,
  });
  await view.runPost({}, body, {
    req: dummyReq,
    res: dummmyRes,
    redirect,
  });
  return {};
};

export const getView = async (context) => {
  const viewname = context.params.viewname;
  let query = {};
  const parsedQuery =
    typeof context.queryParams === "string"
      ? new URLSearchParams(context.queryParams)
      : undefined;
  if (parsedQuery) {
    for (let [key, value] of parsedQuery) {
      query[key] = value;
    }
  }
  const state = saltcorn.data.state.getState();
  const view = saltcorn.data.models.View.findOne({ name: viewname });
  const contents = await view.run_possibly_on_page(query, dummyReq, {});
  const layout = state.getLayout({ role_id: 1 });
  const versionTag = window.config.version_tag;
  const wrapped = layout.wrap({ 
    title: viewname, 
    body: contents, 
    alerts: [], 
    role: 1, 
    headers: getHeaders(versionTag),
    bodyClass: "",
    brand: {},
  });
  return {
    content: wrapped
  };
};
