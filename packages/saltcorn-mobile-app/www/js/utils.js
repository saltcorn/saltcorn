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

async function execLink(url) {
  let path = url;
  let query = undefined;
  const queryStart = url.indexOf("?");
  if (queryStart > 0) {
    path = url.substring(0, queryStart);
    query = url.substring(queryStart);
  }
  const page = await window.router.resolve({
    pathname: `get${path}`,
    queryParams: query,
  });
  document.getElementById("content-div").innerHTML = page.content;
}

async function formSubmit(e, path) {
  const formData = new FormData(e);
  let body = {};
  let redirect;
  for (const [k, v] of formData.entries()) {
    body[k] = v;
  }
  try {
    const response = await apiCall({
      method: e.method,
      path,
      body,
    });
    redirect = response.data.redirect;
  } catch (error) {
    // TODO ch message
    return null;
  }
  const page = await window.router.resolve(`get${redirect}`);
  document.getElementById("content-div").innerHTML = page.content;
}

async function stateFormSubmit(e, path) {
  let formData = new FormData(e);
  let sp = new URLSearchParams(formData);
  const page = await window.router.resolve({
    pathname: path,
    queryParams: sp.toString(),
  });
  document.getElementById("content-div").innerHTML = page.content;
}

async function login(email, password) {
  try {
    const response = await apiCall({
      method: "GET",
      path: "/auth/login-with/jwt",
      params: {
        email,
        password,
      },
    });
    return response.data;
  } catch (error) {
    // TODO ch message
    return null;
  }
}

async function loginFormSubmit(e, entryView) {
  let formData = new FormData(e);
  const token = await login(formData.get("email"), formData.get("password"));
  if (token) {
    window.localStorage.setItem("auth_jwt", token);
    const page = await window.router.resolve({ pathname: entryView });
    document.getElementById("content-div").innerHTML = page.content;
  }
}

function local_post_btn(e, reload) {
  const form = $(e).closest("form");
  const url = form.attr("action");
  const method = form.attr("method");
  const { path, query } = splitPathQuery(url);
  handleRoute(`${method}${path}`, combineFormAndQuery(form, query), reload);
}

async function local_set_state_fields(kvs, href) {
  let queryParams = [];
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true) {
    } else queryParams.push(`${kv[0]}=${kv[1]}`);
  });
  const page = await window.router.resolve({
    pathname: href,
    queryParams: queryParams.join("&"),
  });
  document.getElementById("content-div").innerHTML = page.content;
}

async function localSortBy(k, desc, viewname) {
  await local_set_state_fields(
    { _sortby: k, _sortdesc: desc ? "on" : { unset: true } },
    `get/view/${viewname}`
  );
}

async function apiCall({ method, path, params, body }) {
  const serverPath = localStorage.getItem("server_path");
  const token = window.localStorage.getItem("auth_jwt");
  const url = `${serverPath}${path}`;
  try {
    return await axios({
      url: url,
      method: method,
      params: params,
      headers: {
        Authorization: `jwt ${token}`,
        "X-Requested-With": "XMLHttpRequest",
        "X-Saltcorn-Client": "mobile-app",
      },
      data: body,
    });
  } catch (error) {
    console.log(`error while calling: ${method} ${url}`);
    console.log(JSON.stringify(error));
    throw error;
  }
}
