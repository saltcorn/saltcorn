function MobileResponse() {
  let jsonData = null;
  let sendData = null;

  function json(data) {
    jsonData = data;
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
    send,
    getJson,
    getSendData,
  };
}
