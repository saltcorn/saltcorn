/*global saltcorn, Capacitor */

import { wrapContents } from "../utils";
import { MobileRequest } from "../mocks/request";

import { checkJWT } from "../../helpers/auth.js";
import { apiCall } from "../../helpers/api";

const buildErrMsg = (msg) => {
  return saltcorn.markup.tags.span(
    msg,
    saltcorn.markup.tags.i({
      class: "ps-2 fas fa-times text-danger",
    })
  );
};

const buildSuccessMsg = (msg) => {
  return saltcorn.markup.tags.span(
    msg,
    saltcorn.markup.tags.i({
      class: "ps-2 fas fa-check text-success",
    })
  );
};

export const postShare = async (context) => {
  let content = "";
  const mobileCfg = saltcorn.data.state.getState().mobileConfig;
  if (mobileCfg.networkState === "none")
    content = buildErrMsg("No network connection");
  else if (!(await checkJWT(mobileCfg.jwt)))
    content = buildErrMsg("Not authenticated");
  else {
    const response = await apiCall({
      method: "POST",
      path: "/notifications/share-handler",
      body: context.shareData,
    });
    if (response.error) content = buildErrMsg(response.error);
    else content = buildSuccessMsg("Shared successfully");
  }
  return await wrapContents(
    saltcorn.markup.tags.div(
      content,
      saltcorn.markup.tags.script(`
      setTimeout(() => {
        ${
          Capacitor.platform === "android"
            ? "parent.saltcorn.mobileApp.common.finishShareIntent();"
            : "parent.saltcorn.mobileApp.navigation.gotoEntryView();"
        } 
      }, 4000);`)
    ),
    "Share",
    context,
    new MobileRequest()
  );
};
