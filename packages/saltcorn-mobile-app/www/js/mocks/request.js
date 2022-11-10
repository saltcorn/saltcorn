function MobileRequest({ xhr = false, files = undefined, query = undefined }) {
  const roleId = saltcorn.data.state.getState().mobileConfig.role_id
    ? saltcorn.data.state.getState().mobileConfig.role_id
    : 10;
  const flashMessages = [];

  return {
    __: (s, ...params) =>
      i18next.t(s, {
        postProcess: "sprintf",
        sprintf: params,
      }),
    getLocale: () => "en",
    user: {
      role_id: roleId,
    },
    flash: (type, msg) => {
      flashMessages.push({ type, msg });
    },
    flashMessages: () => {
      return flashMessages;
    },
    get: (key) => {
      return "";
    },
    csrfToken: () => "",
    xhr,
    files,
    query,
  };
}
