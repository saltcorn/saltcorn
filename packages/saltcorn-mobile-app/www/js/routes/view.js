const get_headers = () => {
  const stdHeaders = [
    { css: "public/saltcorn.css" },
    { script: "public/saltcorn.js" },
  ];
  return [...stdHeaders];
};

const wrap = (title, contents, state) => {
  const bodyClass = "";
  const alerts = [];
  const role_id = 1;
  const role = role_id;
  const layout = state.getLayout({ role_id: role_id });

  const wrappedIn = layout.wrap({
    title,
    brand: {},
    menu: [],
    alerts,
    body: contents.above.join(""),
    headers: get_headers(),
    role,
    bodyClass,
  });
  return wrappedIn;
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

export const postView = async (context) => {
  console.log("push view ->->");
  console.log(context.params.viewname);
  let body = {};
  for (var pair of context.formData.entries()) {
    console.log(pair[0] + ", " + pair[1]);
    body[pair[0]] = pair[1];
  }
  const views = await saltcorn.data.models.View.find({
    name: context.params.viewname,
  });

  await views[0].runPost({}, body, {
    res: {},
    req: dummyReq,
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
  let help = { above: [contents] };
  return wrap(context.params.viewname, help, state);
};
