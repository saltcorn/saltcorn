import { deleteRows } from "./delete.js";
import { getView, postView, postViewRoute } from "./view.js";
import { postToggleField } from "./edit.js";
import { postPageAction, getPage } from "./page.js";
import { getLoginView, getSignupView, logout } from "./auth.js";
import { getErrorView } from "./error.js";

export const initRoutes = async () => {
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
      action: logout,
    },
    {
      path: "get/auth/signup",
      action: getSignupView,
    },
    {
      path: "get/error_page",
      action: getErrorView,
    }
  ];
  window.router = new window.UniversalRouter(routes);
};
