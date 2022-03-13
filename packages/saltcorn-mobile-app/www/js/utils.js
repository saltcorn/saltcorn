function linkCallback(url) {
  let path = url;
  let query = undefined;
  const queryStart = url.indexOf("?");
  if (queryStart > 0) {
    path = url.substring(0, queryStart);
    query = url.substring(queryStart);
  }
  window.router.resolve({ pathname: path, queryParams: query }).then((html) => {
    document.getElementById("content-div").innerHTML = html;
  });
}

function submitCallback(e, path) {
  let formData = new FormData(e);
  let sp = new URLSearchParams(formData);
  window.router
    .resolve({ pathname: path, queryParams: sp.toString() })
    .then((html) => {
      document.getElementById("content-div").innerHTML = html;
    });
}

function local_post_btn(e) {
  const form = $(e).closest("form");
  const url = form.attr("action");
  const method = form.attr("method");
  let formData = new FormData(form[0]);
  const route = `${method}${url}`;
  console.log(route);
  window.router
    .resolve({ pathname: route, formData: formData })
    .then((html) => {
      // TODO CH no reload
      window.location.reload(true);
    });
}
