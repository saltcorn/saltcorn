/**
 * common structures used in the server and the mobile-app package
 */

import utils from "./utils";
const { isNode } = utils;
const { getState } = require("./db/state");

const disabledMobileMenus = ["Link", "Action", "Search"];

/**
 * Get extra menu
 * @param role
 * @param __ translation function
 * @returns array of extra menu items
 */
const get_extra_menu = (role: number, __: (str: string) => string) => {
  let cfg = getState().getConfig("unrolled_menu_items", []);
  if (!cfg || cfg.length === 0) {
    cfg = getState().getConfig("menu_items", []);
  }
  const is_node = isNode();
  const transform = (items: any) =>
    items
      .filter((item: any) => role <= +item.min_role)
      .filter((item: any) =>
        is_node ? true : disabledMobileMenus.indexOf(item.type)
      )
      .map((item: any) => ({
        label: __(item.label),
        icon: item.icon,
        location: item.location,
        style: item.style || "",
        type: item.type,
        link:
          item.type === "Link"
            ? item.url
            : item.type === "Action"
            ? `javascript:${
                is_node ? "ajax" : "local"
              }_post_json('/menu/runaction/${item.action_name}')`
            : item.type === "View"
            ? is_node
              ? `/view/${encodeURIComponent(item.viewname)}`
              : `javascript:execLink('/view/${item.viewname}')`
            : item.type === "Page"
            ? is_node
              ? `/page/${encodeURIComponent(item.pagename)}`
              : `javascript:execLink('/page/${item.pagename}')`
            : undefined,
        ...(item.subitems ? { subitems: transform(item.subitems) } : {}),
      }));
  return transform(cfg);
};

export = {
  get_extra_menu,
};
