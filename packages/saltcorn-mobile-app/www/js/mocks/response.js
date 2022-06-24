function MobileResponse() {
  let jsonData = null;
  let sendData = null;

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
    return getSendData;
  }

  return {
    json,
    redirect,
    send,
    getJson,
    getSendData,
  };
}
