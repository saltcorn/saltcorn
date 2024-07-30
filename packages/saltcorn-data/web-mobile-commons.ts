/**
 * common structures used in the server and the mobile-app package
 */

import Table from "./models/table";
import type Field from "./models/field";
import { instanceOfType } from "@saltcorn/types/common_types";
import utils from "./utils";
import expression from "./models/expression";
import type User from "./models/user";
const { isNode, applyAsync } = utils;
const { text } = require("@saltcorn/markup/tags");
const { getState } = require("./db/state");
const {
  readState,
  add_free_variables_to_joinfields,
  calcfldViewConfig,
} = require("@saltcorn/data/plugin-helper");

const disabledMobileMenus = ["Action", "Search"];

/**
 * Get extra menu
 * @param role
 * @param __ translation function
 * @returns array of extra menu items
 */
const get_extra_menu = (
  role: number,
  __: (str: string) => string,
  user?: User,
  locale?: string
) => {
  let cfg = getState().getConfig("unrolled_menu_items", []);
  if (!cfg || cfg.length === 0) {
    cfg = getState().getConfig("menu_items", []);
  }
  const is_node = isNode();
  const transform = (items: any) =>
    items
      .filter((item: any) => role <= +item.min_role)
      .filter((item: any) =>
        is_node
          ? true
          : disabledMobileMenus.indexOf(item.type) < 0 &&
            !item.disable_on_mobile
      )
      .map((item: any) => {
        const wrapUrl = (url: string) => {
          if (item.in_modal && is_node)
            return `javascript:ajax_modal('${url}')`;
          if (item.in_modal) return `javascript:mobile_modal('${url}')`;
          return url;
        };
        return {
          label: __(item.label),
          icon: item.icon,
          location: item.location,
          style: item.style || "",
          target_blank: item.target_blank,
          in_modal: item.in_modal,
          type: item.type,
          mobile_item_html: item.mobile_item_html,
          tooltip: item.tooltip,
          link:
            item.type === "Link" && item.url_formula
              ? expression.eval_expression(item.url, { locale, role }, user)
              : item.type === "Link"
              ? is_node
                ? wrapUrl(item.url)
                : `javascript:execNavbarLink('${item.url}')`
              : item.type === "Action"
              ? `javascript:${
                  is_node ? "ajax" : "local"
                }_post_json('/menu/runaction/${item.action_name}')`
              : item.type === "View"
              ? is_node
                ? wrapUrl(`/view/${encodeURIComponent(item.viewname)}`)
                : `javascript:execNavbarLink('/view/${item.viewname}')`
              : item.type === "Page"
              ? is_node
                ? wrapUrl(`/page/${encodeURIComponent(item.pagename)}`)
                : `javascript:execNavbarLink('/page/${item.pagename}')`
              : item.type === "Page Group"
              ? is_node
                ? wrapUrl(`/page/${encodeURIComponent(item.page_group)}`)
                : `javascript:execNavbarLink('/page/${item.page_group}')`
              : undefined,
          ...(item.subitems ? { subitems: transform(item.subitems) } : {}),
        };
      });
  return transform(cfg);
};

/**
 * take a row from a form, and prepare it for a db update
 * needed for tabulator
 * @param table
 * @param row output parameter
 * @param id
 * @returns
 */
const prepare_update_row = async (table: Table, row: any, id: number) => {
  const fields = table.getFields();
  let errors = [];
  for (const k of Object.keys(row)) {
    const field = fields.find((f: any) => f.name === k);
    if (!field && k.includes(".")) {
      const [fnm, jkey] = k.split(".");
      const jfield = fields.find((f: any) => f.name === fnm);
      if (instanceOfType(jfield?.type) && jfield?.type?.name === "JSON") {
        if (typeof row[fnm] === "undefined") {
          const dbrow = await table.getRow({ [table.pk_name]: id });
          if (dbrow) row[fnm] = dbrow[fnm] || {};
        }
        row[fnm][jkey] = row[k];
        delete row[k];
      }
    } else if (!field || field.calculated) {
      delete row[k];
    } else if (
      field?.type &&
      instanceOfType(field?.type) &&
      field.type.validate
    ) {
      const vres = field.type.validate(field.attributes || {})(row[k]);
      if (vres.error) {
        errors.push(`${k}: ${vres.error}`);
      }
    }
  }
  return errors;
};

/**
 * take a row from a form, and prepare it for a db insert
 * needed for tabulator
 * @param row
 * @param fields
 * @returns
 */
const prepare_insert_row = async (row: any, fields: Field[]) => {
  let errors: any = [];
  Object.keys(row).forEach((k) => {
    const field = fields.find((f: Field) => f.name === k);
    if (!field || field.calculated || row[k] === undefined) {
      delete row[k];
      return;
    }
    if (field.type && instanceOfType(field.type) && field.type.validate) {
      const vres = field.type.validate(field.attributes || {})(row[k]);
      if (vres.error) {
        errors.push(`${k}: ${vres.error}`);
      }
    }
  });
  fields.forEach((field: Field) => {
    if (
      field.required &&
      !field.primary_key &&
      typeof row[field.name] === "undefined" &&
      !field.attributes.default
    ) {
      errors.push(`${field.name}: required`);
    }
  });
  return errors;
};

// TODO use this in the server route as well
/**
 * @param req express or mocked mobile requese
 * @param res express or mocked mobile response
 * @param param2 table field and fieldview
 * @returns void and writes to res
 */
const show_calculated_fieldview = async (
  req: any,
  res: any,
  {
    tableName,
    fieldName,
    fieldview,
  }: { tableName: string; fieldName: string; fieldview: string }
) => {
  // const { tableName, fieldName, fieldview } = req.params;
  const table = Table.findOne({ name: tableName });
  if (!table) throw new Error(`Table ${tableName} not found`);
  const role = req.user && req.user.id ? req.user.role_id : 100;

  const fields = table.getFields();
  let row = { ...req.body };
  if (row && Object.keys(row).length > 0) readState(row, fields);

  //need to get join fields from ownership into row
  const joinFields = {};
  if (table.ownership_formula && role > table.min_role_read) {
    const freeVars = expression.freeVariables(table.ownership_formula);
    add_free_variables_to_joinfields(freeVars, joinFields, fields);
  }
  //console.log(joinFields, row);
  const id = req.query.id || row.id;
  if (id) {
    let [dbrow] = await table.getJoinedRows({ where: { id }, joinFields });
    row = { ...dbrow, ...row };
    //prevent overwriting ownership field
    if (table.ownership_field_id) {
      const ofield = fields.find((f) => f.id === table.ownership_field_id);
      if (!ofield) throw new Error("ownership field not found");
      row[ofield.name] = dbrow[ofield.name];
    }
  } else {
    //may need to add joinfields
    for (const { ref } of <any>Object.values(joinFields)) {
      if (row[ref]) {
        const field = fields.find((f) => f.name === ref);
        if (!field) throw new Error(`field ${ref} not found`);
        const reftable = Table.findOne({ name: field.reftable_name });
        if (!reftable)
          throw new Error(`reftable ${field.reftable_name} not found`);
        const refFields = await reftable.getFields();

        const joinFields = {};
        if (reftable.ownership_formula && role > reftable.min_role_read) {
          const freeVars = expression.freeVariables(reftable.ownership_formula);
          add_free_variables_to_joinfields(freeVars, joinFields, refFields);
        }
        const [refRow] = await reftable.getJoinedRows({
          where: { id: row[ref] },
          joinFields,
        });
        if (
          role <= reftable.min_role_read ||
          (req.user && reftable.is_owner(req.user, refRow))
        ) {
          row[ref] = refRow;
        }
      }
    }
  }
  if (
    role > table.min_role_read &&
    !(req.user && table.is_owner(req.user, row))
  ) {
    //console.log("not owner", row, table.is_owner(req.user, row));
    res.status(401).send("");
    return;
  }
  if (fieldName.includes(".")) {
    //join field
    const kpath = fieldName.split(".");
    if (kpath.length === 2 && row[kpath[0]]) {
      const field = fields.find((f) => f.name === kpath[0]);
      if (!field) throw new Error(`field ${kpath[0]} not found`);
      const reftable = Table.findOne({ name: field.reftable_name });
      if (!reftable)
        throw new Error(`reftable ${field.reftable_name} not found`);
      const refFields = await reftable.getFields();
      const targetField = refFields.find((f) => f.name === kpath[1]);
      if (!targetField) throw new Error(`field ${kpath[1]} not found`);
      //console.log({ kpath, fieldview, targetField });
      const q = { [reftable.pk_name]: row[kpath[0]] };
      const joinFields = {};
      if (reftable.ownership_formula && role > reftable.min_role_read) {
        const freeVars = expression.freeVariables(reftable.ownership_formula);
        add_free_variables_to_joinfields(freeVars, joinFields, refFields);
      }
      const [refRow] = await reftable.getJoinedRows({ where: q, joinFields });
      if (
        role > reftable.min_role_read &&
        !(req.user && reftable.is_owner(req.user, refRow))
      ) {
        //console.log("not jointable owner", refRow);

        res.status(401).send("");
        return;
      }
      let fv;
      if (targetField.type === "Key") {
        fv = getState().keyFieldviews[fieldview];
        if (!fv) {
          const reftable2 = Table.findOne({
            name: targetField.reftable_name,
          });
          if (!reftable2)
            throw new Error(`reftable ${targetField.reftable_name} not found`);
          const refRow2 = await reftable2.getRow({
            [reftable2.pk_name]: refRow[kpath[1]],
          });
          if (refRow2) {
            res.send(text(`${refRow2[targetField.attributes.summary_field]}`));
          } else {
            res.send("");
          }
          return;
        }
      } else {
        // @ts-ignore
        fv = targetField.type.fieldviews[fieldview];
        if (!fv)
          fv =
            // @ts-ignore
            targetField.type.fieldviews.show ||
            // @ts-ignore
            targetField.type.fieldviews.as_text;
      }

      const configuration = req.query;
      let configFields = [];
      if (fv.configFields)
        configFields = await applyAsync(fv.configFields, targetField);
      readState(configuration, configFields);
      res.send(fv.run(refRow[kpath[1]], req, configuration));
      return;
    } else if (row[kpath[0]]) {
      let oldTable = table;
      let oldRow = row;
      for (const ref of kpath) {
        const ofields = await oldTable.getFields();
        const field = ofields.find((f) => f.name === ref);
        if (!field) throw new Error(`field ${ref} not found`);
        if (field.is_fkey) {
          const reftable = Table.findOne({ name: field.reftable_name });
          if (!reftable)
            throw new Error(`reftable ${field.reftable_name} not found`);
          if (!oldRow[ref]) break;
          if (role > reftable.min_role_read) {
            res.status(401).send("");
            return;
          }
          const q = { [reftable.pk_name]: oldRow[ref] };
          oldRow = await reftable.getRow(q);
          oldTable = reftable;
        }
      }
      if (oldRow) {
        const value = oldRow[kpath[kpath.length - 1]];
        res.send(value);
        return;
      }
    }
    res.send("");
    return;
  }

  const field = fields.find((f) => f.name === fieldName);
  if (!field) throw new Error(`field ${fieldName} not found`);
  const formula = field.expression;

  let result;
  try {
    if (!field.calculated) {
      result = row[field.name];
    } else {
      if (typeof formula !== "string")
        throw new Error("no formula of type string");
      if (field.stored) {
        const f = expression.get_async_expression_function(formula, fields);
        result = await f(row);
      } else {
        const f = expression.get_expression_function(formula, fields);
        result = f(row);
      }
    }
    // @ts-ignore
    const fv = field.type.fieldviews[fieldview];
    if (!fv) res.send(text(result));
    else res.send(fv.run(result));
  } catch (e: any) {
    return res.status(400).send(`Error: ${e.message}`);
  }
};

export = {
  get_extra_menu,
  prepare_update_row,
  prepare_insert_row,
  show_calculated_fieldview,
};
