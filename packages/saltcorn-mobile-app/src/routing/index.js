import UniversalRouter from "universal-router";

import {
  runAction,
  loadTableRows,
  updateTableRow,
  insertTableRow,
} from "./routes/api";
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
import { postShare } from "./routes/notifications";
import {
  postResumeWorkflow,
  getFillWorkflowForm,
  postFillWorkflowForm,
} from "./routes/actions";

const routes = [
  // api
  {
    path: "post/api/action/:action",
    action: runAction,
  },
  {
    path: "get/api/:tableName",
    action: loadTableRows,
  },
  {
    path: "post/api/:tableName/:id",
    action: updateTableRow,
  },

  {
    path: "post/api/:tableName/",
    action: insertTableRow,
  },
  {
    path: "post/api/:tableName",
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
    path: "post/delete/:tableName/:id", // legacy
    action: deleteRows,
  },
  {
    path: "delete/api/:tableName/:id",
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
  // notifications
  {
    path: "post/notifications/share",
    action: postShare,
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
  // actions
  {
    path: "post/actions/resume-workflow/:id",
    action: postResumeWorkflow,
  },
  {
    path: "get/actions/fill-workflow-form/:id",
    action: getFillWorkflowForm,
  },
  {
    path: "post/actions/fill-workflow-form/:id",
    action: postFillWorkflowForm,
  },
];

export const router = new UniversalRouter(routes);
