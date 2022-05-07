import { deleteRows } from "./delete.js";
import { getView, postView, postViewRoute } from "./view.js";
import { postToggleField } from "./edit.js";

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
  ];
  window.router = new window.UniversalRouter(routes);
};
