function splitPathQuery(url) {
  let path = url;
  let query = undefined;
  const queryStart = url.indexOf("?");
  if (queryStart > 0) {
    path = url.substring(0, queryStart);
    query = url.substring(queryStart);
  }
  return { path, query };
}

function handleRoute(route, query, reload) {
  window.router.resolve({ pathname: route, query: query }).then((page) => {
    if (page.redirect) {
      handleRoute(page.redirect, query);
    } else if (page.content) {
      document.getElementById("content-div").innerHTML = page.content;
    } else if (reload) {
      window.location.reload(true);
    }
  });
}

function combineFormAndQuery(form, query) {
  let paramsList = [];
  const formData = new FormData(form[0]);
  for (const [k, v] of formData.entries()) {
    paramsList.push(`${k}=${v}`);
  }
  let sp = new URLSearchParams(query);
  for (let [k, v] of sp.entries()) {
    if (k === "redirect") v = `get${v}`;
    paramsList.push(`${k}=${v}`);
  }
  return paramsList.length > 0 ? `?${paramsList.join("&")}` : undefined;
}

function execLink(url) {
  let path = url;
  let query = undefined;
  const queryStart = url.indexOf("?");
  if (queryStart > 0) {
    path = url.substring(0, queryStart);
    query = url.substring(queryStart);
  }
  window.router
    .resolve({ pathname: `get${path}`, queryParams: query })
    .then((page) => {
      document.getElementById("content-div").innerHTML = page.content;
    });
}

function stateFormSubmit(e, path) {
  let formData = new FormData(e);
  let sp = new URLSearchParams(formData);
  window.router
    .resolve({ pathname: path, queryParams: sp.toString() })
    .then((page) => {
      document.getElementById("content-div").innerHTML = page.content;
    });
}

const login = (email, password) => {
  const serverPath = localStorage.getItem("server_path");
  return new Promise((resolve, reject) => {
    axios({
      url: `${serverPath}/auth/login-with/jwt`,
      type: "GET",
      params: {
        email,
        password,
      },
    })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

async function loginFormSubmit(e, entryView) {
  let formData = new FormData(e);
  const token = await login(formData.get("email"), formData.get("password"));
  window.localStorage.setItem("auth_jwt", token);
  window.router.resolve({ pathname: entryView }).then((page) => {
    document.getElementById("content-div").innerHTML = page.content;
  });
}

function local_post_btn(e, reload) {
  const form = $(e).closest("form");
  const url = form.attr("action");
  const method = form.attr("method");
  const { path, query } = splitPathQuery(url);
  handleRoute(`${method}${path}`, combineFormAndQuery(form, query), reload);
}

function local_set_state_fields(kvs, href) {
  let queryParams = [];
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true) {
    } else queryParams.push(`${kv[0]}=${kv[1]}`);
  });
  window.router
    .resolve({ pathname: href, queryParams: queryParams.join("&") })
    .then((page) => {
      document.getElementById("content-div").innerHTML = page.content;
    });
}

function localSortBy(k, desc, viewname) {
  local_set_state_fields(
    { _sortby: k, _sortdesc: desc ? "on" : { unset: true } },
    `get/view/${viewname}`
  );
}
