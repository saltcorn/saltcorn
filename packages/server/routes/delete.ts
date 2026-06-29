/**
 * @category server
 * @module routes/delete
 * @subcategory routes
 */

import Router from "express-promise-router";

// @ts-ignore -- utils.js has not been converted to TypeScript yet
import { error_catcher, is_relative_url, safe_redirect } from "./utils.js";
import Table from "@saltcorn/data/models/table";
import { readState } from "@saltcorn/data/plugin-helper";
import {
  freeVariables,
  add_free_variables_to_joinfields,
} from "@saltcorn/data/models/expression";
/**
 * @type {object}
 * @const
 * @namespace deleteRouter
 * @category server
 * @subcategory routes
 */
const router = Router();

// export our router to be mounted by the parent application
export default router;

/**
 * @name post/:name/:id
 * @function
 * @memberof module:routes/delete~deleteRouter
 * @function
 */
router.post(
  "/:tableName/:id",
  error_catcher(async (req: any, res: any) => {
    const { tableName, id } = req.params;
    const { redirect } = req.query;
    // todo check that works after where change
    const table = Table.findOne({ name: tableName });
    if (!table) throw new Error(`Table ${tableName} not found`);
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const where = { [table.pk_name]: id };
    const resultCollector = {};
    let success = false;
    try {
      if (role <= table.min_role_write) {
        await table.deleteRows(
          where,
          req.user || { role_id: 100 },
          false,
          resultCollector
        );
        success = true;
      } else if (
        (table.ownership_field_id || table.ownership_formula) &&
        req.user
      ) {
        const joinFields = {};
        if (table.ownership_formula) {
          const freeVars = freeVariables(table.ownership_formula);
          add_free_variables_to_joinfields(freeVars, joinFields, table.fields);
        }
        const row = await table.getJoinedRow({
          where,
          joinFields,
          forUser: req.user,
          forPublic: !req.user,
        });
        if (row && table.is_owner(req.user, row)) {
          await table.deleteRows(
            where,
            req.user || { role_id: 100 },
            false,
            resultCollector
          );
          success = true;
        } else req.flash("error", req.__("Not authorized"));
      } else
        req.flash(
          "error",
          req.__("Not allowed to write to table %s", table.name)
        );
    } catch (e: any) {
      console.error(e);
      req.flash("error", e.message);
    }
    if (req.xhr) {
      res.json({ success, ...resultCollector });
    } else safe_redirect(res, redirect, `/list/${table.name}`);
  })
);
router.post(
  "/:tableName",
  error_catcher(async (req: any, res: any) => {
    const { tableName } = req.params;
    const { redirect, ...restQuery } = req.query;
    // todo check that works after where change
    const table = Table.findOne({ name: tableName });
    if (!table) throw new Error(`Table ${tableName} not found`);
    const role = req.user && req.user.id ? req.user.role_id : 100;
    const query: Record<string, any> = {};
    table.fields.forEach((f) => {
      if (typeof restQuery[f.name] !== "undefined")
        query[f.name] = restQuery[f.name];
    });
    const where = readState(query, table.fields, req);
    console.log({ where, restQuery });

    try {
      if (role <= table.min_role_write)
        await table.deleteRows(where, req.user || { role_id: 100 });
      else if (
        (table.ownership_field_id || table.ownership_formula) &&
        req.user
      ) {
        const row = await table.getRow(where, {
          forUser: req.user,
          forPublic: !req.user,
        });
        if (row && table.is_owner(req.user, row))
          await table.deleteRows(where, req.user || { role_id: 100 });
        else req.flash("error", req.__("Not authorized"));
      } else
        req.flash(
          "error",
          req.__("Not allowed to write to table %s", table.name)
        );
    } catch (e: any) {
      console.error(e);
      req.flash("error", e.message);
    }
    if (req.xhr) res.send("OK");
    else
      res.redirect(
        (is_relative_url(redirect) && redirect) || `/list/${table.name}`
      );
  })
);
