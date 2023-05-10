/*global i18next, saltcorn*/

function MobileRequest({
  xhr = false,
  files = undefined,
  query = undefined,
} = {}) {
  const cfg = saltcorn.data.state.getState().mobileConfig;
  const roleId = cfg.role_id ? cfg.role_id : 100;
  const userId = cfg.user_id ? cfg.user_id : undefined;
  const flashMessages = [];

  return {
    __: (s, ...params) =>
      i18next.t(s, {
        postProcess: "sprintf",
        sprintf: params,
      }),
    isAuthenticated: () => {
      const mobileCfg = saltcorn.data.state.getState().mobileConfig;
      return mobileCfg && mobileCfg.jwt && !mobileCfg.isPublicUser;
    },
    getLocale: () => {
      const mobileCfg = saltcorn.data.state.getState().mobileConfig;
      return mobileCfg?.language ? mobileCfg.language : "en";
    },
    user: {
      id: userId,
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
