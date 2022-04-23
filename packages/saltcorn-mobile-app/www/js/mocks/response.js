function MobileResponse() {
  let jsonData = null;

  function json(data) {
    jsonData = data;
  }

  function getJson() {
    return jsonData;
  }

  return {
    json,
    getJson,
  };
}
