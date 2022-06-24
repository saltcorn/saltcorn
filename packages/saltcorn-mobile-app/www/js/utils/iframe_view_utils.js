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

/**
 *
 * @param {*} url
 */
async function execLink(url) {
  const { path, query } = parent.splitPathQuery(url);
  await parent.handleRoute(`get${path}`, query);
}

/**
 *
 * @param {*} e
 * @param {*} urlSuffix
 * @returns
 */
async function formSubmit(e, urlSuffix, viewname) {
  e.submit();
  const files = {};
  const urlParams = new URLSearchParams();
  for (const entry of new FormData(e).entries()) {
    if (entry[1] instanceof File) files[entry[0]] = entry[1];
    else urlParams.append(entry[0], entry[1]);
  }
  const queryStr = urlParams.toString();
  await parent.handleRoute(`post${urlSuffix}${viewname}`, queryStr, files);
}

async function saveAndContinue(e, action, k) {
  const form = $(e).closest("form");
  submitWithEmptyAction(form[0]);
  const queryStr = new URLSearchParams(new FormData(form[0])).toString();
  const res = await parent.router.resolve({
    pathname: `post${action}`,
    query: queryStr,
    xhr: true,
  });
  if (res.id && form.find("input[name=id")) {
    form.append(
      `<input type="hidden" class="form-control  " name="id" value="${res.id}">`
    );
  }
  if (k) await k();
  // TODO ch error (request.responseText?)
}

async function login(email, password) {
  try {
    const response = await parent.apiCall({
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
    parent.localStorage.setItem("auth_jwt", token);
    const decodedJwt = parent.jwt_decode(token);
    parent.saltcorn.data.state.getState().role_id = decodedJwt?.role_id
      ? decodedJwt.role_id
      : 10;
    parent.addRoute({ route: entryView, query: undefined });
    const page = await parent.router.resolve({
      pathname: entryView,
      fullWrap: true,
    });
    parent.replaceIframe(page.content);
  }
}

async function local_post_btn(e) {
  const form = $(e).closest("form");
  const url = form.attr("action");
  const method = form.attr("method");
  const { path, query } = parent.splitPathQuery(url);
  await parent.handleRoute(
    `${method}${path}`,
    combineFormAndQuery(form, query)
  );
}

/**
 *
 * @param {*} e
 * @param {*} path
 */
async function stateFormSubmit(e, path) {
  const formQuery = new URLSearchParams(new FormData(e)).toString();
  await parent.handleRoute(path, formQuery);
}

function removeQueryStringParameter(queryStr, key) {
  let params = [];
  for (const [k, v] of new URLSearchParams(queryStr).entries()) {
    if (k !== key) {
      params.push(`${k}=${v}`);
    }
  }
  return params.join("&");
}

function updateQueryStringParameter(queryStr, key, value) {
  if (!queryStr) {
    return `${key}=${value}`;
  }
  let params = [];
  let updated = false;
  for (const [k, v] of new URLSearchParams(queryStr).entries()) {
    if (k === key) {
      params.push(`${key}=${value}`);
      updated = true;
    } else {
      params.push(`${k}=${v}`);
    }
  }
  if (!updated) {
    params.push(`${key}=${value}`);
  }
  return params.join("&");
}

async function set_state_fields(kvs, href) {
  let queryParams = [];
  let currentQuery = parent.currentQuery();
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true) {
      currentQuery = removeQueryStringParameter(currentQuery, kv[0]);
    } else {
      currentQuery = updateQueryStringParameter(currentQuery, kv[0], kv[1]);
    }
  });
  for (const [k, v] of new URLSearchParams(currentQuery).entries()) {
    queryParams.push(`${k}=${v}`);
  }
  await parent.handleRoute(href, queryParams.join("&"));
}

async function set_state_field(key, value) {
  const query = updateQueryStringParameter(parent.currentQuery(), key, value);
  await parent.handleRoute(parent.currentLocation(), query);
}

async function unset_state_field(key) {
  const href = parent.currentLocation();
  const query = removeQueryStringParameter(parent.currentLocation(), key);
  await parent.handleRoute(href, query);
}

async function sortby(k, desc, viewname) {
  await set_state_fields(
    { _sortby: k, _sortdesc: desc ? "on" : { unset: true } },
    `get/view/${viewname}`
  );
}

async function gopage(n, pagesize, extra) {
  await set_state_fields(
    { ...extra, _page: n, _pagesize: pagesize },
    parent.currentLocation()
  );
}

function mobile_modal(url, opts = {}) {
  if ($("#scmodal").length === 0) {
    $("body").append(`<div id="scmodal", class="modal">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Modal title</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">            
          </button>
        </div>
        <div class="modal-body">
          <p>Modal body text goes here.</p>
        </div>
      </div>
    </div>
  </div>`);
  } else if ($("#scmodal").hasClass("show")) {
    var myModalEl = document.getElementById("scmodal");
    var modal = bootstrap.Modal.getInstance(myModalEl);
    modal.dispose();
  }
  const { path, query } = parent.splitPathQuery(url);
  // submitReload ?
  parent.router
    .resolve({ pathname: `get${path}`, query: query })
    .then((page) => {
      const modalContent = page.content;
      const title = page.title;
      if (title) $("#scmodal .modal-title").html(title);
      $("#scmodal .modal-body").html(modalContent);
      new bootstrap.Modal($("#scmodal")).show();
      // onOpen onClose initialize_page?
    });
}

async function view_post(viewname, route, data, onDone) {
  const result = await parent.router.resolve({
    pathname: `post/view/${viewname}/${route}`,
    data,
  });
  common_done(result);
}

async function local_post(url, args) {
  const result = await parent.router.resolve({
    pathname: `post${url}`,
    data: args,
  });
  if (result.redirect) await parent.handleRoute(result.redirect);
  else common_done(result);
}

async function local_post_json(url) {
  const result = await parent.router.resolve({
    pathname: `post${url}`,
  });
  if (result.redirect) await parent.handleRoute(result.redirect);
  else common_done(result);
}

async function make_unique_field(
  id,
  table_id,
  field_name,
  elem,
  space,
  start,
  always_append,
  char_type
) {
  const value = $(elem).val();
  if (!value) return;
  const path = `/api/${table_id}?approximate=true&${encodeURIComponent(
    field_name
  )}=${encodeURIComponent(value)}&fields=${encodeURIComponent(field_name)}`;
  try {
    // TODO ch support local tables
    const response = await parent.apiCall({
      method: "GET",
      path,
    });
    if (response.data.success) {
      unique_field_from_rows(
        response.data.success,
        id,
        field_name,
        space,
        start,
        always_append,
        char_type,
        value
      );
    }
  } catch (error) {
    console.log("unable to 'make_unique_field'");
  }
}

async function buildEncodedImage(fileId, elementId) {
  const base64Encoded = await parent.loadEncodedFile(fileId);
  $(`#${elementId}`)[0].src = base64Encoded;
}

async function buildEncodedBgImage(fileId, elementId) {
  const base64Encoded = await parent.loadEncodedFile(fileId);
  // ensure that not unique IDs work, but should not happen
  $(`#${elementId}`).each(function () {
    $(this).prev()[0].style.backgroundImage = `url("${base64Encoded}")`;
  });
}

function openFile(fileId) {
  const serverPath = parent.config.server_path;
  const token = localStorage.getItem("auth_jwt");
  parent.cordova.InAppBrowser.open(
    `${serverPath}/files/serve/${fileId}?jwt=${token}`,
    "_self",
    "clearcache=yes,clearsessioncache=yes,location=no"
  );
}

async function select_id(id) {
  const newQuery = updateQueryStringParameter(parent.currentQuery(), "id", id);
  await parent.handleRoute(parent.currentLocation(), newQuery);
}

async function check_state_field(that) {
  const name = that.name;
  const newQuery = that.checked
    ? updateQueryStringParameter(parent.currentQuery(), name, that.value)
    : removeQueryStringParameter(name);
  await parent.handleRoute(parent.currentLocation(), newQuery);
}

async function clear_state() {
  await parent.handleRoute(parent.currentLocation(), undefined);
}

async function view_post(viewname, route, data, onDone) {
  const response = await parent.apiCall({
    method: "POST",
    path: "/view/" + viewname + "/" + route,
    body: typeof data === "string" ? data : JSON.stringify(data),
  });
  if (onDone) onDone(response.data);
  common_done(response);
}

function reload_on_init() {
  console.log("not yet supported");
}
