/**
 * common structures used in the server and the mobile-app package
 */

import type Table from "./models/table";
import type Field from "./models/field";
import { instanceOfType } from "@saltcorn/types/common_types";
import utils from "./utils";
import expression from "./models/expression";
import type User from "./models/user";
const { isNode } = utils;
const { getState } = require("./db/state");

const disabledMobileMenus = ["Link", "Action", "Search"];

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
        is_node ? true : disabledMobileMenus.indexOf(item.type)
      )
      .map((item: any) => ({
        label: __(item.label),
        icon: item.icon,
        location: item.location,
        style: item.style || "",
        type: item.type,
        link:
          item.type === "Link" && item.url_formula
            ? expression.eval_expression(item.url, { locale, role }, user)
            : item.type === "Link"
            ? item.url
            : item.type === "Action"
            ? `javascript:${
                is_node ? "ajax" : "local"
              }_post_json('/menu/runaction/${item.action_name}')`
            : item.type === "View"
            ? is_node
              ? `/view/${encodeURIComponent(item.viewname)}`
              : `javascript:execNavbarLink('/view/${item.viewname}')`
            : item.type === "Page"
            ? is_node
              ? `/page/${encodeURIComponent(item.pagename)}`
              : `javascript:execNavbarLink('/page/${item.pagename}')`
            : undefined,
        ...(item.subitems ? { subitems: transform(item.subitems) } : {}),
      }));
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

export = {
  get_extra_menu,
  prepare_update_row,
  prepare_insert_row,
};
