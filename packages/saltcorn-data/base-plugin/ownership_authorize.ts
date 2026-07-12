/**
 * Lets a row's owner access an Edit view even below its min_role.
 * Registered as the base plugin's authorize_view hook (base-plugin/index.ts).
 * @category saltcorn-data
 * @module base-plugin/ownership_authorize
 * @subcategory base-plugin
 */
import Table from "../models/table.js";
import { freeVariables } from "../models/expression.js";
import { add_free_variables_to_joinfields } from "../plugin-helper.js";
import { splitUniques } from "../viewable_fields.js";
import type { AuthorizeAccessViewHook, Req } from "@saltcorn/types/base_types";
import type { GenObj } from "@saltcorn/types/common_types";

/**
 * Checks whether the current user owns the row a form is being saved to.
 * @param opts.body - the submitted form data
 * @param opts.table_id - the table the row belongs to
 * @param opts.req - the request, used to identify the current user
 * @returns {Promise<boolean>}
 */
const doAuthPost = async ({
  body,
  table_id,
  req,
}: {
  body: GenObj;
  table_id: number | string;
  req: Req;
}) => {
  const table = Table.findOne({ id: table_id });
  const user_id = req.user ? req.user.id : null;
  if (table!.ownership_field_id && user_id) {
    const field_name = await table!.owner_fieldname();
    if (typeof body[field_name || ""] === "undefined") {
      const fields = table!.getFields();
      const { uniques } = splitUniques(fields, body);
      if (Object.keys(uniques).length > 0) {
        const dbrow = await table!.getRow(uniques, {
          forUser: req.user,
          forPublic: !req.user,
        });
        if (!dbrow) return false;
        return table!.is_owner(req.user, dbrow);
      }
    } else return field_name && `${body[field_name]}` === `${user_id}`;
  }
  if (table!.ownership_formula && user_id) {
    let row = { ...body };
    if (body[table!.pk_name]) {
      const joinFields: GenObj = {};
      if (table!.ownership_formula) {
        const fields = table!.getFields();
        const freeVars = freeVariables(table!.ownership_formula);
        add_free_variables_to_joinfields(freeVars, joinFields, fields);
      }
      const dbrow = await table!.getJoinedRows({
        where: {
          [table!.pk_name]: body[table!.pk_name],
        },
        joinFields,
      });
      if (dbrow.length > 0) row = { ...body, ...dbrow[0] };
    } else {
      const freeVars = freeVariables(table!.ownership_formula);
      const fields = table!.getFields();

      const field_names = new Set(fields.map((f: any) => f.name));

      for (const fv of freeVars) {
        const kpath = fv.split(".");
        if (field_names.has(kpath[0]) && kpath.length > 1) {
          const field = fields.find((f: any) => f.name === kpath[0]);
          if (!field)
            throw new Error("Invalid formula:" + table!.ownership_formula);
          const reftable = Table.findOne({ name: field.reftable_name })!;
          const joinFields: GenObj = {};
          const [kpath0, ...kpathrest] = kpath;
          add_free_variables_to_joinfields(
            new Set([kpathrest.join(".")]),
            joinFields,
            fields
          );

          const rows = await reftable.getJoinedRows({
            where: {
              [reftable.pk_name]: body[kpath0],
            },
            joinFields,
          });
          row[kpath0] = rows[0];
        }
      }
    }

    const is_owner = await table!.is_owner(req.user, row);
    return is_owner;
  }
  if (table!.name === "users" && `${body.id}` === `${user_id}`) return true;
  return false;
};

/**
 * Allows access to an Edit view if the user owns the row being viewed/edited.
 * @param request - what's being accessed and how
 * @param user - the current user
 * @returns {Promise<AuthorizeAccessResult | null>}
 */
export const authorize_view: AuthorizeAccessViewHook = async (
  request,
  user
) => {
  if (request.view?.viewtemplate !== "Edit") return null;
  const table_id = request.view.table_id;
  const req = request.req;
  if (request.action === "post") {
    const allowed = await doAuthPost({
      body: request.body || {},
      table_id: table_id!,
      req,
    });
    return allowed ? { decision: "allow" } : null;
  }
  // action === "get"
  const query = request.state || {};
  const table = Table.findOne({ id: table_id });
  if (Object.keys(query).length === 1) {
    if (table!.ownership_field_id || table!.ownership_formula) {
      const fields = table!.getFields();
      const { uniques } = splitUniques(fields, query);
      if (Object.keys(uniques).length > 0) {
        const joinFields: GenObj = {};
        if (table!.ownership_formula) {
          const freeVars = freeVariables(table!.ownership_formula);
          add_free_variables_to_joinfields(freeVars, joinFields, fields);
        }
        const row = await table!.getJoinedRows({ where: uniques, joinFields });
        if (row.length > 0)
          return table!.is_owner(req.user, row[0])
            ? { decision: "allow" }
            : null;
        return { decision: "allow" };
      }
      return { decision: "allow" };
    }
    // falls through to doAuthPost, exactly like the original authorizeGetQuery
  } else {
    return table!.ownership_field_id || table!.ownership_formula
      ? { decision: "allow" }
      : null;
  }
  const allowed = await doAuthPost({ body: query, table_id: table_id!, req });
  return allowed ? { decision: "allow" } : null;
};
