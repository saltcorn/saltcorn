/*global saltcorn, Capacitor */

import { wrapContents } from "../utils";
import { MobileRequest } from "../mocks/request";

import { checkSession } from "../../helpers/auth.js";
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

// files have a real type (e.g. image/png); text/link shares are "text/plain"
const isFileItem = (item) =>
  item?.type && item.type !== "text/plain" && item.url;

export const postShare = async (context) => {
  let content = "";
  const mobileCfg = saltcorn.data.state.getState().mobileConfig;
  if (mobileCfg.networkState === "none")
    content = buildErrMsg("No network connection");
  else if (!(await checkSession())) content = buildErrMsg("Not authenticated");
  else {
    try {
      const { title, description, type, url, additionalItems } =
        context.shareData || {};
      let body = context.shareData;
      if (isFileItem({ type, url })) {
        const items = [{ title, type, url }, ...(additionalItems || [])];
        // title is the real on-disk filename, location is where to find it
        const files = [];
        for (const item of items) {
          const uploaded = await saltcorn.data.models.File.uploadFromPath(
            item.url,
            item.title || "shared-file",
            item.type
          );
          files.push({ title: uploaded.filename, location: uploaded.location });
        }
        body = { description, files };
      }
      const response = await apiCall({
        method: "POST",
        path: "/notifications/share-handler",
        body,
      });
      if (response.error) content = buildErrMsg(response.error);
      else content = buildSuccessMsg("Shared successfully");
    } catch (error) {
      content = buildErrMsg(error.message || "Error sharing");
    }
  }
  return await wrapContents(
    saltcorn.markup.tags.div(
      content,
      saltcorn.markup.tags.script(`
      setTimeout(() => {
        ${
          Capacitor.getPlatform() === "android"
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
