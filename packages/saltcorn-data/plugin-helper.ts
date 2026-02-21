/**
 * Plugin-helper
 * @category saltcorn-data
 * @module plugin-helper
 */
import View from "./models/view";
import Field from "./models/field";
import Table from "./models/table";
import Trigger from "./models/trigger";
import Tag from "./models/tag";

const { getState } = require("./db/state");
import db from "./db";
const { button, a, text, i, text_attr } = require("@saltcorn/markup/tags");
const mjml = require("@saltcorn/markup/mjml-tags");
const PlainDate = require("@saltcorn/plain-date");
const { show_icon_and_label } = require("@saltcorn/markup/layout_utils");
const {
  Relation,
  RelationType,
  ViewDisplayType,
  parseRelationPath,
  buildRelationPath,
} = require("@saltcorn/common-code");
import utils from "./utils";
const {
  applyAsync,
  InvalidConfiguration,
  mergeActionResults,
  structuredClone,
  mergeIntoWhere,
  validSqlId,
  isNode,
} = utils;
import expression from "./models/expression";
const {
  jsexprToWhere,
  freeVariables,
  add_free_variables_to_joinfields,
  eval_expression,
  freeVariablesInInterpolation,
  add_free_variables_to_aggregations,
} = expression;
import layout from "./models/layout";
const { traverseSync } = layout;
import { sqlFun, sqlBinOp } from "@saltcorn/db-common/internal";
import type { Where, Row } from "@saltcorn/db-common/internal";
import type { GenObj } from "@saltcorn/types/common_types";
import type { AbstractUser } from "@saltcorn/types/model-abstracts/abstract_user";
import type { FieldLike } from "@saltcorn/types/base_types";

/**
 *
 * @param {string} url0
 * @param {string} label
 * @param {boolean} [popup]
 * @param {string} [link_style = ""]
 * @param {string} [link_size = ""]
 * @param {string} [link_icon = ""]
 * @param {string} [textStyle = ""]
 * @param {string} [link_bgcol]
 * @param {string} [link_bordercol]
 * @param {string} [link_textcol]
 * @param extraClass
 * @param extraState
 * @param link_target_blank
 * @returns {button|a}
 */
const link_view = (
  url0: string,
  label: string,
  popup: boolean | string | GenObj | undefined,
  link_style: string = "",
  link_size: string = "",
  link_icon: string = "",
  textStyle: string = "",
  link_bgcol?: string,
  link_bordercol?: string,
  link_textcol?: string,
  extraClass?: string | false,
  extraState?: string,
  link_target_blank?: boolean,
  label_attr?: boolean, // for sorting
  link_title?: string,
  link_class?: string,
  req?: GenObj,
  in_row_click?: boolean
): string => {
  let style =
    link_style === "btn btn-custom-color"
      ? `background-color: ${link_bgcol || "#000000"};border-color: ${
          link_bordercol || "#000000"
        }; color: ${link_textcol || "#000000"}`
      : null;
  let url = url0;
  if (extraState) {
    if (url.includes("?")) url = `${url0}&${extraState}`;
    else url = `${url0}?${extraState}`;
  }
  if (popup) {
    let ajaxOpts = "";
    if (typeof popup === "object")
      ajaxOpts = `, {${Object.entries(popup)
        .map(([k, v]) => `'${k}': '${v}'`)
        .join(",")}}`;
    const stopProp = in_row_click ? ";event.stopPropagation()" : "";
    if (!link_style)
      return a(
        {
          ...(label_attr ? { "data-link-label": text_attr(label) } : {}),
          href: `javascript:void(0)`,
          onclick: isNode()
            ? `ajax_modal('${url}'${ajaxOpts})` + stopProp
            : `mobile_modal('${url}'${ajaxOpts})` + stopProp,
          style,
          title: link_title,
          class: [textStyle, link_style, link_size, extraClass, link_class],
        },
        show_icon_and_label(link_icon, label)
      );
    else
      return button(
        {
          ...(label_attr ? { "data-link-label": text_attr(label) } : {}),
          class: [
            textStyle,
            link_style,
            link_size,
            !link_style && "btn btn-link",
            extraClass,
            link_class,
            "d-inline-block",
          ],
          title: link_title,
          type: "button",
          onClick: isNode()
            ? `ajax_modal('${url}'${ajaxOpts})` + stopProp
            : `mobile_modal('${url}')` + stopProp,
          style,
        },
        show_icon_and_label(link_icon, label)
      );
  } else if (req?.generate_email && (link_style || "").includes("btn")) {
    return mjml.emailButton(
      {
        href: url,
        title: link_title,
        btnStyle: link_style,
        style,
      },
      label
    );
  } else
    return a(
      {
        ...(label_attr ? { "data-link-label": text_attr(label) } : {}),
        href: url,
        class: [
          textStyle,
          link_style,
          link_size,
          extraClass,
          link_class,
          link_style && link_style.includes("btn") && "d-inline-block",
        ],
        style,
        title: link_title,
        onclick: in_row_click ? "event.stopPropagation()" : undefined,
        target: link_target_blank ? "_blank" : undefined,
      },
      show_icon_and_label(link_icon, label)
    );
};

/**
 * @function
 * @param {object} [state]
 * @returns {string}
 */
const stateToQueryString = (state: GenObj, include_id?: boolean): string => {
  if (!state || Object.keys(state).length === 0) return "";
  const prim = (x: any) => {
    if (x?.toISOString) return x.toISOString();
    else return x;
  };
  const bounded = (k: string, v: any) => {
    const parts = [];
    if (v.gt)
      parts.push(
        `_gt${v.equal ? "e" : ""}_${encodeURIComponent(k)}=${encodeURIComponent(
          `${prim(v.gt)}`
        )}`
      );
    if (v.lt)
      parts.push(
        `_lt${v.equal ? "e" : ""}_${encodeURIComponent(k)}=${encodeURIComponent(
          `${prim(v.lt)}`
        )}`
      );

    return parts.join("&");
  };
  return (
    "?" +
    (Object.entries(state) as [string, any][])
      .map(([k, v]: [string, any]) =>
        v?.gt || v?.lt
          ? bounded(k, v)
          : Array.isArray(v) && k !== "_relation_path_"
            ? v
                .map(
                  (val) =>
                    `${encodeURIComponent(k)}=${encodeURIComponent(
                      `${prim(val)}`
                    )}`
                )
                .join("&")
            : (k === "id" && !include_id) || typeof v === "undefined"
              ? null
              : `${encodeURIComponent(k)}=${encodeURIComponent(
                  k === "_relation_path_" && typeof v !== "string"
                    ? queryToString(v)
                    : prim(v)
                )}`
      )
      .filter((s) => !!s)
      .join("&")
  );
};

/**
 * @function
 * @param {Field[]} fields
 * @param mode
 * @param don't follow references to other tables (type === "Key")
 * @returns {object}
 */
const calcfldViewOptions = (
  fields: Field[],
  mode: string,
  noFollowKeys: boolean = false
): {
  field_view_options: Record<string, string[]>;
  handlesTextStyle: Record<string, string[]>;
  blockDisplay: Record<string, string[]>;
} => {
  const isEdit = mode === "edit";
  const isFilter = mode === "filter";
  let fvs: Record<string, any> = {};
  const handlesTextStyle: Record<string, any[]> = {};
  const blockDisplay: Record<string, any[]> = {};
  fields.forEach((f) => {
    handlesTextStyle[f.name] = [];
    blockDisplay[f.name] = [];
    if (f.type === "File") {
      if (!isEdit && !isFilter)
        fvs[f.name] = (Object.entries(getState().fileviews) as [string, any][])
          .filter(([k, v]: [string, any]) => !v.isEdit)
          .map(([k, v]: [string, any]) => k);
      else
        fvs[f.name] = (
          Object.entries(getState().fileviews) as [string, any][]
        ).map(([k, v]: [string, any]) => k);
    } else if (f.type === "Key" && !noFollowKeys) {
      if (isEdit) fvs[f.name] = Object.keys(getState().keyFieldviews);
      else if (isFilter) {
        fvs[f.name] = Object.keys(getState().keyFieldviews);
      } else {
        fvs[f.name] = ["show"];
      }
      if (f.reftable && f.reftable.fields) {
        const { field_view_options } = calcfldViewOptions(
          f.reftable.fields,
          isEdit ? "show" : mode
        );
        for (const jf of f.reftable.fields) {
          fvs[`${f.name}.${jf.name}`] = field_view_options[jf.name];
          if (jf.is_fkey) {
            const jtable = Table.findOne({ name: jf.reftable_name });
            if (jtable && jtable.fields) {
              const jfieldOpts = calcfldViewOptions(
                jtable.fields,
                isEdit ? "show" : mode
              );
              for (const jf2 of jtable.fields) {
                fvs[`${f.name}.${jf.name}.${jf2.name}`] =
                  jfieldOpts.field_view_options[jf2.name];
                if (jf2.is_fkey) {
                  const jtable2 = Table.findOne({ name: jf2.reftable_name });
                  if (jtable2 && jtable2.fields) {
                    const jfield2Opts = calcfldViewOptions(
                      jtable2.fields,
                      isEdit ? "show" : mode
                    );
                    for (const jf3 of jtable2.fields) {
                      fvs[`${f.name}.${jf.name}.${jf2.name}.${jf3.name}`] =
                        jfield2Opts.field_view_options[jf3.name];
                    }
                  }
                }
              }
            }
          }
        }
      }

      (Object.entries(getState().keyFieldviews) as [string, any][]).forEach(
        ([k, v]) => {
          if (v && v.handlesTextStyle) handlesTextStyle[f.name].push(k);
          if (v && v.blockDisplay) blockDisplay[f.name].push(k);
        }
      );
    } else if (f.type && (f.type as any).fieldviews) {
      const tfvs = (
        Object.entries((f.type as any).fieldviews) as [string, any][]
      ).filter(
        ([k, fv]: [string, any]) =>
          (isFilter && f.calculated && f.stored
            ? fv.isEdit || fv.isFilter
            : f.calculated
              ? !fv.isEdit
              : !fv.isEdit || isEdit || isFilter) &&
          !(mode !== "list" && fv.expandColumns)
      );
      let tfvs_ordered: [string, any][] = [];
      if (isEdit) {
        tfvs_ordered = [
          ...tfvs.filter(([k, fv]: [string, any]) => fv.isEdit),
          ...tfvs.filter(
            ([k, fv]: [string, any]) => !fv.isEdit && !fv.isFilter
          ),
        ];
      } else if (isFilter) {
        tfvs_ordered = [
          ...tfvs.filter(([k, fv]: [string, any]) => fv.isFilter),
          ...tfvs.filter(([k, fv]: [string, any]) => fv.isEdit),
        ];
      } else
        tfvs_ordered = tfvs.filter(([k, fv]: [string, any]) => !fv.isFilter);
      fvs[f.name] = tfvs_ordered.map(([k, fv]: [string, any]) => {
        if (fv && fv.handlesTextStyle) handlesTextStyle[f.name].push(k);
        if (fv && fv.blockDisplay) blockDisplay[f.name].push(k);
        return k;
      });
    }
  });
  return { field_view_options: fvs, handlesTextStyle, blockDisplay };
};

/**
 * create viewoptions (as_text, as_link, show, ...) for fields
 * with a foreign_key to 'table' from another table
 * @param table table of the viewtemplate
 * @param viewtemplate name of the viewtemplate
 * @returns an object assigning the path (table.foreign_key->field) to viewoptions
 */
const calcrelViewOptions = async (
  table: Table,
  viewtemplate: string
): Promise<Record<string, string[]>> => {
  const rel_field_view_options: Record<string, any> = {};
  for (const {
    relationTable,
    relationField,
  } of await table.get_relation_data()) {
    const { field_view_options } = calcfldViewOptions(
      await relationTable.getFields(),
      viewtemplate,
      true
    );
    for (const [k, v] of Object.entries(field_view_options)) {
      rel_field_view_options[
        `${relationTable.name}.${relationField.name}->${k}`
      ] = v;
    }
  }
  return rel_field_view_options;
};

/**
 * @function
 * @param {Field[]} fields
 * @param isEdit
 * @param nrecurse
 * @returns {Promise<object>}
 */
const calcfldViewConfig = async (
  fields: Field[],
  isEdit: boolean,
  nrecurse: number = 2,
  mode?: string,
  req?: GenObj
): Promise<Record<string, any>> => {
  const fieldViewConfigForms: Record<string, any> = {};
  for (const f of fields) {
    f.fill_table();
    fieldViewConfigForms[f.name] = {};
    const fieldviews =
      f.type === "Key"
        ? getState().keyFieldviews
        : f.type === "File"
          ? getState().fileviews
          : (f.type && (f.type as any).fieldviews) || {};
    for (const [nm, fv] of Object.entries(fieldviews) as [string, any][]) {
      if (fv.configFields)
        fieldViewConfigForms[f.name][nm] = await applyAsync(
          fv.configFields,
          f,
          { mode, req, ...(req?.__ ? { __: req.__ } : {}) }
        );
    }
    if (f.type === "Key") {
      if (f.reftable_name && nrecurse > 0) {
        const reftable = Table.findOne({ name: f.reftable_name });
        if (reftable && reftable.fields) {
          const joinedCfg = await calcfldViewConfig(
            reftable.fields,
            isEdit,
            nrecurse - 1,
            mode,
            req
          );
          Object.entries(joinedCfg).forEach(([nm, o]) => {
            fieldViewConfigForms[`${f.name}.${nm}`] = o;
          });
        }
      }
    }
  }
  return fieldViewConfigForms;
};

/**
 * helper for 'get_inbound_relation_opts'
 * @param {Table} targetTbl table to check for an Inbound relation
 * @param {Table} srcTable table of the top view
 * @param {string[]} levelPath inbound levels already visited
 * @param {*} tableCache helper cache so that we don't have to call Table.findOne() all the time
 * @param {*} fieldCache helper cache so that we don't have to call Field.find() all the time
 * @returns
 */
const get_inbound_path_suffixes = async (
  targetTbl: Table,
  srcTable: Table,
  levelPath: { tbl: string; fk: string }[],
  tableCache: Record<number, Table>,
  fieldCache: Record<string, Field[]>
): Promise<string[]> => {
  const result = [];
  // fks from targetTbl
  for (const fkToRelTbl of targetTbl.getForeignKeys()) {
    const relTblName = fkToRelTbl.reftable_name;
    if (relTblName === srcTable.name) continue;
    // inbounds to the target of fk
    const inboundFks = fieldCache[relTblName!]
      ? fieldCache[relTblName!].filter(
          (field) =>
            field.table_id !== targetTbl.id &&
            !levelPath.find(
              (val) => val.tbl === targetTbl.name && val.fk === fkToRelTbl.name
            )
        )
      : [];
    for (const inboundFk of inboundFks) {
      const inboundTable = tableCache[inboundFk.table_id!];
      if (inboundTable) {
        const relTblRefs = inboundTable
          .getForeignKeys()
          .filter((f) => f.reftable_name === relTblName);
        // the inbound comes from 'srcTable'
        if (inboundTable.id === srcTable.id) {
          const levels = levelPath.map((val) => val.fk).join(".");
          for (const inboundRelTblKey of relTblRefs) {
            const newSuffix = `.${srcTable.name}.${inboundRelTblKey.name}.${
              targetTbl.name
            }$${fkToRelTbl.name}${levels ? `.${levels}` : ""}`;
            if (result.indexOf(newSuffix) === -1) {
              result.push(newSuffix);
            }
          }
        } else {
          // check if there are refs to 'srcTable'
          const srcRefs = inboundTable
            .getForeignKeys()
            .filter((f) => f.reftable_name === srcTable.name);
          for (const srcTblRef of srcRefs) {
            for (const relTblRef of relTblRefs) {
              if (levelPath.length > 0) {
                let levels = `${levelPath[0].tbl}$${fkToRelTbl.name}`;
                for (let i = 0; i < levelPath.length; i++) {
                  levels = `${levels}.${levelPath[i].fk}`;
                }
                const newSuffix =
                  `.${srcTable.name}.${inboundTable.name}$${srcTblRef.name}.${relTblRef.name}.` +
                  `${levels}`;
                if (result.indexOf(newSuffix) === -1) {
                  result.push(newSuffix);
                }
              } else {
                const newSuffix = `.${srcTable.name}.${inboundTable.name}$${srcTblRef.name}.${relTblRef.name}.${targetTbl.name}$${fkToRelTbl.name}`;
                if (result.indexOf(newSuffix) === -1) {
                  result.push(newSuffix);
                }
              }
            }
          }
        }
      }
    }
  }
  return result;
};

const tableFieldCache = async (): Promise<{
  tableIdCache: Record<number, Table>;
  tableNameCache: Record<string, Table>;
  fieldCache: Record<string, Field[]>;
}> => {
  const tableIdCache: Record<number, Table> = {};
  const tableNameCache: Record<string, Table> = {};
  for (const table of await Table.find({}, { cached: true })) {
    if (table.id != null) tableIdCache[table.id] = table;
    tableNameCache[table.name] = table;
  }
  const fieldCache: Record<string, Field[]> = {};
  for (const field of await Field.find({}, { cached: true })) {
    if (field.reftable_name) {
      if (!fieldCache[field.reftable_name])
        fieldCache[field.reftable_name] = [];
      fieldCache[field.reftable_name].push(field);
    }
  }
  return { tableIdCache, tableNameCache, fieldCache };
};

/**
 * search for relations where an in select to source is possible
 * @param {Table} source
 * @param {string} viewname
 * @returns
 */
const get_inbound_relation_opts = async (
  source: Table,
  viewname: string,
  cache?: {
    tableIdCache: Record<number, Table>;
    tableNameCache: Record<string, Table>;
    fieldCache: Record<string, Field[]>;
  }
): Promise<{ path: string; views: View[] }[]> => {
  const { tableIdCache, fieldCache } = cache ? cache : await tableFieldCache();
  const allTables = await Table.find({}, { cached: true });
  const result: { path: string; views: View[] }[] = [];
  const search = async (
    table: Table,
    path: { tbl: string; fk: string }[],
    rootTable: Table,
    visited: Set<string>
  ) => {
    const visitedCopy = new Set(visited);
    const suffixes = await get_inbound_path_suffixes(
      table,
      source,
      path,
      tableIdCache,
      fieldCache
    );
    if (suffixes.length > 0) {
      const views = await View.find_table_views_where(
        rootTable.id!,
        ({ state_fields, viewrow }) =>
          viewrow.name !== viewname &&
          !state_fields.some((sf) => sf.name === "id")
      );
      for (const suffix of suffixes) {
        result.push({ path: suffix, views });
      }
    }
    if (!visitedCopy.has(table.name)) {
      visitedCopy.add(table.name);
      for (const inboundFk of fieldCache[table.name] || []) {
        if (inboundFk.table_id === table.id) continue;
        const inboundTbl = tableIdCache[inboundFk.table_id!];
        await search(
          inboundTbl,
          [{ tbl: inboundTbl.name, fk: inboundFk.name }, ...path],
          rootTable,
          visitedCopy
        );
      }
    }
  };
  // search in reverse,
  // start with the target (table of the subview) to the relation source
  for (const table of allTables) {
    const visited = new Set<string>();
    await search(table, [], table, visited);
  }
  return result;
};

/**
 * Get all relation options where source has a key to another table (refTable)
 * and refTable has a key to source.
 * Otherwise one could use a OneToOneShow from refTable.
 * @param {Table} source
 * @param {string} viewname name of the topview
 * @returns viewnames mapped to arrays of Inbound options
 */
const get_inbound_self_relation_opts = async (
  source: Table,
  viewname: string
): Promise<{ path: string; views: View[] }[]> => {
  const fields = await Field.find(
    {
      reftable_name: source.name,
      is_unique: true,
    },
    { cached: true }
  );
  const result = [];
  const targetFields = source.getForeignKeys();
  for (const field of fields) {
    const refTable = Table.findOne({ id: field.table_id });
    const fromTargetToRef = targetFields.filter(
      (field) => field.reftable_name === refTable?.name
    );
    if (fromTargetToRef.length > 0) {
      const views = await View.find_table_views_where(
        source,
        ({ state_fields, viewrow }) =>
          viewrow.name !== viewname &&
          state_fields.some((sf) => sf.name === "id")
      );
      for (const toRef of fromTargetToRef) {
        result.push({
          path: `.${source.name}.${toRef.name}.${field.name}`,
          views,
        });
      }
    }
  }
  return result;
};

/**
 * Get all relations where a many to many relation through a join table is possible
 * @param {Table} source Top view table
 * @param {string} viewname Top view
 * @param {object} cache lookup cache for tables and views (can be null)
 * @param {string[]} path path to the current table
 * @returns an array with the relation paths and the matching views
 */
const get_many_to_many_relation_opts = async (
  source: Table,
  viewname: string,
  cache: {
    tableIdCache: Record<number, Table>;
    tableNameCache: Record<string, Table>;
    fieldCache: Record<string, Field[]>;
  },
  path: string[]
): Promise<{ path: string; views: View[] }[]> => {
  const result = [];
  const { tableIdCache, tableNameCache, fieldCache } = cache
    ? cache
    : await tableFieldCache();
  for (const jTblToSource of fieldCache[source.name] || []) {
    const visitedFks = new Set();
    const joinTbl = tableIdCache[jTblToSource.table_id!];
    const jTblFks = joinTbl
      .getForeignKeys()
      .filter((f) => f.id !== jTblToSource.id);
    for (const jTblToTarget of jTblFks) {
      if (visitedFks.has(jTblToTarget.id)) continue;
      visitedFks.add(jTblToTarget.id);
      const targetTbl = tableNameCache[jTblToTarget.reftable_name!];
      const views = await View.find_table_views_where(
        targetTbl,
        ({ state_fields, viewrow }) =>
          viewrow.name !== viewname && state_fields.every((sf) => !sf.required)
      );
      result.push({
        path: `${path.join(".")}.${joinTbl.name}$${jTblToSource.name}.${
          jTblToTarget.name
        }`,
        views,
      });

      const layerFks = fieldCache[targetTbl.name];
      for (const layerFk of layerFks) {
        if (visitedFks.has(layerFk.id)) continue;
        visitedFks.add(layerFk.id);
        const layerTbl = tableIdCache[layerFk.table_id!];
        const layerViews = await View.find_table_views_where(
          layerTbl,
          ({ state_fields, viewrow }) =>
            viewrow.name !== viewname &&
            state_fields.every((sf) => !sf.required)
        );
        result.push({
          path: `${path.join(".")}.${joinTbl.name}$${jTblToSource.name}.${
            jTblToTarget.name
          }.${layerTbl.name}$${layerFk.name}`,
          views: layerViews,
        });
      }
    }
  }
  if (path.length < 2) {
    const sourceFks = source.getForeignKeys();
    for (const sourceFk of sourceFks) {
      const nextTbl = tableNameCache[sourceFk.reftable_name!];
      path.push(sourceFk.name);
      result.push(
        ...(await get_many_to_many_relation_opts(
          nextTbl,
          viewname,
          cache,
          path
        ))
      );
    }
  }
  return result;
};

/**
 * @function
 * @param {Table|object} table
 * @param {string} viewname
 * @returns {Promise<{link_view_opts: object[]}>}
 */
const get_link_view_opts = async (
  table: Table,
  viewname: string,
  accept: (v: View) => boolean = () => true
): Promise<{
  link_view_opts: any[];
  view_name_opts: any[];
  view_relation_opts: Record<string, any[]>;
}> => {
  const own_link_views = await View.find_possible_links_to_table(table);
  const all_views = await View.find({}, { cached: true });
  const all_tables = await Table.find({}, { cached: true });
  const table_id_to_name: Record<number, string> = {};
  all_tables.forEach((t) => {
    if (t.id != null) table_id_to_name[t.id] = t.name;
  });
  const view_name_opts = all_views.filter(accept).map((v) => ({
    label: `${v.name} [${v.viewtemplate} ${
      (v.table_id != null && table_id_to_name[v.table_id]) || ""
    }]`,
    name: v.name,
    table: (v.table_id != null && table_id_to_name[v.table_id]) || "",
  }));
  const view_relation_opts: Record<string, any[]> = {};
  const link_view_opts: any[] = [];
  const push_view_option = ({
    name,
    label,
    view,
    relation,
  }: {
    name: string;
    label: string;
    view: string;
    relation: string;
  }) => {
    link_view_opts.push({ name, label });
    if (!view_relation_opts[view]) view_relation_opts[view] = [];
    view_relation_opts[view].push({ value: name, label: relation });
  };
  own_link_views.forEach((v) => {
    push_view_option({
      view: v.name,
      label: `${v.name} [${v.viewtemplate} ${table.name}]`,
      name: `Own:${v.name}`,
      relation: table.name,
    });
  });
  const link_view_opts_push_legacy = (o: any) => {
    if (!link_view_opts.map((v) => v.name).includes(o.name))
      push_view_option(o);
  };
  const link_view_opts_push = (o: any) => {
    if (
      !view_relation_opts[o.view] ||
      !view_relation_opts[o.view].find(({ value }) => value === o.name)
    )
      push_view_option(o);
  };
  const child_views = await get_child_views(table, viewname);
  for (const {
    relation,
    related_table,
    through,
    throughTable,
    views,
  } of child_views) {
    for (const view of views) {
      if (through && throughTable) {
        link_view_opts_push_legacy({
          view: view.name,
          name: `ChildList:${view.name}.${throughTable.name}.${through.name}.${related_table.name}.${relation.name}`,
          label: `${view.name} [${view.viewtemplate} ${related_table.name}.${relation.name}.${through.name}]`,
          relation: `${related_table.name}.${relation.name}.${through.name}`,
        });
      } else {
        link_view_opts_push_legacy({
          view: view.name,
          name: `ChildList:${view.name}.${related_table.name}.${relation.name}`,
          label: `${view.name} [${view.viewtemplate} ${related_table.name}.${relation.name}]`,
          relation: `${related_table.name}.${relation.name}`,
        });
      }
    }
  }

  const parent_views = await get_parent_views(table, viewname);
  for (const { relation, related_table, views } of parent_views) {
    for (const view of views) {
      link_view_opts_push_legacy({
        view: view.name,
        name: `ParentShow:${view.name}.${related_table.name}.${relation.name}`,
        label: `${view.name} [${view.viewtemplate} ${relation.name}.${related_table.name}]`,
        relation: `${relation.name}.${related_table.name}`,
      });
    }
  }
  const onetoone_views = await get_onetoone_views(table, viewname);
  for (const { relation, related_table, views } of onetoone_views) {
    for (const view of views) {
      link_view_opts_push_legacy({
        view: view.name,
        name: `OneToOneShow:${view.name}.${related_table.name}.${relation.name}`,
        label: `${view.name} [${view.viewtemplate} ${related_table.name}.${relation.label}]`,
        relation: `${related_table.name}.${relation.label}`,
      });
    }
  }
  const independent_views = await View.find_all_views_where(
    ({ state_fields }) => !state_fields.some((sf) => sf.required)
  );
  independent_views.forEach((view) => {
    link_view_opts_push_legacy({
      view: view.name,
      label: `${view.name} [${view.viewtemplate}]`,
      name: `Independent:${view.name}`,
      relation: "None",
    });
  });
  const cache = await tableFieldCache();
  const inbound_rel_opts = await get_inbound_relation_opts(
    table,
    viewname,
    cache
  );
  for (const { path, views } of inbound_rel_opts) {
    for (const view of views) {
      link_view_opts_push({
        view: view.name,
        label: `${view.name} [${view.viewtemplate} ${table.name}]`,
        name: path,
        relation: path,
      });
    }
  }

  const self_inbounds = await get_inbound_self_relation_opts(table, viewname);
  for (const { path, views } of self_inbounds) {
    for (const view of views) {
      link_view_opts_push({
        view: view.name,
        label: `${view.name} [${view.viewtemplate} ${table.name}]`,
        name: path,
        relation: path,
      });
    }
  }

  const many_to_many = await get_many_to_many_relation_opts(
    table,
    viewname,
    cache,
    [`.${table.name}`]
  );
  for (const { path, views } of many_to_many) {
    for (const view of views) {
      link_view_opts_push({
        view: view.name,
        label: `${view.name} [${view.viewtemplate} ${table.name}]`,
        name: path,
        relation: path,
      });
    }
  }
  return { link_view_opts, view_name_opts, view_relation_opts };
};

/**
 * Get Action configuration fields
 * @param {object} action
 * @param {object} table
 * @returns {Promise<object[]>}
 */
const getActionConfigFields = async (
  action: GenObj,
  table: Table,
  extra: GenObj = {}
): Promise<any[]> =>
  typeof action.configFields === "function"
    ? await action.configFields({
        table,
        ...extra,
        ...(extra?.req ? { __: extra.req.__ } : {}),
      })
    : action.configFields || [];

/**
 * @function
 * @param {Table|object} table - Table object
 * @param {string} viewname - view name
 * @param {object} req - Request Object
 * @param has_click_to_edit - boolean
 * @param has_align - boolean
 * @param no_fieldviews - boolean
 * @returns {Promise<object[]>}
 */
const field_picker_fields = async ({
  table,
  viewname,
  req,
  has_click_to_edit,
  has_align,
  no_fieldviews,
  has_showif,
}: {
  table: Table;
  viewname: string;
  req: GenObj;
  has_click_to_edit?: boolean;
  has_align?: boolean;
  no_fieldviews?: boolean;
  has_showif?: boolean;
}): Promise<any[]> => {
  const __ = (...s: any[]) => (req ? req.__(...s) : s.join(""));
  const fields = table.getFields();
  for (const field of fields) {
    if (field.type === "Key") {
      field.reftable =
        Table.findOne({ name: field.reftable_name }) || undefined;
      if (field.reftable) await field.reftable.getFields();
    }
  }
  const boolfields = fields.filter(
    (f) => f.type && (f.type as any).name === "Bool"
  );

  const stateActions = getState().actions;
  const stateActionKeys = Object.entries(stateActions)
    .filter(([_k, v]: [string, any]) => !v.disableInList)
    .map(([k]) => k);

  const actions = [
    "Delete",
    ...boolfields.map((f) => `Toggle ${f.name}`),
    ...stateActionKeys,
  ];
  const triggers = Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
    table_id: null,
  });
  triggers.forEach((tr) => {
    actions.push(tr.name!);
  });
  if (!table.external)
    Trigger.find({
      table_id: table.id,
    }).forEach((tr) => {
      actions.push(tr.name!);
    });
  const actionConfigFields = [];
  for (const [name, action] of Object.entries(stateActions)) {
    if (!stateActionKeys.includes(name)) continue;
    const cfgFields = await getActionConfigFields(action as GenObj, table, {
      req,
    } as GenObj);

    for (const field of cfgFields) {
      const cfgFld = {
        ...field,
        showIf: {
          action_name: name,
          type: "Action",
          ...(field.showIf || {}),
        },
      };
      if (cfgFld.input_type === "code") cfgFld.input_type = "textarea";
      actionConfigFields.push(cfgFld);
    }
  }
  const fldOptions = fields.map((f) => ({
    label: `${f.name} [${f.pretty_type}]`,
    name: f.name,
  }));
  const { field_view_options } = calcfldViewOptions(fields, "list");
  const rel_field_view_options = await calcrelViewOptions(table, "list");

  const fvConfigFields = [];
  if (req.staticFieldViewConfig) {
    //TODO the following line is slow
    const fieldViewConfigForms = await calcfldViewConfig(fields, false);
    for (const [field_name, fvOptFields] of Object.entries(
      fieldViewConfigForms
    ) as [string, any][]) {
      for (const [fieldview, formFields] of Object.entries(fvOptFields) as [
        string,
        any,
      ][]) {
        for (const formField of formFields) {
          if (field_name.includes("."))
            fvConfigFields.push({
              ...formField,
              showIf: {
                type: "JoinField",
                join_field: field_name,
                join_fieldview: fieldview,
              },
            });
          else
            fvConfigFields.push({
              ...formField,
              showIf: {
                type: "Field",
                field_name,
                fieldview,
              },
            });
        }
      }
    }
  }
  //TODO the following line is slow
  const { link_view_opts, view_name_opts, view_relation_opts } =
    await get_link_view_opts(table, viewname);
  const { parent_field_list } = await table.get_parent_relations(true, true);
  const { child_field_list, child_relations } =
    await table.get_child_relations(true);
  const join_field_options = await table.get_join_field_options(true, true);
  const join_field_view_options = {
    ...field_view_options,
    ...rel_field_view_options,
  };
  const relation_options = await table.get_relation_options();
  const aggStatOptions: Record<string, string[]> = {};
  const agg_fieldviews: GenObj[] = [];
  Object.values(getState().types).forEach((t: any) => {
    const fvnames = Object.entries(t.fieldviews)
      .filter(([_k, v]: [string, any]) => !v.isEdit && !v.isFilter)
      .map(([k]) => k);
    agg_fieldviews.push({
      name: `agg_fieldview`,
      label: __("Field view"),
      type: "String",
      attributes: {
        options: fvnames,
      },
      showIf: {
        "agg_field|_@_1": t.name,
        type: "Aggregation",
      },
    });
  });
  const agg_fieldview_cfg_opts = [
    {
      name: "format",
      label: __("Format"),
      type: "String",
      sublabel: __("moment.js format specifier"),
      showIf: {
        type: "Aggregation",
        "agg_field|_@_1": "Date",
        agg_fieldview: "format",
      },
    },
  ];

  const agg_field_opts = (child_relations as any[]).map(
    ({
      table,
      key_field,
      through,
    }: {
      table: Table;
      key_field: Field;
      through: Table | undefined;
    }) => {
      const aggKey =
        (through ? `${through.name}->` : "") +
        `${table.name}.${key_field.name}`;
      aggStatOptions[aggKey] = [
        "Count",
        "CountUnique",
        "Avg",
        "Sum",
        "Max",
        "Min",
        "Array_Agg",
      ];
      table.fields.forEach((f) => {
        if (f.type && (f.type as any).name === "Date") {
          aggStatOptions[aggKey].push(`Latest ${f.name}`);
          aggStatOptions[aggKey].push(`Earliest ${f.name}`);
        }
      });
      return {
        name: `agg_field`,
        label: __("On Field"),
        type: "String",
        required: true,
        attributes: {
          options: table.fields
            .filter((f) => !f.calculated || f.stored)
            .map((f) => ({
              label: f.name,
              name: `${f.name}@${f.type_name}`,
            })),
        },
        showIf: {
          agg_relation: aggKey,
          type: "Aggregation",
        },
      };
    }
  );
  return [
    {
      name: "type",
      label: __("Type"),
      type: "String",
      required: true,
      attributes: {
        //TODO omit when no options
        options: [
          {
            name: "Field",
            label: __(`Field in %s table`, table.name),
          },
          { name: "Action", label: __("Action on row") },

          ...(link_view_opts.length > 0
            ? [{ name: "ViewLink", label: __("Link to other view") }]
            : []),
          { name: "Link", label: __("Link to anywhere") },
          ...(parent_field_list.length > 0
            ? [{ name: "JoinField", label: __("Join Field") }]
            : []),
          ...(child_field_list.length > 0
            ? [{ name: "Aggregation", label: __("Aggregation") }]
            : []),
          { name: "FormulaValue", label: __("Formula value") },
        ],
      },
    },
    {
      name: "formula",
      label: __("Formula"),
      type: "String",
      fieldview: "textarea",

      class: "validate-expression",
      showIf: { type: "FormulaValue" },
      attributes: {
        rows: 2,
        spellcheck: false,
      },
    },
    {
      name: "field_name",
      label: __("Field"),
      type: "String",
      required: true,
      attributes: {
        options: fldOptions,
      },
      showIf: { type: "Field" },
    },
    ...(no_fieldviews
      ? []
      : [
          {
            name: "fieldview",
            label: __("Field view"),
            type: "String",
            required: false,
            attributes: {
              calcOptions: ["field_name", field_view_options],
            },
            showIf: { type: "Field" },
            help: {
              topic: "Field views",
              context: { table_name: table.name, mode: "list" },
              dynContext: ["field_name"],
            },
          },
        ]),

    {
      name: "join_field",
      label: __("Join Field"),
      type: "String",
      input_type: "join_field_picker",
      required: true,
      attributes: {
        join_field_options,
        relation_options,
      },
      showIf: { type: "JoinField" },
    },
    {
      name: "join_fieldview",
      label: __("Field view"),
      type: "String",
      required: false,
      attributes: {
        calcOptions: ["join_field", join_field_view_options],
      },
      showIf: { type: "JoinField" },
    },
    ...(req.staticFieldViewConfig
      ? fvConfigFields
      : [
          {
            name: "fvcfg",
            input_type: "dynamic_fields",
            attributes: {
              //getFields: `({type, field, join_field, fieldview, join_fieldview})=>'/field/fieldviewcfgform/${table.name}/'+(type==='Field'?field:join_field)+'/'+(type==='Field'?fieldview:join_fieldview)`,
              getFields: `/field/fieldviewcfgform/${table.name}`,
              relevantFields: [
                "field_name",
                "fieldview",
                "type",
                "join_field",
                "join_fieldview",
                "_columndef",
              ],
            },
            //showIf: { type: ["Field", "JoinField"] },
          },
          { name: "_columndef", input_type: "hidden" },
        ]),
    ...(has_click_to_edit
      ? [
          {
            name: "click_to_edit",
            label: __("Click to edit?"),
            type: "Bool",
            showIf: { type: ["Field", "JoinField"] },
          },
        ]
      : []),
    {
      name: "action_name",
      label: __("Action"),
      type: "String",
      required: true,
      attributes: {
        options: actions,
      },
      showIf: { type: "Action" },
    },
    {
      name: "action_label",
      label: __("Action Label"),
      class: "validate-expression validate-expression-conditional",
      type: "String",
      showIf: { type: "Action" },
    },
    {
      name: "action_label_formula",
      label: __("Action label is a formula?"),
      type: "Bool",
      required: false,
      showIf: { type: "Action" },
    },
    {
      name: "action_style",
      label: __("Action Style"),
      type: "String",
      required: true,
      attributes: {
        asideNext: true,
        options: [
          { name: "btn-primary", label: __("Primary button") },
          { name: "btn-secondary", label: __("Secondary button") },
          { name: "btn-success", label: __("Success button") },
          { name: "btn-danger", label: __("Danger button") },
          { name: "btn-outline-primary", label: __("Primary outline button") },
          {
            name: "btn-outline-secondary",
            label: __("Secondary outline button"),
          },
          { name: "btn-link", label: __("Link") },
        ],
      },

      showIf: { type: "Action" },
    },
    {
      name: "action_size",
      label: __("Button size"),
      type: "String",
      required: true,
      attributes: {
        options: [
          { name: "", label: __("Standard") },
          { name: "btn-lg", label: __("Large") },
          { name: "btn-sm", label: __("Small") },
          { name: "btn-sm btn-xs", label: __("X-Small") },
          { name: "btn-block", label: __("Block") },
          { name: "btn-block btn-lg", label: __("Large block") },
        ],
      },
      showIf: { type: "Action" },
    },
    {
      name: "confirm",
      label: __("User confirmation?"),
      type: "Bool",
      showIf: { type: "Action" },
    },
    ...actionConfigFields,
    {
      name: "view_name",
      label: __("View"),
      type: "String",
      required: true,
      attributes: {
        options: view_name_opts,
        asideNext: true,
      },
      showIf: { type: "ViewLink" },
    },
    {
      name: "view",
      label: __("Relation"),
      type: "String",
      required: true,
      attributes: {
        //options: link_view_opts,
        calcOptions: ["view_name", view_relation_opts],
      },
      showIf: { type: "ViewLink" },
    },
    {
      name: "view_label",
      label: __("View label"),
      sublabel: __("Leave blank for default label."),
      class: "validate-expression validate-expression-conditional",
      type: "String",
      required: false,
      showIf: { type: "ViewLink" },
    },
    {
      name: "view_label_formula",
      label: __("View label is a formula?"),
      type: "Bool",
      required: false,
      showIf: { type: "ViewLink" },
    },

    {
      name: "link_style",
      label: __("Link Style"),
      type: "String",
      required: true,
      attributes: {
        asideNext: true,
        options: [
          { name: "", label: __("Link") },
          { name: "btn btn-primary", label: __("Primary button") },
          { name: "btn btn-secondary", label: __("Secondary button") },
          { name: "btn btn-success", label: __("Success button") },
          { name: "btn btn-danger", label: __("Danger button") },
          {
            name: "btn btn-outline-primary",
            label: __("Primary outline button"),
          },
          {
            name: "btn btn-outline-secondary",
            label: __("Secondary outline button"),
          },
        ],
      },

      showIf: { type: "ViewLink" },
    },
    {
      name: "link_size",
      label: __("Link size"),
      type: "String",
      required: true,
      attributes: {
        options: [
          { name: "", label: __("Standard") },
          { name: "btn-lg", label: __("Large") },
          { name: "btn-sm", label: __("Small") },
          { name: "btn-sm btn-xs", label: __("X-Small") },
          { name: "btn-block", label: __("Block") },
          { name: "btn-block btn-lg", label: __("Large block") },
        ],
      },
      showIf: { type: "ViewLink" },
    },
    {
      name: "extra_state_fml",
      label: __("Extra state Formula"),
      sublabel: __(
        "Formula for JavaScript object that will be added to state parameters"
      ),
      help: {
        topic: "Extra state formula",
        context: { srcTable: table.name },
        dynContext: ["view_name"],
      },
      type: "String",
      class: "validate-expression",
      showIf: { type: "ViewLink" },
    },
    {
      name: "link_text",
      label: __("Link text"),
      type: "String",
      class: "validate-expression validate-expression-conditional",
      required: true,
      showIf: { type: "Link" },
    },
    {
      name: "link_text_formula",
      label: __("Link text is a formula?"),
      type: "Bool",
      required: false,
      showIf: { type: "Link" },
    },
    {
      name: "link_url",
      label: __("Link URL"),
      class: "validate-expression validate-expression-conditional",
      type: "String",
      required: true,
      showIf: { type: "Link" },
    },
    {
      name: "link_url_formula",
      label: __("Link URL is a formula?"),
      type: "Bool",
      required: false,
      showIf: { type: "Link" },
    },
    {
      name: "icon_btn",
      label: __("Icon"),
      input_type: "custom_html",
      attributes: {
        html: `<button type="button" id="myEditor_icon" class="btn btn-outline-secondary"></button>`,
      },
      showIf: { type: ["Link", "ViewLink", "Action"] },
    },
    {
      name: "icon",
      class: "item-menu",
      input_type: "hidden",
    },
    {
      name: "link_target_blank",
      label: __("Open in new tab"),
      type: "Bool",
      required: false,
      showIf: { type: ["ViewLink", "Link"] },
    },
    {
      name: "in_modal",
      label: __("Open in popup modal?"),
      type: "Bool",
      required: false,
      showIf: { type: ["ViewLink", "Link"] },
    },
    {
      name: "in_dropdown",
      label: __("Place in dropdown"),
      type: "Bool",
      showIf: { type: ["Action", "ViewLink", "Link"] },
    },
    {
      name: "agg_relation",
      label: __("Relation"),
      type: "String",
      required: true,
      attributes: {
        options: child_field_list,
      },
      showIf: { type: "Aggregation" },
    },
    ...agg_field_opts,
    {
      name: "stat",
      label: __("Statistic"),
      type: "String",
      required: true,
      attributes: {
        calcOptions: ["agg_relation", aggStatOptions],
      },

      showIf: { type: "Aggregation" },
    },
    ...agg_fieldviews,
    ...agg_fieldview_cfg_opts,
    {
      name: "aggwhere",
      label: __("Where"),
      sublabel: __("Formula"),
      class: "validate-expression",
      type: "String",
      required: false,
      showIf: { type: "Aggregation" },
    },
    {
      name: "header_label",
      label: __("Header label"),
      type: "String",
    },
    ...(has_showif
      ? [
          {
            name: "showif",
            label: __("Show if true"),
            sublabel: __("Formula. Leave blank to always show"),
            class: "validate-expression",
            type: "String",
            required: false,
          },
        ]
      : []),
    {
      name: "col_width",
      label: __("Column width"),
      type: "Integer",
      attributes: { asideNext: true },
    },
    {
      name: "col_width_units",
      label: __("Units"),
      type: "String",
      required: true,
      attributes: {
        inline: true,
        options: ["px", "%", "vw", "em", "rem", "cm"],
      },
    },
    ...(has_align
      ? [
          {
            name: "alignment",
            label: __("Alignment"),
            input_type: "select",
            options: ["Default", "Left", "Center", "Right"],
          },
        ]
      : []),
  ];
};

/**
 * Get Child Views
 * @function
 * @param {Table|object} table
 * @param {string} viewname
 * @param nrecurse
 * @returns {Promise<object[]>}
 */
const get_child_views = async (
  table: Table,
  viewname: string | null,
  nrecurse: number = 2
): Promise<any[]> => {
  const rels = await Field.find(
    { reftable_name: table.name },
    { cached: true }
  );
  const possibleThroughTables = new Set<string>();
  let child_views: {
    relation: Field;
    related_table: Table;
    views: View[];
    through?: Field;
    throughTable?: Table;
  }[] = [];
  for (const relation of rels) {
    const related_table = Table.findOne({ id: relation.table_id });
    if (!related_table) continue;
    const views = await View.find_table_views_where(
      related_table.id!,
      ({ state_fields, viewrow }) =>
        viewrow.name !== viewname && state_fields.every((sf) => !sf.required)
    );
    child_views.push({ relation, related_table, views });
    possibleThroughTables.add(`${related_table.name}.${relation.name}`);
  }
  if (nrecurse > 0)
    for (const possibleThroughTable of possibleThroughTables) {
      const [tableName, fieldName] = possibleThroughTable.split(".");
      const reltable = Table.findOne({ name: tableName });
      if (!reltable) continue;
      const relfields = await reltable.getFields();
      const relfield = relfields.find((f) => f.name === fieldName);
      const cviews = await get_child_views(reltable, null, nrecurse - 1);
      for (const { relation, related_table, views } of cviews)
        child_views.push({
          relation,
          related_table,
          through: relfield,
          throughTable: reltable,
          views,
        });
    }
  return child_views;
};

/**
 * Get parent views
 * @function
 * @param {Table|object} table
 * @param {string} viewname
 * @returns {Promise<object[]>}
 */
const get_parent_views = async (
  table: Table,
  viewname: string
): Promise<any[]> => {
  let parent_views: { relation: Field; related_table: Table; views: View[] }[] =
    [];
  const parentrels = table
    .getFields()
    .filter((f) => f.is_fkey && f.type !== "File");
  for (const relation of parentrels) {
    const related_table = Table.findOne({
      name: relation.reftable_name,
    });
    if (!related_table) continue;
    const views = await View.find_table_views_where(
      related_table,
      ({ state_fields, viewrow }) =>
        viewrow.name !== viewname && state_fields.some((sf) => sf.name === "id")
    );

    parent_views.push({ relation, related_table, views });
  }
  return parent_views;
};

/**
 * Get One-to-one views
 * @function
 * @param {Table} table
 * @param {string} viewname
 * @returns {Promise<object[]>}
 */
const get_onetoone_views = async (
  table: Table,
  viewname: string
): Promise<any[]> => {
  const rels = await Field.find(
    {
      reftable_name: table.name,
      is_unique: true,
    },
    { cached: true }
  );
  let child_views: { relation: Field; related_table: Table; views: View[] }[] =
    [];
  for (const relation of rels) {
    const related_table = Table.findOne({ id: relation.table_id });
    if (!related_table) continue;
    const views = await View.find_table_views_where(
      related_table.id!,
      ({ state_fields, viewrow }) =>
        viewrow.name !== viewname && state_fields.some((sf) => sf.name === "id")
    );
    child_views.push({ relation, related_table, views });
  }
  return child_views;
};

const generate_joined_query = ({
  table,
  columns,
  layout,
  req,
  state,
  stateHash,
  formulas,
  include_fml,
  user,
  forPublic,
  limit,
  orderBy,
  orderDesc,
  joinFields,
  aggregations,
}: {
  table: Table;
  columns?: any[];
  layout?: any;
  req?: GenObj;
  state?: GenObj;
  stateHash?: string;
  formulas?: string | string[];
  include_fml?: string;
  user?: AbstractUser;
  forPublic?: boolean;
  limit?: number;
  orderBy?: string;
  orderDesc?: boolean;
  joinFields?: GenObj;
  aggregations?: GenObj;
}): GenObj => {
  const q: GenObj = {};
  if (joinFields) q.joinFields = joinFields;
  if (aggregations) q.aggregations = aggregations;
  const prefix = "a.";
  const use_user = user || req?.user;
  if (columns)
    Object.assign(
      q,
      picked_fields_to_query(columns, table.fields, layout, req || {}, table)
    );

  const use_state = structuredClone(state) || {};
  readState(use_state, table.fields, req);
  q.where = stateFieldsToWhere({
    fields: table.fields,
    state: use_state,
    table,
    prefix,
  });

  if (include_fml) {
    const ctx = { ...state, user_id: use_user?.id || null, user: use_user };
    let where1 = jsexprToWhere(include_fml, ctx, table.fields);
    mergeIntoWhere(q.where, where1 || {});
  }

  Object.assign(
    q,
    stateFieldsToQuery({
      state: use_state,
      fields: table.fields,
      prefix,
      stateHash,
    })
  );

  if (formulas) {
    const use_formulas =
      typeof formulas === "string" ? [formulas] : new Set<string>(formulas);
    let freeVars: Set<string> = new Set(); // for join fields

    for (const fml of use_formulas)
      freeVars = new Set([...freeVars, ...freeVariables(fml)]);
    if (freeVars.size > 0) {
      if (!q.joinFields) q.joinFields = {};
      if (!q.joinFields) q.aggregations = {};
      add_free_variables_to_joinfields(freeVars, q.joinFields, table.fields);
      add_free_variables_to_aggregations(freeVars, q.aggregations, table);
    }
  }

  if (user) {
    q.forUser = use_user;
  } else if (forPublic) {
    q.forPublic = true;
  }
  if (!q.limit && limit) q.limit = limit;
  if (!q.orderBy && orderBy) q.orderBy = orderBy;
  if (typeof q.orderDesc == "undefined" && orderDesc) q.orderDesc = orderDesc;
  return q;
};

/**
 * Picked fields to query
 * @function
 * @param {object[]} columns
 * @param {Field[]} fields
 * @param layout
 * @throws {InvalidConfiguration}
 * @returns {object}
 */
const picked_fields_to_query = (
  columns: any[],
  fields: Field[],
  layout: any,
  req: GenObj,
  table: Table
): { joinFields: Record<string, any>; aggregations: Record<string, any> } => {
  let joinFields: Record<string, any> = {};
  let aggregations: Record<string, any> = {};
  let freeVars: Set<string> = new Set(); // for join fields
  const locale = req?.getLocale?.();

  (columns || []).forEach((column) => {
    if (column.type === "JoinField") {
      if (column.join_field && column.join_field.split) {
        if (column.join_field.includes("->")) {
          const [relation, target] = column.join_field.split("->");
          const [ontable, ref] = relation.split(".");
          const targetNm = validSqlId(
            `${ref}_${ontable.replaceAll(" ", "").toLowerCase()}_${target}`
          );
          column.targetNm = targetNm;
          joinFields[targetNm] = {
            ref,
            target,
            ontable,
          };
        } else {
          const kpath = column.join_field.split(".");
          let jfKey: string | undefined;
          if (kpath.length === 2) {
            const [refNm, targetNm] = kpath;
            jfKey = `${refNm}_${targetNm}`;
            joinFields[jfKey] = {
              ref: refNm,
              target: targetNm,
            };
          } else if (kpath.length === 3) {
            const [refNm, through, targetNm] = kpath;
            jfKey = `${refNm}_${through}_${targetNm}`;
            joinFields[jfKey] = {
              ref: refNm,
              target: targetNm,
              through,
            };
          } else if (kpath.length === 4) {
            const [refNm, through1, through2, targetNm] = kpath;
            jfKey = `${refNm}_${through1}_${through2}_${targetNm}`;
            joinFields[jfKey] = {
              ref: refNm,
              target: targetNm,
              through: [through1, through2],
            };
          }
          const targetField = table ? table.getField(column.join_field) : null;
          if (
            jfKey &&
            locale &&
            targetField?.attributes?.localized_by?.[locale]
          ) {
            joinFields[jfKey].target =
              targetField?.attributes?.localized_by?.[locale];
          }
        }
      } else {
        throw new InvalidConfiguration(
          `Join field is specified as column but no join field is chosen`
        );
      }
    } else if (column.type === "FormulaValue") {
      freeVars = new Set([...freeVars, ...freeVariables(column.formula)]);
    } else if (column.type === "ViewLink") {
      if (column.view_label_formula || column.isFormula?.label)
        freeVars = new Set([
          ...freeVars,
          ...freeVariables(column.view_label || column.label),
        ]);
      if (column.extra_state_fml)
        freeVars = new Set([
          ...freeVars,
          ...freeVariables(column.extra_state_fml),
        ]);
      if (column.view && column.view.split) {
        const [vtype, vrest] = column.view.split(":");
        if (vtype === "ParentShow") {
          const [pviewnm, ptbl, pfld] = vrest.split(".");
          const field = fields.find((f) => f.name === pfld);
          if (field && field.attributes.summary_field)
            joinFields[`summary_field_${ptbl.toLowerCase()}`] = {
              ref: pfld,
              target: field.attributes.summary_field,
            };
        }
      }
    } else if (column.type === "Aggregation") {
      if (column.agg_relation && column.agg_relation.split) {
        let table, fld, through;
        if (column.agg_relation.includes("->")) {
          let restpath;
          [through, restpath] = column.agg_relation.split("->");
          [table, fld] = restpath.split(".");
        } else {
          [table, fld] = column.agg_relation.split(".");
        }

        //console.log(column);
        const field = column.agg_field.split("@")[0];
        let targetNm = validSqlId(
          db.sqlsanitize(
            (
              column.stat.replace(" ", "") +
                "_" +
                table +
                "_" +
                fld +
                "_" +
                field +
                "_" +
                column.aggwhere || ""
            ).toLowerCase()
          )
        );
        // postgres fields have a max len
        if (targetNm.length > 58) {
          targetNm = targetNm
            .split("")
            .filter((c, i) => i % 2 == 0)
            .join("");
        }
        column.targetNm = targetNm;
        aggregations[targetNm] = {
          table,
          ref: fld,
          where: column.aggwhere
            ? jsexprToWhere(column.aggwhere, req ? { user: req.user } : {})
            : undefined,
          field,
          aggregate: column.stat,
          through,
        };
      }
    } else if (column.type === "Link") {
      if (column.link_text_formula)
        freeVars = new Set([...freeVars, ...freeVariables(column.link_text)]);
      if (column.link_url_formula)
        freeVars = new Set([...freeVars, ...freeVariables(column.link_url)]);
    } else if (column.type === "Action" && column.action_label_formula) {
      freeVars = new Set([...freeVars, ...freeVariables(column.action_label)]);
    }
    if (column.showif)
      freeVars = new Set([...freeVars, ...freeVariables(column.showif)]);
  });
  if (layout) {
    traverseSync(layout, {
      view(v) {
        if (v.extra_state_fml)
          freeVars = new Set([
            ...freeVars,
            ...freeVariables(v.extra_state_fml),
          ]);
      },
      view_link(v) {
        if (v.extra_state_fml)
          freeVars = new Set([
            ...freeVars,
            ...freeVariables(v.extra_state_fml),
          ]);
        if (v.isFormula?.label && typeof v.view_label === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.view_label)]);
      },
      link(v) {
        if (v?.isFormula?.text && typeof v.text === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.text)]);
        if (v?.isFormula?.url && typeof v.url === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.url)]);
      },
      image(v) {
        if (v?.isFormula?.alt && typeof v.alt === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.alt)]);
      },
      card(v) {
        if (v?.isFormula?.title && typeof v.title === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.title)]);
        if (v?.isFormula?.url && typeof v.url === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.url)]);
      },
      tabs(v: any) {
        (v.titles || []).forEach((t: unknown) => {
          if (typeof t === "string")
            freeVars = new Set([
              ...freeVars,
              ...freeVariablesInInterpolation(t),
            ]);
        });
        (v.showif || []).forEach((t: string) => {
          freeVars = new Set([...freeVars, ...freeVariablesInInterpolation(t)]);
        });
      },
      blank(v) {
        if (v?.isFormula?.text && typeof v.contents === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.contents)]);
        if (v.isHTML)
          freeVars = new Set([
            ...freeVars,
            ...freeVariablesInInterpolation(v.contents),
          ]);
      },
      container(v) {
        if (v.showIfFormula)
          freeVars = new Set([...freeVars, ...freeVariables(v.showIfFormula)]);
        if (v.isFormula?.bgColor)
          freeVars = new Set([...freeVars, ...freeVariables(v.bgColor)]);
        if (v.isFormula?.url)
          freeVars = new Set([...freeVars, ...freeVariables(v.url)]);
        if (v.isFormula?.customClass)
          freeVars = new Set([...freeVars, ...freeVariables(v.customClass)]);
        if (v.isFormula?.customId)
          freeVars = new Set([...freeVars, ...freeVariables(v.customId)]);
      },
    });
  }
  if (layout?.besides && layout?.list_columns) {
    layout?.besides.forEach((s: GenObj) => {
      if (s.showif)
        freeVars = new Set([...freeVars, ...freeVariables(s.showif)]);
    });
  }
  add_free_variables_to_joinfields(freeVars, joinFields, fields);
  add_free_variables_to_aggregations(freeVars, aggregations, table);
  return { joinFields, aggregations };
};

/**
 * State fields to Query
 * @function
 * @param {object}
 * @returns {object}
 */
const stateFieldsToQuery = ({
  state,
  stateHash,
  fields,
  prefix = "",
  noSortAndPaging,
}: {
  state: GenObj;
  stateHash?: string;
  fields: Field[];
  prefix?: string;
  noSortAndPaging?: boolean;
}): GenObj => {
  let q: GenObj = {};
  if (!noSortAndPaging) {
    const sortbyName = `_${stateHash}_sortby`;
    const sortDescName = `_${stateHash}_sortdesc`;
    if (state[sortbyName]) {
      if (typeof state[sortbyName] === "string")
        q.orderBy = db.sqlsanitize(state[sortbyName]);
      if (state[sortDescName]) q.orderDesc = true;
    } else if (state._orderBy) {
      if (typeof state._orderBy === "string") {
        q.orderBy = db.sqlsanitize(state._orderBy);
        if (state._orderDesc) q.orderDesc = true;
      } else if (typeof state._orderBy === "object") {
        const { operator, field, target } = state._orderBy;
        const fld = fields.find((f) => f.name == field);

        if (!fld) return q;
        const oper = (fld.type as any)?.distance_operators?.[operator];

        if (!oper) return q;
        q.orderBy = { operator: oper, field, target };
      }
    }
    Object.keys(state).forEach((k) => {
      if (!k.startsWith("_op_")) return;
      const [_blank, _op, fieldName, opName] = k.split("_");
      const field = fields.find((f) => f.name == fieldName);

      if (!field) return;
      const operator = (field.type as any)?.distance_operators?.[opName];

      if (!operator) return;
      q.orderBy = { operator, field: fieldName, target: state[k] };
    });

    const pagesize =
      stateHash && state[`_${stateHash}_pagesize`]
        ? parseInt(state[`_${stateHash}_pagesize`])
        : undefined;
    if (pagesize) {
      q.limit = pagesize;
      const page =
        stateHash && state[`_${stateHash}_page`]
          ? parseInt(state[`_${stateHash}_page`])
          : undefined;
      if (page) {
        q.offset = (page - 1) * pagesize;
      }
    }
  }
  const stateKeys = Object.keys(state);
  const latNear = stateKeys.find((k) => k.startsWith("_near_lat_"));
  const longNear = stateKeys.find((k) => k.startsWith("_near_long_"));
  if (latNear && longNear) {
    const latField = prefix + db.sqlsanitize(latNear.replace("_near_lat_", ""));
    const longField =
      prefix + db.sqlsanitize(longNear.replace("_near_long_", ""));
    const lat = parseFloat(state[latNear]);
    const long = parseFloat(state[longNear]);
    q.orderBy = { distance: { lat, long, latField, longField } };
  }
  return q;
};

/**
 * Add to List or Create List (container)
 * @param {object} container
 * @param {string} key
 * @param {object} x
 * @returns {void}
 */
// todo potentially move to utils
const addOrCreateList = (container: GenObj, key: string, x: any): void => {
  if (container[key]) {
    if (container[key].length) container[key].push(x);
    else container[key] = [container[key], x];
  } else container[key] = [x];
};

const stringToQuery = (s: string): GenObj => {
  const json = JSON.parse(s);
  const { path, sourcetable } = parseRelationPath(json.relation);
  return {
    ...json,
    path,
    sourcetable,
  };
};

const queryToString = (query: GenObj): string => {
  const relObj = {
    srcId: query.srcId,
    relation: buildRelationPath(query.sourcetable, query.path),
  };
  return JSON.stringify(relObj);
};

const handleRelationPath = (
  queryObj: GenObj,
  qstate: GenObj,
  table: Table
): void => {
  if (queryObj.path.length > 0) {
    const levels = [];
    let lastTableName = queryObj.sourcetable;
    let where = null;
    for (const level of queryObj.path) {
      if (level.inboundKey) {
        const tbl = Table.findOne(level.table);
        levels.push({
          ...level,
          pk_name: tbl?.pk_name,
          ref_name: tbl?.getField?.(level.inboundKey)?.refname,
        });
        lastTableName = level.table;
        if (!where)
          where = {
            [db.sqlsanitize(level.inboundKey)]:
              queryObj.srcId !== "NULL" ? queryObj.srcId : null,
          };
      } else {
        const lastTable = Table.findOne({ name: lastTableName }) as any;
        const refField = lastTable?.fields?.find(
          (field: any) => field.name === level.fkey
        );
        levels.push({
          table: refField?.reftable_name,
          fkey: level.fkey,
          pk_name: refField?.refname,
        });
        lastTableName = refField?.reftable_name;
        const finalTable = Table.findOne({ name: lastTableName });
        if (!where)
          where = {
            [finalTable?.pk_name || "id"]:
              queryObj.srcId !== "NULL" ? queryObj.srcId : null,
          };
      }
    }

    addOrCreateList(qstate, table?.pk_name || "id", {
      inSelectWithLevels: {
        joinLevels: levels,
        schema: db.getTenantSchema(),
        where,
      },
    });
  }
};

/**
 * @function
 * @param {object} opts
 * @param {Field[]} opts.fields
 * @param {object} opts.state
 * @param {string} [opts.prefix = ""]
 * @param {boolean} [opts.approximate = true]
 * @param {Table} opts.table
 * @returns {object}
 */
const stateFieldsToWhere = ({
  fields,
  state,
  approximate = true,
  table,
  prefix = "",
}: {
  fields: Field[];
  state: GenObj;
  approximate?: boolean;
  table?: Table;
  prefix?: string;
}): Where => {
  let qstate: GenObj = {};
  const orFields: string[] = [];
  Object.entries(state || {}).forEach(([k, v]) => {
    if (typeof v === "undefined") return;
    if (k === "_fts" || (table?.name && k === `_fts_${table.santized_name}`)) {
      const scState = getState();
      const language = scState.pg_ts_config;
      const use_websearch = scState.getConfig("search_use_websearch", false);
      const disable_fts = scState.getConfig("search_disable_fts", false);
      qstate["_fts"] = {
        searchTerm: v.replace(/\0/g, ""),
        fields,
        language,
        use_websearch,
        disable_fts,
        table: prefix
          ? prefix.replaceAll(".", "")
          : table
            ? table.name
            : undefined,
        schema: db.isSQLite ? undefined : db.getTenantSchema(),
      };
      return;
    }
    if (k === "or" && typeof v === "object") {
      qstate.or = v;
      return;
    }
    if (k === "_or_field") {
      if (Array.isArray(v)) orFields.push(...v);
      else orFields.push(v);
      return;
    }

    const field = fields.find((fld) => fld.name === k);
    if (k === "_relation_path_" || k === "_inbound_relation_path_")
      handleRelationPath(
        typeof v === "string" ? stringToQuery(v) : v,
        qstate,
        table!
      );
    else if (k.startsWith(".")) {
      const queryObj = parseRelationPath(k);
      queryObj.srcId = v;
      handleRelationPath(queryObj, qstate, table!);
    } else if (k.startsWith("_fromdate_")) {
      const datefield = db.sqlsanitize(k.replace("_fromdate_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield)
        addOrCreateList(qstate, datefield, {
          gt: dfield.attributes?.day_only ? new PlainDate(v) : new Date(v),
          equal: true,
          day_only: dfield.attributes?.day_only,
        });
    } else if (k.startsWith("_todate_")) {
      const datefield = db.sqlsanitize(k.replace("_todate_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      //https://stackoverflow.com/a/22061879/19839414
      if (
        dfield &&
        !dfield?.attributes?.day_only &&
        v?.match?.(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        const date = new Date(v);
        date.setDate(date.getDate() + 1);
        addOrCreateList(qstate, datefield, {
          lt: date,
          equal: true,
          day_only: dfield.attributes?.day_only,
        });
      } else if (dfield)
        addOrCreateList(qstate, datefield, {
          lt: dfield.attributes?.day_only ? new PlainDate(v) : new Date(v),
          equal: true,
          day_only: dfield.attributes?.day_only,
        });
    } else if (k.startsWith("_fromneqdate_")) {
      const datefield = db.sqlsanitize(k.replace("_fromneqdate_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield)
        addOrCreateList(qstate, datefield, {
          gt: dfield.attributes?.day_only ? new PlainDate(v) : new Date(v),
          day_only: dfield.attributes?.day_only,
        });
    } else if (k.startsWith("_toneqdate_")) {
      const datefield = db.sqlsanitize(k.replace("_toneqdate_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield)
        addOrCreateList(qstate, datefield, {
          lt: dfield.attributes?.day_only ? new PlainDate(v) : new Date(v),
          day_only: dfield.attributes?.day_only,
        });
    } else if (k.startsWith("_gte_")) {
      const datefield = db.sqlsanitize(k.replace("_gte_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield) addOrCreateList(qstate, datefield, { gt: v, equal: true });
    } else if (k.startsWith("_lte_")) {
      const datefield = db.sqlsanitize(k.replace("_lte_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield) addOrCreateList(qstate, datefield, { lt: v, equal: true });
    } else if (k.startsWith("_gt_")) {
      const datefield = db.sqlsanitize(k.replace("_gt_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield) addOrCreateList(qstate, datefield, { gt: v });
    } else if (k.startsWith("_lt_")) {
      const datefield = db.sqlsanitize(k.replace("_lt_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield) addOrCreateList(qstate, datefield, { lt: v });
    } else if (k.startsWith("_not_")) {
      const notfield = db.sqlsanitize(k.replace("_not_", ""));
      const nfield = fields.find((fld) => fld.name === notfield);
      if (nfield) {
        if (!qstate.not) qstate.not = {};
        qstate.not[notfield] = v;
      }
    } else if (
      field &&
      (field.type as any)?.name === "String" &&
      v &&
      v.slugify
    ) {
      qstate[k] = v;
    } else if (
      Array.isArray(v) &&
      field &&
      field.type &&
      (field.type as any).read
    ) {
      qstate[k] = {
        or: v.map((val) => (field.type as any).read(val, field.attributes)),
      };
    } else if (
      Array.isArray(v) &&
      field?.is_fkey &&
      field?.reftype === "Integer"
    ) {
      qstate[k] = { or: v.map((v) => (v && !isNaN(+v) ? +v : v)) };
    } else if (
      field &&
      (field.type as any)?.name === "String" &&
      !(field.attributes && field.attributes.options) &&
      approximate &&
      !field.attributes?.exact_search_only
    ) {
      qstate[k] = { ilike: v };
    } else if (
      field &&
      (field.type as any)?.name === "Bool" &&
      state[k] === "?"
    ) {
      // omit
    } else if (
      typeof v === "object" &&
      v &&
      (field?.type as any)?.name === "JSON"
    ) {
      let json: Record<string, any> = {};
      if (Object.values(v).length === 1 && Object.values(v)[0] === "") return;
      Object.entries(v).forEach(([kj, vj]: [string, any]) => {
        if (vj === "") return;
        if (kj.endsWith("__lte")) {
          json[kj.replace("__lte", "")] = {
            lte: +vj,
            ...(json[kj.replace("__lte", "")] || {}),
          };
        } else if (kj.endsWith("__gte")) {
          json[kj.replace("__gte", "")] = {
            gte: +vj,
            ...(json[kj.replace("__gte", "")] || {}),
          };
        } else {
          json[kj] = vj;

          if (field!.attributes?.hasSchema) {
            const s = field!.attributes.schema.find(
              (f: { key: string }) => f.key === Object.keys(v)[0]
            );
            if (s?.type === "String") {
              json[kj] = { ilike: vj };
            }
          }
        }
      });

      qstate[k] = [
        ...(qstate[k] ? [qstate[k]] : []),
        {
          json,
        },
      ];
    } else if (typeof v === "object" && field) {
      qstate[k] = v;
    } else if (field && field.type && (field.type as any).read)
      qstate[k] = Array.isArray(v)
        ? {
            or: v.map((val) => (field.type as any).read(val, field.attributes)),
          }
        : (field.type as any).read(v, field.attributes);
    else if (field) qstate[k] = v;
    else if (k.split("->").length === 3) {
      const [jFieldNm, throughPart, finalPart] = k.split(".");
      const [thoughTblNm, throughField] = throughPart.split("->");
      const [jtNm, lblField] = finalPart.split("->");
      const jtTbl = Table.findOne(jtNm);
      let where = { [db.sqlsanitize(lblField)]: v };
      qstate[jFieldNm] = [
        ...(qstate[jFieldNm] ? [qstate[jFieldNm]] : []),
        {
          // where jFieldNm in (select id from jtnm where lblField=v)
          inSelect: {
            table: db.sqlsanitize(thoughTblNm),
            tenant: db.isSQLite ? undefined : db.getTenantSchema(),
            field: db.sqlsanitize(throughField),
            valField: jtTbl?.pk_name || "id",
            through: db.sqlsanitize(jtNm),
            where,
          },
        },
      ];
    } else if (k.includes("->")) {
      // jFieldNm.jtnm->lblField
      // where jFieldNm in (select id from jtnm where lblField=v)
      const [jFieldNm, krest] = k.split(".");
      const [jtNm, lblField] = krest.split("->");
      let where = { [db.sqlsanitize(lblField)]: v };
      const jTable = Table.findOne({ name: jtNm });
      const lblFld = (jTable?.fields || []).find((f) => f.name === lblField);
      if (
        lblFld &&
        (lblFld.type as any)?.name === "String" &&
        !lblFld.attributes?.options
      )
        where = { [db.sqlsanitize(lblField)]: { ilike: v } };

      qstate[jFieldNm] = [
        ...(qstate[jFieldNm] ? [qstate[jFieldNm]] : []),
        {
          // where jFieldNm in (select id from jtnm where lblField=v)
          inSelect: {
            table: db.sqlsanitize(jtNm),
            tenant: db.isSQLite ? undefined : db.getTenantSchema(),
            field: jTable?.pk_name,
            where,
          },
        },
      ];
    } else if (k.includes(".")) {
      const kpath = k.split(".");
      if (kpath.length === 3) {
        const [jtNm, jFieldNm, lblField] = kpath;
        let isString = false;
        const labelField = Table.findOne({ name: jtNm })?.getField?.(lblField);
        if (labelField)
          isString =
            (labelField.type as any)?.name === "String" &&
            !labelField.attributes?.exact_search_only;

        const pk = table ? table.pk_name : "id";
        qstate[pk] = [
          ...(qstate[pk] ? [qstate[pk]] : []),
          {
            // where id in (select jFieldNm from jtnm where lblField=v)
            inSelect: {
              table: db.sqlsanitize(jtNm),
              tenant: db.isSQLite ? undefined : db.getTenantSchema(),
              field: db.sqlsanitize(jFieldNm),
              where: {
                [db.sqlsanitize(lblField)]:
                  isString && approximate ? { ilike: v } : v,
              },
            },
          },
        ];
      } else if (kpath.length === 4) {
        const [jtNm, jFieldNm, tblName, lblField] = kpath;
        const pk = table ? table.pk_name : "id";
        qstate[pk] = [
          ...(qstate[pk] ? [qstate[pk]] : []),
          {
            // where id in (select ss1.id from jtNm ss1 join tblName ss2 on ss2.id = ss1.jFieldNm where ss2.lblField=v)
            inSelect: {
              table: db.sqlsanitize(jtNm),
              tenant: db.isSQLite ? undefined : db.getTenantSchema(),
              field: db.sqlsanitize(jFieldNm),
              valField: Table.findOne(jtNm)?.pk_name || "id",
              through: db.sqlsanitize(tblName),
              through_pk: Table.findOne(tblName)?.pk_name || "id",
              where: { [db.sqlsanitize(lblField)]: v },
            },
          },
        ];
      }
    }
  });
  if (orFields.length === 1) {
    const orKey = orFields[0];
    const orVal = qstate[orKey];
    delete qstate[orKey];
    return { or: [{ [orKey]: orVal }, qstate] };
  } else
    orFields.forEach((orField) => {
      if (typeof qstate[orField] === "undefined") return;
      if (!qstate.or) qstate.or = [];
      qstate.or.push({ [orField]: qstate[orField] });
      delete qstate[orField];
    });

  return qstate;
};

/**
 * initial_config_all_fields Contract
 * @function
 * @returns {function}
 * @param isEdit
 */
const initial_config_all_fields =
  (isEdit: boolean) =>
  async ({
    table_id,
    exttable_name,
  }: {
    table_id?: number;
    exttable_name?: string;
  }): Promise<any> => {
    const table = Table.findOne(
      table_id ? { id: table_id } : { name: exttable_name! }
    );
    if (!table) throw new Error("Table not found");

    const fields = table
      .getFields()
      .filter(
        (f) =>
          (!f.primary_key || f?.attributes?.NonSerial) &&
          (!isEdit || !f.calculated)
      );
    let cfg: GenObj = { columns: [] };
    let aboves: (GenObj | null)[] = [null];
    const style = {
      "margin-bottom": "1.5rem",
    };

    fields.forEach((f) => {
      if (!f.type) return;
      const flabel = {
        above: [
          null,
          {
            type: "blank",
            block: false,
            contents: f.label,
            textStyle: "",
            ...(isEdit ? { labelFor: f.name } : {}),
          },
        ],
      };
      if (
        f.is_fkey &&
        f.type !== "File" &&
        f.reftable_name !== "users" &&
        !isEdit
      ) {
        cfg.columns.push({
          type: "JoinField",
          join_field: `${f.name}.${
            f.attributes.summary_field ||
            Table.findOne(f.reftable_name!)?.pk_name ||
            "id"
          }`,
        });
        aboves.push({
          widths: [2, 10],
          aligns: ["end", "start"],
          style,
          besides: [
            flabel,
            {
              above: [
                null,
                {
                  type: "join_field",
                  block: false,
                  textStyle: "",
                  join_field: `${f.name}.${f.attributes.summary_field}`,
                },
              ],
            },
          ],
        });
      } else if (f.reftable_name !== "users") {
        const fvNm = (f.type as any)?.fieldviews
          ? (
              Object.entries((f.type as any).fieldviews) as [string, any][]
            ).find(([nm, fv]: [string, any]) => fv.isEdit === isEdit)?.[0]
          : f.type === "File" && !isEdit
            ? Object.keys(getState().fileviews)[0]
            : f.type === "File" && isEdit
              ? "upload"
              : f.type === "Key"
                ? "select"
                : undefined;
        cfg.columns.push({
          field_name: f.name,
          type: "Field",
          fieldview: fvNm,
        });
        aboves.push({
          widths: [2, 10],
          aligns: ["end", "start"],
          style,
          besides: [
            flabel,
            {
              above: [
                null,
                {
                  type: "field",
                  block: false,
                  fieldview: fvNm,
                  textStyle: "",
                  field_name: f.name,
                },
              ],
            },
          ],
        });
      }
    });
    if (isEdit)
      aboves.push({
        widths: [2, 10],
        aligns: ["end", "start"],
        style,
        besides: [
          null,
          {
            type: "action",
            block: false,
            minRole: 100,
            action_name: "Save",
          },
        ],
      });
    cfg.layout = { above: aboves };
    return cfg;
  };

/**
 * Strict Parse Int
 * @param {string} x
 * @returns {number|undefined}
 */
// todo potentially move to utils
const strictParseInt = (x: string | number): number | undefined => {
  const y = +x;
  return !isNaN(y) && (y || y === 0) ? y : undefined;
};

/**
 * Read State
 * @param {object} state
 * @param {object[]} fields
 * @param req
 * @returns {object}
 */
const readState = (state: GenObj, fields: Field[], req?: GenObj): GenObj => {
  const read_key = (f: Field, current: unknown) =>
    current === "null" || current === "" || current === null
      ? null
      : getState().types[f.reftype as string].read(current, f.attributes);
  fields.forEach((f) => {
    const current = state[f.name];
    if (typeof current !== "undefined") {
      if (current === "null") state[f.name] = null;
      else if (
        Array.isArray(current) &&
        current.length &&
        typeof current[0] === "object"
      ) {
        //ignore (this is or statement)
      } else if (Array.isArray(current) && (f.type as any)?.read) {
        state[f.name] = current.map((val) =>
          (f.type as any).read(val, f.attributes)
        );
      } else if (
        Array.isArray(current) &&
        f.is_fkey &&
        f.reftype === "Integer"
      ) {
        state[f.name] = current.map((v) => read_key(f, v));
      } else if (current && current.slugify)
        state[f.name] = (f.type as any)?.read
          ? { slugify: (f.type as any).read(current.slugify, f.attributes) }
          : current;
      else if (typeof current === "object") {
        //ignore
      } else if ((f.type as any)?.read)
        state[f.name] = (f.type as any).read(current, f.attributes);
      else if (typeof current === "string" && current.startsWith("Preset:")) {
        const pname = current.replace("Preset:", "");
        if (Object.prototype.hasOwnProperty.call(f.presets, pname)) {
          const preset = (f.presets as any)[pname];
          state[f.name] = preset(req);
        }
      } else if (f.type === "File") state[f.name] = current;
      else if (f.type === "Key") state[f.name] = read_key(f, current);
    }
  });
  return state;
};

/**
 * Read State Strict
 * @deprecated use Table.read_state_strict
 * @param {object} state
 * @param {object[]} fields
 * @returns {boolean|*}
 */
const readStateStrict = (state: GenObj, fields: Field[]): false | GenObj => {
  let hasErrors = false;
  fields.forEach((f) => {
    const current = state[f.name];
    //console.log(f.name, current, typeof current);

    if (typeof current !== "undefined") {
      if ((f.type as any)?.read) {
        const readval = (f.type as any).read(current, f.attributes);
        if (typeof readval === "undefined") {
          if (current === "" && !f.required) delete state[f.name];
          else hasErrors = true;
        }
        if (f.type && (f.type as any).validate) {
          const vres = (f.type as any).validate(f.attributes || {})(readval);
          if (vres.error) hasErrors = true;
        }
        state[f.name] = readval;
      } else if (f.type === "Key")
        state[f.name] =
          current === "null" || current === "" || current === null
            ? null
            : +current;
      else if (f.type === "File")
        state[f.name] =
          current === "null" || current === "" || current === null
            ? null
            : current;
    } else if (f.required && !f.primary_key) hasErrors = true;
  });
  return hasErrors ? false : state;
};
/**
 * JSON List to external table
 * Hiiden "exttables_min_role_read" can be used to manage min role for external tables
 * @param {function} get_json_list
 * @param {object[]} fields0
 * @returns {object}
 */
const json_list_to_external_table = (
  get_json_list: Function,
  fields0: (Field | FieldLike)[],
  methods: GenObj = {},
  tableRow: GenObj = {}
): GenObj => {
  const fields: Field[] = fields0.map((f) =>
    f.constructor.name === Object.name ? new Field(f) : (f as Field)
  );
  const getRows = async (where: Where = {}, selopts: GenObj = {}) => {
    const { forUser, forPublic, ...selopts1 } = selopts;
    const role = forUser ? forUser.role_id : forPublic ? 100 : null;

    if (
      role &&
      tableRow?.updateWhereWithOwnership &&
      tableRow.updateWhereWithOwnership(
        where,
        forUser || { role_id: 100 },
        true
      )?.notAuthorized
    ) {
      return [];
    }
    let data_in = await get_json_list(where, selopts);
    if (methods?.disableFiltering) return data_in;
    const restricts = Object.entries(where);
    const sat =
      (x: any): any =>
      ([k, v]: [string, any]): any => {
        if (k === "or" && Array.isArray(v))
          return v.some((v1) => Object.entries(v1).every((kv1) => sat(x)(kv1)));
        else if (v?.in) return v.in.includes(x[k]);
        else if (Array.isArray(v)) return v.every((v1) => sat(x)([k, v1]));
        else if (k === "_fts")
          return JSON.stringify(x)
            .toLowerCase()
            .includes((v.searchTerm || "").toLowerCase());
        else if (v?.lt && v?.equal) return x[k] <= +v.lt;
        else if (v?.lt) return x[k] < +v.lt;
        else if (v?.gt && v?.equal) return x[k] >= +v.gt;
        else if (v?.gt) return x[k] > +v.gt;
        else if (v?.ilike) return (x[k] || "").includes(v.ilike);
        else return x[k] == v;
      };
    const data_filtered =
      restricts.length === 0
        ? data_in
        : data_in.filter((x: any) => restricts.every(sat(x)));
    if (selopts.orderBy && typeof selopts.orderBy === "string") {
      const cmp = selopts.orderDesc
        ? new Function(
            "a,b",
            `return b.${selopts.orderBy}-a.${selopts.orderBy}`
          )
        : new Function(
            "a,b",
            `return a.${selopts.orderBy}-b.${selopts.orderBy}`
          );
      data_filtered.sort(cmp);
    }
    if (selopts.limit)
      return data_filtered.slice(
        selopts.offset || 0,
        (selopts.offset || 0) + selopts.limit
      );
    else return data_filtered;
  };
  const composite_pk_names = fields
    .filter((f) => f.primary_key)
    .map((f) => f.name);
  const tbl: any = {
    pk_name: fields.find((f) => f.primary_key)?.name,
    pk_type: fields.find((f) => f.primary_key)?.type,
    composite_pk_names:
      composite_pk_names.length < 2 ? null : composite_pk_names,
    getFields() {
      return fields;
    },
    getForeignKeys() {
      return fields.filter((f) => f.is_fkey && f.type !== "File");
    },
    getField(fnm: string) {
      if (typeof fnm !== "string") {
        // Prevent type confusion if not a string
        return undefined;
      }
      if (fnm.includes(".")) {
        const [myfld, ...rest] = fnm.split(".");
        const f = fields.find((f) => f.name === myfld);
        const refTbl = Table.findOne(f!.reftable_name!);
        return refTbl?.getField(rest.join("."));
      }
      return fields.find((f) => f.name === fnm);
    },
    fields,
    getRows,
    async getRow(where: Where, opts: GenObj) {
      const rows = await getRows(where, opts);
      return rows.length ? rows[0] : null;
    },
    get min_role_read() {
      const roles = getState().getConfig("exttables_min_role_read", {});
      return roles[tbl.name] || 100;
    },
    async getJoinedRows(opts: GenObj = {}) {
      if (!opts.where) opts.where = {};
      const { forUser, forPublic } = opts;
      const role = forUser ? forUser.role_id : forPublic ? 100 : null;
      if (
        role &&
        tableRow?.updateWhereWithOwnership &&
        tableRow.updateWhereWithOwnership(
          opts.where,
          forUser || { role_id: 100 },
          true
        )?.notAuthorized
      ) {
        return [];
      }
      if (methods?.getJoinedRows) {
        return await methods.getJoinedRows(opts);
      }
      const { where, ...rest } = opts;
      return await getRows(where || {}, rest || {});
    },
    async getJoinedRow(opts: GenObj = {}) {
      const rows = await this.getJoinedRows(opts);
      return rows.length > 0 ? rows[0] : null;
    },
    delete_url(row: Row, moreQuery: string) {
      const comppk = tbl.composite_pk_names;
      if (!comppk)
        return `/delete/${tbl.name}/${encodeURIComponent(row[tbl.pk_name])}${
          moreQuery ? `?${moreQuery}` : ""
        }`;
      else
        return `/delete/${tbl.name}?${comppk
          .map(
            (pknm: string) =>
              `${encodeURIComponent(pknm)}=${encodeURIComponent(row[pknm])}`
          )
          .join("&")}${moreQuery ? `&${moreQuery}` : ""}`;
    },
    async countRows(where: Where, opts: GenObj) {
      if (methods?.countRows) {
        return await methods.countRows(where, opts);
      }
      let data_in = await get_json_list(where, opts);
      return data_in.length;
    },
    //copied from table
    async get_child_relations(allow_join_aggregations: boolean) {
      const cfields = await Field.find(
        { reftable_name: tbl.name },
        { cached: true }
      );
      let child_relations = [];
      let child_field_list = [];
      for (const f of cfields) {
        if (f.is_fkey) {
          const table = Table.findOne({ id: f.table_id });
          if (!table) {
            throw new Error(`Unable to find table with id: ${f.table_id}`);
          }
          child_field_list.push(`${table.name}.${f.name}`);
          table.getFields();
          child_relations.push({ key_field: f, table });
        }
      }
      if (allow_join_aggregations) {
        for (const f of fields) {
          if (f.is_fkey && f.type !== "File") {
            const refTable = Table.findOne({ name: f.reftable_name });
            if (!refTable)
              throw new Error(`Unable to find table '${f.reftable_name}`);

            const join_crels = await refTable.get_child_relations(false);
            join_crels.child_relations.forEach(({ key_field, table }) => {
              child_field_list.push(
                `${f.name}->${table.name}.${key_field.name}`
              );
              child_relations.push({ key_field, table, through: f });
            });
          }
        }
      }
      return { child_relations, child_field_list };
    },
    //copied from table
    async get_parent_relations(allow_double: boolean, allow_triple: boolean) {
      let parent_relations: {
        key_field: Field;
        table?: Table;
        ontable?: Table;
        through?: Field;
      }[] = [];
      let parent_field_list = [];
      for (const f of fields) {
        if (f.is_fkey && f.type !== "File") {
          const table = Table.findOne({ name: f.reftable_name });
          if (!table)
            throw new Error(`Unable to find table '${f.reftable_name}`);
          table.getFields();
          if (!table.fields)
            throw new Error(`The table '${f.reftable_name} has no fields.`);

          for (const pf of table.fields.filter(
            (f) => !f.calculated || f.stored
          )) {
            parent_field_list.push(`${f.name}.${pf.name}`);
            if (pf.is_fkey && pf.type !== "File" && allow_double) {
              const table1 = Table.findOne({ name: pf.reftable_name });
              if (!table1)
                throw new Error(`Unable to find table '${pf.reftable_name}`);
              await table1.getFields();
              if (!table1.fields)
                throw new Error(
                  `The table '${pf.reftable_name} has no fields.`
                );
              if (table1.fields)
                for (const gpf of table1.fields.filter(
                  (f) => !f.calculated || f.stored
                )) {
                  parent_field_list.push(`${f.name}.${pf.name}.${gpf.name}`);
                  if (allow_triple && gpf.is_fkey && gpf.type !== "File") {
                    const gpfTbl = Table.findOne({
                      name: gpf.reftable_name,
                    });
                    if (gpfTbl) {
                      const gpfFields = await gpfTbl.getFields();
                      for (const ggpf of gpfFields.filter(
                        (f) => !f.calculated || f.stored
                      )) {
                        parent_field_list.push(
                          `${f.name}.${pf.name}.${gpf.name}.${ggpf.name}`
                        );
                      }
                    }
                  }
                }

              parent_relations.push({
                key_field: pf,
                through: f,
                table: table1,
              });
            }
          }
          parent_relations.push({ key_field: f, table });
        }
      }
      const o2o_rels = await Field.find(
        {
          reftable_name: tbl.name,
          is_unique: true,
        },
        { cached: true }
      );
      for (const relation of o2o_rels) {
        const related_table = Table.findOne({ id: relation.table_id });
        if (related_table) {
          const relfields = await related_table.getFields();
          for (const relfield of relfields) {
            parent_field_list.push(
              `${related_table.name}.${relation.name}->${relfield.name}`
            );
            parent_relations.push({
              key_field: relation,
              ontable: related_table,
            });
          }
        }
      }

      return { parent_relations, parent_field_list };
    },
    //copied from table
    async get_relation_options() {
      return await Promise.all(
        (await tbl.get_relation_data()).map(
          async ({
            relationTable,
            relationField,
          }: {
            relationTable: Table;
            relationField: Field;
          }) => {
            const path = `${relationTable.name}.${relationField.name}`;
            const relFields = await relationTable.getFields();
            const names = relFields
              .filter((f) => f.type !== "Key")
              .map((f) => f.name);
            return { relationPath: path, relationFields: names };
          }
        )
      );
    },
    //copied from table
    async get_relation_data(unique = true) {
      const result = [];
      const o2o_rels = await Field.find(
        {
          reftable_name: tbl.name,
          is_unique: unique,
        },
        { cached: true }
      );
      for (const field of o2o_rels) {
        const relTbl = Table.findOne({ id: field.table_id });
        if (relTbl)
          result.push({ relationTable: relTbl, relationField: field });
      }
      return result;
    },
    //copied from table
    async get_join_field_options(allow_double: boolean, allow_triple: boolean) {
      const result: any[] = [];
      for (const f of fields) {
        if (f.is_fkey && f.type !== "File") {
          const table = Table.findOne({ name: f.reftable_name });
          if (!table)
            throw new Error(`Unable to find table '${f.reftable_name}`);
          table.getFields();
          if (!table.fields)
            throw new Error(`The table '${f.reftable_name} has no fields.`);
          const subOne: any = {
            name: f.name,
            table: table.name,
            subFields: [] as any[],
            fieldPath: f.name,
          };
          for (const pf of table.fields.filter(
            (f) => !f.calculated || f.stored
          )) {
            const subTwo: any = {
              name: pf.name,
              subFields: [] as any[],
              fieldPath: `${f.name}.${pf.name}`,
            };
            if (pf.is_fkey && pf.type !== "File" && allow_double) {
              const table1 = Table.findOne({ name: pf.reftable_name });
              if (!table1)
                throw new Error(`Unable to find table '${pf.reftable_name}`);
              await table1.getFields();
              subTwo.table = table1.name;
              if (!table1.fields)
                throw new Error(
                  `The table '${pf.reftable_name} has no fields.`
                );
              if (table1.fields)
                for (const gpf of table1.fields.filter(
                  (f) => !f.calculated || f.stored
                )) {
                  const subThree: any = {
                    name: gpf.name,
                    subFields: [] as any[],
                    fieldPath: `${f.name}.${pf.name}.${gpf.name}`,
                  };
                  if (allow_triple && gpf.is_fkey && gpf.type !== "File") {
                    const gpfTbl = Table.findOne({
                      name: gpf.reftable_name,
                    });
                    if (gpfTbl) {
                      subThree.table = gpfTbl.name;
                      const gpfFields = await gpfTbl.getFields();
                      for (const ggpf of gpfFields.filter(
                        (f) => !f.calculated || f.stored
                      )) {
                        subThree.subFields.push({
                          name: ggpf.name,
                          fieldPath: `${f.name}.${pf.name}.${gpf.name}.${ggpf.name}`,
                        });
                      }
                    }
                  }
                  subTwo.subFields.push(subThree);
                }
            }
            subOne.subFields.push(subTwo);
          }
          result.push(subOne);
        }
      }
      return result;
    },
    slug_options() {
      return [];
    },
    enable_fkey_constraints() {},
    ownership_options() {
      return [];
    },
    external: true,
    owner_fieldname() {
      return null;
    },
    async distinctValues(fldNm: string, opts: GenObj) {
      if (methods?.distinctValues)
        return await methods.distinctValues(fldNm, opts);
      let data_in = await get_json_list(opts || {});
      const s = new Set(data_in.map((x: Row) => x[fldNm]));
      return [...s];
    },
    async getTags() {
      return await Tag.findWithEntries({ table_id: tbl.id });
    },
    async getForeignTables() {
      const tableNames = new Set(
        tbl.fields
          .filter((f: Field) => f.is_fkey && f.reftable_name)
          .map((f: Field) => f.reftable_name)
      );
      return Array.from(tableNames).map((tname) =>
        Table.findOne({ name: tname })
      );
    },
  };
  if (methods?.aggregationQuery)
    tbl.aggregationQuery = methods.aggregationQuery;
  if (methods?.deleteRows) tbl.deleteRows = methods.deleteRows;
  if (methods?.updateRow) {
    tbl.updateRow = methods.updateRow;
    tbl.tryUpdateRow = async (...args: any[]) => {
      try {
        const maybe_err = await methods.updateRow(...args);
        if (typeof maybe_err === "string") return { error: maybe_err };
        else return { success: true };
      } catch (error: unknown) {
        return { error: (error as Error)?.message || error };
      }
    };
  }
  if (methods?.insertRow) {
    tbl.insertRow = methods.insertRow;
    tbl.tryInsertRow = async (...args: any[]) => {
      try {
        const id = await methods.insertRow(...args);
        return { success: id };
      } catch (error: unknown) {
        return { error: (error as Error)?.message || error };
      }
    };
  }

  return tbl;
};

/**
 * check if we should wait for an action or trigger to finish
 * @param {any} col Action Column from the configuration
 * @returns true or false
 */
const shoudlRunAsync = (col: GenObj): boolean => {
  const action_name = col.action_name;
  const state_action = getState().actions[action_name];
  if (state_action) return !!col.run_async;
  else {
    const trigger = Trigger.findOne({ name: action_name });
    if (!trigger || trigger.action === "Multi-step action") return false;
    if (trigger.action === "Workflow")
      return !!col.run_async || !!trigger.configuration?.run_async || false;
    else return !!col.run_async;
  }
};

/**
 * Run Action Column
 * @param {object} col
 * @param {object} req
 * @param {...*} rest
 * @returns {Promise<*>}
 */
const run_action_column = async ({
  col,
  req,
  ...rest
}: {
  col: GenObj;
  req: GenObj;
  [key: string]: any;
}): Promise<any> => {
  let run_async = shoudlRunAsync(col);
  if (run_async && !getState().getConfig("enable_dynamic_updates")) {
    run_async = false;
    getState().log(
      4,
      `Warning: '${col.action_name}' is set to run async but dynamic updates are disabled. Running synchronously instead.`
    );
  }
  const reset_spinner = (state: any) => {
    if (!col.spinner) return;
    if (!req.headers["page-load-tag"]) return;
    const reset_msg = {
      eval_js: "reset_spinners()",
      page_load_tag: req.headers["page-load-tag"],
    };
    state.emitDynamicUpdate(db.getTenantSchema(), reset_msg);
  };
  const successAsyncHandler = (data: GenObj) => {
    const state = getState();
    state.log(6, `Asynchronous action result: ${JSON.stringify(data)}`);
    const emitData = { ...data };
    if (req.headers["page-load-tag"])
      emitData.page_load_tag = req.headers["page-load-tag"];
    state.emitDynamicUpdate(db.getTenantSchema(), emitData);
    if (
      !emitData.resume_workflow &&
      !emitData.popup?.startsWith?.("/actions/fill-workflow-form/")
    )
      reset_spinner(state);
  };
  const failureAsyncHandler = (err: Error & { message: string }) => {
    const state = getState();
    state.log(2, `Asynchronous action error`, err);
    if (req.headers["page-load-tag"]) {
      state.emitDynamicUpdate(db.getTenantSchema(), {
        error: err.message || err,
        page_load_tag: req.headers["page-load-tag"],
      });
    }
    reset_spinner(state);
  };
  const run_action_step = async (action_name: string, colcfg: GenObj) => {
    let state_action = getState().actions[action_name];
    let configuration: GenObj;
    let goRun: (() => Promise<any>) | undefined;
    if (state_action) {
      configuration = colcfg;
      goRun = () =>
        state_action.run({
          configuration,
          user: req.user,
          req,
          ...rest,
        });
    } else {
      const trigger = await Trigger.findOne({ name: action_name });

      if (
        trigger?.action === "Multi-step action" ||
        trigger?.action === "Workflow"
      ) {
        if (
          col.configuration?.initial_context &&
          trigger.action === "Workflow"
        ) {
          const inirow = eval_expression(
            col.configuration.initial_context,
            rest?.row || {},
            req?.user,
            "Workflow initial context"
          );
          if (rest.row) {
            rest.row = { ...rest.row, ...inirow };
          } else rest.row = inirow;
        }
        goRun = () =>
          trigger.runWithoutRow({ req, interactive: true, ...rest });
      } else if (trigger) {
        state_action = getState().actions[trigger.action];
        goRun = () =>
          state_action.run({
            configuration: trigger.configuration,
            trigger_id: trigger.id,
            user: req.user,
            req,
            ...rest,
          });
      }
    }
    if (!goRun)
      throw new Error("Runnable action not found: " + text(action_name));
    return await goRun();
  };
  if (col.action_name === "Multi-step action") {
    let result: GenObj = {};
    let step_count = 0;
    let MAX_STEPS = 200;
    for (
      let i = 0;
      i < col.step_action_names.length && step_count < MAX_STEPS;
      i++
    ) {
      step_count += 1;

      const action_name = col.step_action_names?.[i];
      if (!action_name) continue;
      const only_if = col.step_only_ifs?.[i];
      const config = col.configuration.steps?.[i] || {};
      if (only_if && rest.row) {
        if (
          !eval_expression(
            only_if,
            rest.row,
            req?.user,
            "Multistep action only if formula"
          )
        )
          continue;
      }
      const stepres = await run_action_step(action_name, config);
      if (stepres?.goto_step) {
        i = +stepres.goto_step - 2;
        delete stepres.goto_step;
      }
      if (stepres?.clear_return_values) result = {};
      if (stepres?.set_fields && rest?.row) {
        Object.entries(stepres?.set_fields).forEach(([k, v]) => {
          rest.row[k] = v;
        });
      }
      try {
        mergeActionResults(result, stepres);
      } catch (error) {
        console.error(error);
      }
      if (result.error || result.halt_steps) break;
    }
    return result;
  } else {
    const promise = run_action_step(col.action_name, col.configuration);
    if (run_async) {
      promise.then(successAsyncHandler).catch(failureAsyncHandler);
    } else return await promise;
  }
};

const displayType = (stateFields: { name: string; required?: boolean }[]) =>
  stateFields.every((sf) => !sf.required)
    ? ViewDisplayType.NO_ROW_LIMIT
    : stateFields.some((sf) => sf.name === "id")
      ? ViewDisplayType.ROW_REQUIRED
      : ViewDisplayType.INVALID;

const build_schema_data = async (): Promise<any> => {
  const allViews = await View.find({}, { cached: true });
  const allTables = await Table.find({}, { cached: true });
  const tableIdToName: Record<number, string> = {};
  allTables.forEach((t) => {
    if (t.id != null) tableIdToName[t.id] = t.name;
  });
  const views = await Promise.all(
    allViews.map(async (v) => ({
      name: v.name,
      table_id: v.table_id,
      label: `${v.name} [${v.viewtemplate}] ${
        (v.table_id != null && tableIdToName[v.table_id]) || ""
      }`,
      viewtemplate: v.viewtemplate,
      display_type: displayType(await v.get_state_fields()),
    }))
  );
  const tables = await Promise.all(
    allTables.map(async (t) => ({
      name: t.name,
      id: t.id,
      //for edit-in-edit
      int_fields: t.fields
        .filter(
          (f) =>
            (f.type as any)?.name === "Integer" &&
            !f.calculated &&
            !f.primary_key
        )
        .map((f) => f.name),
      foreign_keys: t.getForeignKeys().map((f) => ({
        name: f.name,
        id: f.id,
        table_id: t.id,
        reftable_name: f.reftable_name,
        is_unique: f.is_unique,
      })),
    }))
  );
  return { views, tables };
};

/**
 *
 * @param {Relation} relation
 * @param {function} getRowVal
 */
const pathToState = (
  relation: GenObj,
  getRowVal: (key: string) => any
): GenObj => {
  const sourceTbl = Table.findOne({ name: relation.sourceTblName });
  const pkName = sourceTbl?.pk_name || "id";
  const path = relation.path;
  switch (relation.type) {
    case RelationType.CHILD_LIST:
    case RelationType.ONE_TO_ONE_SHOW:
      return path.length === 1
        ? { [path[0].inboundKey]: getRowVal(pkName) }
        : {
            [`${path[1].table}.${path[1].inboundKey}.${path[0].table}.${path[0].inboundKey}`]:
              getRowVal(pkName),
          };
    case RelationType.PARENT_SHOW:
      const targetTable = Table.findOne({ name: relation.targetTblName });
      return { [targetTable?.pk_name || "id"]: getRowVal(path[0].fkey) };
    case RelationType.OWN:
      return { [pkName]: getRowVal(pkName) };
    case RelationType.INDEPENDENT:
    case RelationType.NONE:
      return {};
    case RelationType.RELATION_PATH:
      return relation.isFixedRelation()
        ? {
            [pkName]: getRowVal(pkName),
          }
        : {
            [relation.relationString]:
              getRowVal(path[0].fkey ? path[0].fkey : pkName) || "NULL",
          };
  }
  return {};
};

/**
 * Run custom real-time collaboration events
 * @param {*} events events from the cfg of a view
 * @param {*} user
 * @param {*} actionData data to run the actions on
 * @returns an array of action results
 */
const runCollabEvents = async (
  events: { event: string }[],
  user: AbstractUser | undefined,
  actionData: GenObj
): Promise<any[]> => {
  const actionResults = [];
  const role = user?.role_id || 100;
  for (const { event } of events || []) {
    const trigger = Trigger.findOne({ name: event });
    if (!trigger) {
      getState().log(6, `Trigger '${event}' not found, skipping`);
      continue;
    }
    if (role > trigger.min_role) {
      getState().log(6, `Trigger '${event}' not authorized`);
      continue;
    }

    let resp;
    if (trigger.action === "Workflow") {
      resp = await trigger.runWithoutRow({
        interactive: true,
        row: actionData,
        user: user || { role_id: 100 },
      });
      delete resp.__wf_run_id;
    } else {
      const action = getState().actions[trigger.action];
      if (!action) {
        getState().log(
          6,
          `Action '${trigger.action}' for trigger '${event}' not found, skipping`
        );
        continue;
      }

      getState().log(6, `Running trigger '${event}'`);
      resp = await action.run({
        configuration: trigger.configuration,
        row: actionData,
        user: user,
      });
    }
    if (resp) actionResults.push(resp);
  }
  return actionResults;
};

export {
  field_picker_fields,
  picked_fields_to_query,
  generate_joined_query,
  get_child_views,
  get_parent_views,
  stateFieldsToWhere,
  stateFieldsToQuery,
  initial_config_all_fields,
  calcfldViewOptions,
  calcrelViewOptions,
  get_link_view_opts,
  readState,
  readStateStrict,
  stateToQueryString,
  link_view,
  getActionConfigFields,
  calcfldViewConfig,
  strictParseInt,
  run_action_column,
  json_list_to_external_table,
  add_free_variables_to_joinfields,
  get_inbound_relation_opts,
  get_inbound_self_relation_opts,
  get_many_to_many_relation_opts,
  build_schema_data,
  pathToState,
  displayType,
  sqlBinOp,
  sqlFun,
  runCollabEvents,
};
