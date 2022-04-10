async function gopage(n, pagesize, extra = {}) {
  return await parent.gopage(n, pagesize, extra);
}

async function execLink(url) {
  return await parent.execLink(url);
}

async function sortBy(k, desc, viewname) {
  return await parent.sortBy(k, desc,viewname);
}  

async function formSubmit(e, path) {
  return await parent.formSubmit(e, path);
}

async function stateFormSubmit(e, path) {
  return await parent.stateFormSubmit(e, path);
}

function local_post_btn(e) {
  return parent.local_post_btn(e);
}

async function loginFormSubmit(e, entryView) {
  return await parent.loginFormSubmit(e, entryView);
}
