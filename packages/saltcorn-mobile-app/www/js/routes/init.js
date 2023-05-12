/*global postView, postViewRoute, getView, postToggleField, deleteRows, postPageAction, getPage, getLoginView, logoutAction, getSignupView, getErrorView, window, getSyncView, getSyncModalContent, getAskOverwriteDialog, getSyncSettingsView*/
// TODO module namespacese

const initRoutes = async () => {
  const routes = [
    {
      path: "post/view/:viewname",
      action: postView,
    },
    {
      path: "post/view/:viewname/:route",
      action: postViewRoute,
    },
    {
      path: "get/view/:viewname",
      action: getView,
    },
    {
      path: "post/edit/toggle/:name/:id/:field_name",
      action: postToggleField,
    },
    {
      path: "post/delete/:name/:id",
      action: deleteRows,
    },
    {
      path: "post/page/:page_name/action/:rndid",
      action: postPageAction,
    },
    {
      path: "get/page/:page_name",
      action: getPage,
    },
    {
      path: "get/auth/login",
      action: getLoginView,
    },
    {
      path: "get/auth/logout",
      action: logoutAction,
    },
    {
      path: "get/auth/signup",
      action: getSignupView,
    },
    {
      path: "get/error_page",
      action: getErrorView,
    },
    {
      path: "get/sync/sync_settings",
      action: getSyncSettingsView,
    },
    {
      path: "get/sync/ask_overwrite",
      action: getAskOverwriteDialog,
    },
  ];
  window.router = new window.UniversalRouter(routes);
};
