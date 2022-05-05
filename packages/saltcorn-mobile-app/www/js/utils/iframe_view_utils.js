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
  parent.handleRoute(`get${path}`, query);
}

/**
 *
 * @param {*} e
 * @param {*} urlSuffix
 * @returns
 */
async function formSubmit(e, urlSuffix, viewname) {
  e.submit();
  const queryStr = new URLSearchParams(new FormData(e)).toString();
  parent.handleRoute(`post${urlSuffix}${viewname}`, queryStr);
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
    parent.currentLocation = entryView;
    const page = await parent.router.resolve({
      pathname: entryView,
      fullWrap: true,
    });
    parent.replaceIframe(page.content);
  }
}

function local_post_btn(e) {
  const form = $(e).closest("form");
  const url = form.attr("action");
  const method = form.attr("method");
  const { path, query } = parent.splitPathQuery(url);
  parent.handleRoute(`${method}${path}`, combineFormAndQuery(form, query));
}

/**
 *
 * @param {*} e
 * @param {*} path
 */
async function stateFormSubmit(e, path) {
  const formQuery = new URLSearchParams(new FormData(e)).toString();
  parent.handleRoute(path, formQuery);
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

async function setStateFields(kvs, href) {
  let queryParams = [];
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true) {
      parent.currentQuery = removeQueryStringParameter(
        parent.currentQuery,
        kv[0]
      );
    } else {
      parent.currentQuery = updateQueryStringParameter(
        parent.currentQuery,
        kv[0],
        kv[1]
      );
    }
  });
  for (const [k, v] of new URLSearchParams(parent.currentQuery).entries()) {
    queryParams.push(`${k}=${v}`);
  }
  parent.handleRoute(href, queryParams.join("&"));
}

async function sortby(k, desc, viewname) {
  await setStateFields(
    { _sortby: k, _sortdesc: desc ? "on" : { unset: true } },
    `get/view/${viewname}`
  );
}

async function gopage(n, pagesize, extra) {
  await setStateFields(
    { ...extra, _page: n, _pagesize: pagesize },
    parent.currentLocation
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
  parent.router.resolve({ pathname: `get${path}`, query: query }).then((page) => {
    const modalContent = page.content;
    const title = page.title;
    if (title) $("#scmodal .modal-title").html(title);
    $("#scmodal .modal-body").html(modalContent);
    new bootstrap.Modal($("#scmodal")).show();
    // onOpen onClose initialize_page?
  });
}
