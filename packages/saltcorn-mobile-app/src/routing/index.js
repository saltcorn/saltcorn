import UniversalRouter from "universal-router";

import { updateTableRow, insertTableRow } from "./routes/api";
import { getLoginView, logoutAction, getSignupView } from "./routes/auth";
import { deleteRows } from "./routes/delete";
import { postToggleField } from "./routes/edit";
import { getErrorView } from "./routes/error";
import { postShowCalculated } from "./routes/fields";
import { postPageAction, getPage } from "./routes/page";
import {
  getSyncSettingsView,
  getAskDeleteOfflineData,
  getAskUploadNotEnded,
} from "./routes/sync";

import { postView, postViewRoute, getView } from "./routes/view";

const routes = [
  // api
  {
    path: "post/api/:tableName/:id",
    action: updateTableRow,
  },
  {
    path: "post/api/:tableName/",
    action: insertTableRow,
  },
  // auth
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
  // delete
  {
    path: "post/delete/:name/:id",
    action: deleteRows,
  },
  // edit
  {
    path: "post/edit/toggle/:name/:id/:field_name",
    action: postToggleField,
  },
  // error
  {
    path: "get/error_page",
    action: getErrorView,
  },
  // field
  {
    path: "post/field/show-calculated/:tableName/:fieldName/:fieldview",
    action: postShowCalculated,
  },
  // page
  {
    path: "post/page/:page_name/action/:rndid",
    action: postPageAction,
  },
  {
    path: "get/page/:page_name",
    action: getPage,
  },
  // sync
  {
    path: "get/sync/sync_settings",
    action: getSyncSettingsView,
  },
  {
    path: "get/sync/ask_upload_not_ended",
    action: getAskUploadNotEnded,
  },
  {
    path: "get/sync/ask_delete_offline_data",
    action: getAskDeleteOfflineData,
  },
  // view
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
];

export const router = new UniversalRouter(routes);
