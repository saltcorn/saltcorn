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

const dummmyRes = {
  redirect: (path) => {
    const url = new URL(path, "http://localhost");
    window.router
      .resolve({
        pathname: `get${url.pathname}`,
        queryParams: url.search.substring(1),
      })
      .then((page) => {
        document.getElementById("content-div").innerHTML = page.content;
      });
  },
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
  let help = { above: [contents] };
  return {
    content: wrap(context.params.viewname, help, state),
  };
};
