export function MobileResponse() {
  let jsonData = null;
  let sendData = null;
  let wrapHtml = null;
  let wrapViewName = null;
  let resStatus = null;

  function json(data) {
    jsonData = data;
  }

  function redirect(path) {
    json({ redirect: path });
  }

  function send(data) {
    sendData = data;
  }

  function getJson() {
    return jsonData;
  }

  function getSendData() {
    return sendData;
  }

  function sendWrap(viewname, html) {
    wrapHtml = html;
    wrapViewName = viewname;
  }

  function getWrapHtml() {
    return wrapHtml;
  }

  function getWrapViewName() {
    return wrapViewName;
  }

  function status(value) {
    resStatus = value;
    return this;
  }

  function getStatus() {
    return resStatus;
  }

  return {
    json,
    redirect,
    send,
    getJson,
    getSendData,
    sendWrap,
    getWrapHtml,
    getWrapViewName,
    status,
    getStatus,
  };
}
