function MobileRequest(xhr = false) {
  const roleId = saltcorn.data.state.getState().role_id
    ? saltcorn.data.state.getState().role_id
    : 10;

  return {
    __: (s) => s,
    getLocale: () => "en",
    user: {
      role_id: roleId,
    },
    flash: (str) => {
      console.log("flash ->->");
      console.log(str);
    },
    get: (key) => {
      return "";
    },
    csrfToken: () => "",
    xhr,
  };
}
