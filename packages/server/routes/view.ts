/**
 * @category server
 * @module routes/view
 * @subcategory routes
 */

import Router from "express-promise-router";

import View from "@saltcorn/data/models/view";
import Table from "@saltcorn/data/models/table";
import Trigger from "@saltcorn/data/models/trigger";
import Page from "@saltcorn/data/models/page";

import { text, style, div } from "@saltcorn/markup/tags";
import {
  isAdmin,
  error_catcher,
  scan_for_page_title,
  setTenant,
  isAdminOrHasConfigMinRole,
} from "../routes/utils.js";
import { add_edit_bar, add_results_to_contents } from "../markup/admin.js";
import {
  InvalidConfiguration,
  isTest,
  objectToQueryString,
} from "@saltcorn/data/utils";
import { getState } from "@saltcorn/data/db/state";
import { Req, Res } from "@saltcorn/types/base_types";

/**
 * @type {object}
 * @const
 * @namespace viewRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

/**
 * @name get/:viewname
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.get(
  ["/:viewname", "/:viewname/*slug"],
  error_catcher(async (req: Req, res: Res) => {
    const state = getState()!;
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    const maintenanceModePage = state.getConfig("maintenance_mode_page", "");

    if (
      maintenanceModeEnabled &&
      (!req.user || req.user.role_id > 1) &&
      maintenanceModePage
    ) {
      const maintenancePage = Page.findOne({ name: maintenanceModePage });
      if (maintenancePage) {
        await maintenancePage.run(req.query, { res, req });
        return;
      }
    }

    const { viewname } = req.params;
    const query = { ...req.query };
    const view = View.findOne({ name: viewname });
    const role = req.user && req.user.id ? req.user.role_id : 100;
    state.log(
      3,
      `Route /view/${viewname} user=${req.user?.id}${
        state.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
      }`
    );
    if (!view) {
      state.log(2, `View ${viewname} not found`);
      const errMsg = req.__(`No such view: %s`, text(viewname));
      if (!req.rvr) {
        req.flash("danger", errMsg);
        res.redirect("/");
      } else {
        res.status(404).json({
          error: errMsg,
        });
      }
      return;
    }
    const tic = new Date();

    view.rewrite_query_from_slug(query, req.params.slug);
    if (
      role > view.min_role &&
      !(await view.authorise_get({ query, req, ...(view as any) }))
    ) {
      if (!req.user) {
        res.redirect(`/auth/login?dest=${encodeURIComponent(req.originalUrl)}`);
        return;
      }
      req.flash("danger", req.__("Not authorized"));
      state.log(2, `View ${viewname} not authorized`);
      res.redirect("/");
      return;
    }
    const isModal = req.headers?.saltcornmodalrequest;

    const contents0 = await view.run_possibly_on_page(query, req, res);
    const __ = (s: string) =>
      state.i18n.__({ phrase: s, locale: req.getLocale() }) || s;
    let title:
      | string
      | { title: string; no_menu?: boolean; description?: string } =
      isModal && view.attributes?.popup_title
        ? __(view.attributes?.popup_title)
        : __(view.attributes?.page_title) ||
          scan_for_page_title(contents0, view.name); //legacy
    if ((title || "").includes("{{")) {
      try {
        title = await view.interpolate_title_string(title, query);
      } catch (e: any) {
        console.error(e);
        title = e?.message || e;
      }
    }
    title = { title: title as string };
    if (isModal && view.attributes?.popup_width)
      res.set(
        "SaltcornModalWidth",
        `${view.attributes?.popup_width}${
          view.attributes?.popup_width_units || "px"
        }`
      );
    if (isModal && view.attributes?.popup_minwidth)
      res.set(
        "SaltcornModalMinWidth",
        `${view.attributes?.popup_minwidth}${
          view.attributes?.popup_minwidth_units || "px"
        }`
      );
    if (isModal && view.attributes?.popup_save_indicator)
      res.set("SaltcornModalSaveIndicator", `true`);
    if (isModal && view.attributes?.popup_link_out)
      res.set("SaltcornModalLinkOut", `true`);
    if (view.attributes?.page_description) {
      let description = view.attributes?.page_description;
      if ((description || "").includes("{{")) {
        description = await view.interpolate_title_string(description, query);
      }
      title.description = description;
    }
    if (view.attributes?.no_menu) {
      title.no_menu = true;
    }
    const tock = new Date();
    const ms = tock.getTime() - tic.getTime();
    const resultCollector: any = {};

    if (!isTest() && !req.xhr)
      await Trigger.runTableTriggers(
        "PageLoad",
        null,
        {
          text: req.__("View '%s' was loaded", viewname),
          type: "view",
          name: viewname,
          render_time: ms,
          query: req.query,
        },
        resultCollector,
        req.user,
        { req }
      );
    if (typeof contents0 === "object" && "goto" in contents0)
      res.redirect((contents0 as any).goto);
    else {
      const contents =
        typeof contents0 === "string"
          ? div(
              {
                class: "d-inline",
                "data-sc-embed-viewname": view.name,
                "data-sc-view-source": req.originalUrl,
              },
              contents0
            )
          : contents0;
      res.sendWrap(
        title,
        add_results_to_contents(
          !req.smr && !req.rvr
            ? add_edit_bar({
                role,
                title: view.name,
                what: req.__("View"),
                url: `/viewedit/edit/${encodeURIComponent(view.name)}?on_done_redirect=${encodeURIComponent(req.originalUrl.replace("/", ""))}`,
                cfgUrl: `/viewedit/config/${encodeURIComponent(view.name)}?on_done_redirect=${encodeURIComponent(req.originalUrl.replace("/", ""))}&${objectToQueryString(req.query)}`,
                contents: contents as string,
                req,
                view,
                viewtemplate: view.viewtemplate,
                table: (view.table_id || view.exttable_name) as any,
              })
            : (contents as string),
          resultCollector
        )
      );
    }
  })
);

/**
 * @name post/:viewname/preview
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.post(
  "/:viewname/preview",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req: Req, res: Res) => {
    const { viewname } = req.params;

    const [view] = await View.find({ name: viewname });
    if (!view) {
      res.send("");
      return;
    }
    let query = req.body || {};
    let row: any;
    let table: any;
    const sfs = await view.get_state_fields();
    for (const sf of sfs) {
      if (sf.required && !query[sf.name]) {
        if (!row) {
          if (!table)
            table = Table.findOne(
              view.table_id
                ? { id: view.table_id }
                : { name: view.exttable_name }
            );
          row = await table.getRow({}, { forUser: req.user });
        }
        if (row) query[sf.name] = row[sf.name];
      }
    }
    const contents = await view.run(query, {
      req,
      res,
      isPreview: true,
    } as any);

    res.send(contents);
  })
);

/**
 * @name post/:viewname/:route
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.post(
  "/:viewname/:route",
  setTenant,
  error_catcher(async (req: Req, res: Res, next: any) => {
    const state = getState()!;
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );

    if (maintenanceModeEnabled && (!req.user || req.user.role_id > 1)) {
      res.status(503).json({ error: "in maintenance mode" });
      return;
    }
    next();
  }),
  error_catcher(async (req: Req, res: Res) => {
    const { viewname, route } = req.params;
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const state = getState()!;
    state.log(
      3,
      `Route /view/${viewname} viewroute ${route} user=${req.user?.id}${
        state.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
      }`
    );

    const view = await View.findOne({ name: viewname });
    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      state.log(2, `View ${viewname} not found`);
      res.redirect("/");
    } else if (role > view.min_role) {
      req.flash("danger", req.__("Not authorized"));
      state.log(2, `View ${viewname} viewroute ${route} not authorized`);

      res.redirect("/");
    } else {
      await view.runRoute(route, req.body || {}, res, { res, req });
    }
  })
);

/**
 * @name post/:viewname
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.post(
  ["/:viewname", "/:viewname/*slug"],
  error_catcher(async (req: Req, res: Res, next: any) => {
    const state = getState()!;
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    if (maintenanceModeEnabled && (!req.user || req.user.role_id > 1)) {
      res.status(503).send("Page Unavailable: in maintenance mode");
      return;
    }
    next();
  }),
  setTenant,
  error_catcher(async (req: Req, res: Res) => {
    const { viewname } = req.params;
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const query = { ...req.query };
    const state = getState()!;
    state.log(
      3,
      `Route /view/${viewname} POST user=${req.user?.id}${
        state.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
      }`
    );
    const view = await View.findOne({ name: viewname });
    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      state.log(2, `View ${viewname} not found`);
      res.redirect("/");
      return;
    }
    view.rewrite_query_from_slug(query, req.params.slug);

    if (
      role > view.min_role &&
      !(await view.authorise_post({
        body: req.body || {},
        req,
        ...(view as any),
      }))
    ) {
      req.flash("danger", req.__("Not authorized"));
      state.log(2, `View ${viewname} POST not authorized`);

      res.redirect("/");
    } else if (!view.runPost) {
      throw new InvalidConfiguration(
        `View ${text(viewname)} with template ${
          view.viewtemplate
        } does not supply a POST handler`
      );
    } else {
      await view.runPost(query, req.body || {}, { res, req });
    }
  })
);
