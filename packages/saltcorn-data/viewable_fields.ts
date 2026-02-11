/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/viewable_fields
 * @subcategory base-plugin
 */
import Table from "./models/table";
import Field from "./models/field";
import View from "./models/view";
import type { Row } from "@saltcorn/db-common/internal";
import type { GenObj, Type } from "@saltcorn/types/common_types";
import { instanceOfType } from "@saltcorn/types/common_types";
import type { AbstractUser } from "@saltcorn/types/model-abstracts/abstract_user";

const { post_btn } = require("@saltcorn/markup");
const {
  text,
  a,
  i,
  div,
  button,
  span,
  script,
  domReady,
  input,
} = require("@saltcorn/markup/tags");
const { getState, getReq__ } = require("./db/state");
const {
  link_view,
  displayType,
  run_action_column,
  stateToQueryString,
  pathToState,
} = require("./plugin-helper");
const {
  eval_expression,
  freeVariables,
  get_expression_function,
} = require("./models/expression");
const FieldRepeat = require("./models/fieldrepeat");
const Form = require("./models/form");
const { traverseSync, traverse, translateLayout } = require("./models/layout");
const {
  structuredClone,
  isWeb,
  isOfflineMode,
  getSessionId,
  interpolate,
  objectToQueryString,
  validSqlId,
  InvalidConfiguration,
  renderServerSide,
} = require("./utils");
const db = require("./db");
const { isNode, dollarizeObject, getSafeBaseUrl } = require("./utils");
const { bool, date } = require("./base-plugin/types");
const _ = require("underscore");
const renderLayout = require("@saltcorn/markup/layout");
const Crash = require("./models/crash");

const {
  Relation,
  parseRelationPath,
  RelationType,
  ViewDisplayType,
} = require("@saltcorn/common-code");
const { show_icon_and_label } = require("@saltcorn/markup/layout_utils");

/**
 * formats the column index of a view cfg
 * @param {number|undefined} colIndex
 * @returns json formatted attribute for run_action
 */
const columnIndex = (colIndex?: number): string =>
  colIndex ? `, column_index: ${colIndex}` : "";

/**
 * @param {string} viewname
 * @param {Table|object} table
 * @param {string} action_name
 * @param {object} r
 * @param {string} colId
 * @param {string} colIdNm
 * @param {string} confirm
 * @param {number|undefined} index
 * @returns {any}
 */
const action_url = (
  viewname: string,
  table: Table,
  action_name: string,
  r: Row,
  colId: string,
  colIdNm: string,
  confirm: boolean,
  colIndex?: number,
  runAsync?: boolean
): string | { javascript: string } => {
  const pk_name = table.pk_name;
  const __ = getReq__();
  const confirmStr = confirm ? `if(confirm('${__("Are you sure?")}'))` : "";
  if (action_name === "Delete") {
    return {
      javascript: `${confirmStr}${isNode() ? "ajax" : "local"}_post_btn('${
        !isNode() ? "post" : ""
      }${table.delete_url(r, `redirect=/view/${viewname}`)}', true)`,
    };
  } else if (action_name === "GoBack")
    return {
      javascript: isNode()
        ? "history.back()"
        : "parent.saltcorn.mobileApp.navigation.goBack()",
    };
  else if (action_name.startsWith("Toggle")) {
    const field_name = action_name.replace("Toggle ", "");
    return `/edit/toggle/${table.name}/${r[pk_name]}/${field_name}?redirect=/view/${viewname}`;
  }
  return {
    javascript: `${confirmStr}view_post('${viewname}', 'run_action', {${colIdNm}:'${colId}'${
      r ? `, ${pk_name}:'${r?.[pk_name]}'` : ""
    }${columnIndex(colIndex)}}${runAsync ? `,{runAsync:true}` : ""});`,
  };
};

/**
 * @param {string} url
 * @param {object} req
 * @param {object} opts
 * @param {string} opts.action_name
 * @param {string} opts.action_label
 * @param {*} opts.confirm
 * @param {*} opts.rndid
 * @param {string} opts.action_style
 * @param {number} opts.action_size
 * @param {*} opts.action_icon
 * @param {string} opts.action_bgcol
 * @param {string} opts.action_bordercol
 * @param {string} opts.action_textcol
 * @param {*} __
 * @returns {object}
 */
const action_link = (
  url: string | { javascript: string },
  req: GenObj,
  {
    action_name,
    action_label,
    confirm,
    rndid,
    action_style,
    action_size,
    action_icon,
    action_bgcol,
    action_title,
    action_class,
    action_bordercol,
    action_textcol,
    spinner,
    block,
  }: {
    action_name: string;
    action_label?: string;
    confirm?: boolean;
    rndid?: string;
    action_style?: string;
    action_size?: string;
    action_icon?: string;
    action_bgcol?: string;
    action_title?: string;
    action_class?: string;
    action_bordercol?: string;
    action_textcol?: string;
    spinner?: boolean;
    block?: boolean;
  },
  __ = (s: string) => s
): string => {
  const label =
    action_label === " " ? "" : __(action_label || "") || action_name;
  let style =
    action_style === "btn-custom-color"
      ? `background-color: ${action_bgcol || "#000000"};border-color: ${
          action_bordercol || "#000000"
        }; color: ${action_textcol || "#000000"}`
      : null;
  if (typeof url !== "string" && url.javascript)
    return a(
      {
        href: "javascript:void(0)",
        onclick: `${spinner ? "spin_action_link(this);" : ""}${url.javascript}`,
        class: [
          action_style === "btn-link"
            ? ""
            : `btn ${action_style || "btn-primary"} ${action_size || ""}`,
          action_class,
        ],
        style,
        title: action_title,
      },
      action_icon && action_icon !== "empty"
        ? i({ class: action_icon }) + (label ? "&nbsp;" : "")
        : false,
      label
    );
  else
    return post_btn(url, label, req.csrfToken(), {
      confirm,
      req,
      icon: action_icon,
      style,
      spinner,
      btnClass: `${action_style || "btn-primary"} ${action_size || ""}`,
      formClass: !block && "d-inline",
    });
};

const slug_transform =
  (row: Row) =>
  (step: { transform?: string; field: string }): string =>
    step.transform === "slugify"
      ? `/${db.slugify(row[step.field])}`
      : `/${row[step.field]}`;
/**
 * @function
 * @param {Field[]} fields
 * @returns {function}
 */
const get_view_link_query = (
  fields: Field[],
  view?: any
): ((r: Row) => string) => {
  if (view && view.slug && view.slug.steps && view.slug.steps.length > 0) {
    return (r: Row) => view.slug.steps.map(slug_transform(r)).join("");
  }

  const pk_name = fields.find((f) => f.primary_key)!.name;

  return (r: Row) => `?${pk_name}=${r[pk_name]}`;
};

/**
 * @function
 * @param {object} opts
 * @param {string} opts.link_text
 * @param {boolean} opts.link_text_formula missing in contract
 * @param {string} [opts.link_url]
 * @param {boolean} opts.link_url_formula
 * @param {boolean} opts.link_target_blank
 * @param {Field[]} fields
 * @returns {object}
 */
const make_link = (
  {
    link_text,
    link_text_formula,
    link_url,
    link_url_formula,
    link_target_blank,
    in_dropdown,
    in_modal,
    link_icon,
    icon,
    link_style,
    link_size,
  }: {
    link_text: string;
    link_text_formula?: boolean;
    link_url?: string;
    link_url_formula?: boolean;
    link_target_blank?: boolean;
    in_dropdown?: boolean;
    in_modal?: boolean;
    link_icon?: string;
    icon?: string;
    link_style?: string;
    link_size?: string;
  },
  fields: Field[],
  __ = (s: string) => s,
  in_row_click?: boolean
) => {
  return {
    label: "",
    key: (r: Row) => {
      let txt, href;
      const theIcon = link_icon || icon;

      txt = link_text_formula
        ? eval_expression(link_text, r, undefined, "Link text formula")
        : link_text;

      href = link_url_formula
        ? eval_expression(link_url, r, undefined, "Link URL formula")
        : link_url;

      const attrs: any = { href };
      if (link_target_blank) attrs.target = "_blank";
      if (in_dropdown) attrs.class = ["dropdown-item"];
      if (link_style)
        attrs.class = [
          ...(attrs.class || []),
          link_style,
          link_style.includes("btn") && "d-inline-block",
        ];
      if (link_size) attrs.class = [...(attrs.class || []), link_size];
      if (in_row_click) attrs.onclick = "event.stopPropagation()";
      if (in_modal)
        return a(
          {
            ...attrs,
            href: "javascript:void(0)",
            onclick: isNode()
              ? `ajax_modal('${href}');` + (attrs.onclick || "")
              : `mobile_modal('${href}');` + (attrs.onclick || ""),
          },
          !!theIcon && theIcon !== "empty" && i({ class: theIcon }),
          txt
        );
      return a(
        attrs,
        !!theIcon && theIcon !== "empty" && i({ class: theIcon }),
        txt
      );
    },
  };
};

/**
 * @param {string} view name of the view or a legacy relation (type:telation)
 * @param {string} relation new relation path syntax
 * @returns {object}
 */
const parse_view_select = (view: string, relation?: string): any => {
  if (relation) {
    const { sourcetable, path } =
      relation === Relation.fixedUserRelation
        ? { sourcetable: "users", path: [] }
        : parseRelationPath(relation);
    return {
      type: "RelationPath",
      viewname: view,
      sourcetable,
      path,
    };
  } else {
    // legacy relation path
    const colonSplit = view.split(":");
    if (colonSplit.length === 1) return { type: "Own", viewname: view };
    const [type, vrest] = colonSplit;
    switch (type) {
      case "Own":
        return { type, viewname: vrest };
      case "ChildList":
      case "OneToOneShow":
        const [viewnm, tbl, fld, throughTable, through] = vrest.split(".");
        return {
          type,
          viewname: viewnm,
          table_name: tbl,
          field_name: fld,
          throughTable,
          through,
        };
      case "ParentShow":
        const [pviewnm, ptbl, pfld] = vrest.split(".");
        return { type, viewname: pviewnm, table_name: ptbl, field_name: pfld };
      case "Independent":
        return { type, viewname: vrest };
    }
  }
};

const pathToQuery = (
  relation: any,
  srcTable: Table,
  subTable: Table | null,
  row: Row
): string | null => {
  const path = relation.path;
  switch (relation.type) {
    case RelationType.CHILD_LIST:
      return path.length === 1
        ? `?${path[0].inboundKey}=${row[srcTable.pk_name]}` // works for OneToOneShow as well
        : `?${path[1].table}.${path[1].inboundKey}.${path[0].table}.${
            path[0].inboundKey
          }=${row[srcTable.pk_name]}`;
    case RelationType.PARENT_SHOW:
      const fkey = path[0].fkey;
      const reffield = srcTable.fields.find((f) => f.name === fkey);
      const value = row[fkey];
      return value
        ? `?${reffield!.refname}=${
            typeof value === "object" ? value.id : value
          }`
        : null;
    case RelationType.OWN:
      const getQuery = get_view_link_query(
        srcTable.fields,
        relation.subView || {}
      );
      return getQuery(row);
    case RelationType.INDEPENDENT:
      return "";
    case RelationType.RELATION_PATH:
      const idName =
        path.length > 0
          ? path[0].fkey
            ? path[0].fkey
            : subTable!.pk_name
          : undefined;
      const srcId =
        row[idName] === null || row[idName]?.id === null
          ? "NULL"
          : row[idName]?.id || row[idName];
      return `?${relation.relationString}=${srcId}`;
  }
  return null;
};

//todo: use above to simplify code
/**
 * @function
 * @param {object} opts
 * @param {string} opts.view
 * @param {string} opts.relation
 * @param {object} opts.view_label missing in contract
 * @param {object} opts.in_modal
 * @param {object} opts.view_label_formula
 * @param {string} [opts.link_style = ""]
 * @param {string} [opts.link_size = ""]
 * @param {string} [opts.link_icon = ""]
 * @param {string} [opts.textStyle = ""]
 * @param {string} [opts.link_bgcol]
 * @param {string} [opts.link_bordercol]
 * @param {string} [opts.link_textcol]
 * @param {Field[]} fields
 * @returns {object}
 */
const view_linker = (
  {
    view,
    relation,
    view_label,
    in_modal,
    view_label_formula,
    link_style = "",
    link_size = "",
    link_icon = "",
    icon = "",
    textStyle = "",
    link_bgcol,
    link_bordercol,
    link_textcol,
    in_dropdown,
    extra_state_fml,
    link_target_blank,
    link_title,
    link_class,
  }: {
    view: string;
    relation?: string;
    view_label?: string;
    in_modal?: boolean;
    view_label_formula?: boolean;
    link_style?: string;
    link_size?: string;
    link_icon?: string;
    icon?: string;
    textStyle?: string;
    link_bgcol?: string;
    link_bordercol?: string;
    link_textcol?: string;
    in_dropdown?: boolean;
    extra_state_fml?: string;
    link_target_blank?: boolean;
    link_title?: string;
    link_class?: string;
  },
  fields: Field[],
  __ = (s: string) => s,
  isWeb: boolean = true,
  user?: AbstractUser,
  targetPrefix: string = "",
  state: GenObj = {},
  req?: GenObj,
  srcViewName?: string,
  label_attr?: any, //for sorting
  in_row_click?: boolean
) => {
  const safePrefix = (targetPrefix || "").endsWith("/")
    ? targetPrefix.substring(0, targetPrefix.length - 1)
    : targetPrefix || "";
  const get_label = (def: string, row: Row): string => {
    if (!view_label || view_label.length === 0) return def;
    if (!view_label_formula) return __(view_label);
    return eval_expression(view_label, row, user, "View Link label formula");
  };
  const get_extra_state = (row: Row): string => {
    if (!extra_state_fml) return "";
    const ctx = {
      ...dollarizeObject(state),
      session_id: getSessionId(req),
      ...row,
    };
    const o = eval_expression(
      extra_state_fml,
      ctx,
      user,
      "View link extra state formula"
    );
    return Object.entries(o)
      .map(
        ([k, v]: [string, any]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
      )
      .join("&");
  };

  if (relation) {
    const topview = View.findOne({ name: srcViewName })!;
    const srcTable = Table.findOne({ id: topview.table_id })!;
    const subview = View.findOne({ name: view })!;
    const subTable = Table.findOne({ id: subview.table_id });
    const relObj = new Relation(
      relation,
      subTable ? subTable.name : "",
      ViewDisplayType.NO_ROW_LIMIT
    );
    relObj.subView = subview;
    const type = relObj.type;
    return {
      label: view,
      key: (r: Row) => {
        const query = pathToQuery(relObj, srcTable, subTable, r);
        if (query === null) return "";
        else {
          let label = "";
          if (type === "ParentShow") {
            const summary_field =
              r[`summary_field_${subTable!.name.toLowerCase()}`];
            label = get_label(
              typeof summary_field === "undefined" ? view : summary_field,
              r
            );
          } else label = get_label(view, r);

          const target = `${safePrefix}/view/${encodeURIComponent(
            view
          )}${query}`;
          return link_view(
            isWeb || in_modal ? target : `javascript:execLink('${target}')`,
            label,
            in_modal && srcViewName && { reload_view: srcViewName },
            link_style,
            link_size,
            link_icon || icon,
            textStyle,
            link_bgcol,
            link_bordercol,
            link_textcol,
            in_dropdown && "dropdown-item",
            get_extra_state(r),
            link_target_blank,
            label_attr,
            link_title,
            link_class,
            req,
            in_row_click
          );
        }
      },
    };
  } else {
    // legacy relation path
    const [vtype, vrest] = view.split(":");
    switch (vtype) {
      case "Own":
        const vnm = vrest;
        const viewrow = View.findOne({ name: vnm });
        const get_query = get_view_link_query(fields, viewrow || {});
        return {
          label: vnm,
          key: (r: Row) => {
            const target = `${safePrefix}/view/${encodeURIComponent(
              vnm
            )}${get_query(r)}`;
            return link_view(
              isWeb || in_modal ? target : `javascript:execLink('${target}')`,
              get_label(vnm, r),
              in_modal && srcViewName && { reload_view: srcViewName },
              link_style,
              link_size,
              link_icon || icon,
              textStyle,
              link_bgcol,
              link_bordercol,
              link_textcol,
              in_dropdown && "dropdown-item",
              get_extra_state(r),
              link_target_blank,
              label_attr,
              link_title,
              link_class,
              req,
              in_row_click
            );
          },
        };
      case "Independent":
        const ivnm = vrest;
        return {
          label: ivnm,
          key: (r: Row) => {
            const target = `${safePrefix}/view/${encodeURIComponent(ivnm)}`;
            return link_view(
              isWeb || in_modal ? target : `javascript:execLink('${target}')`,
              get_label(ivnm, r),
              in_modal && srcViewName && { reload_view: srcViewName },
              link_style,
              link_size,
              link_icon || icon,
              textStyle,
              link_bgcol,
              link_bordercol,
              link_textcol,
              in_dropdown && "dropdown-item",
              get_extra_state(r),
              link_target_blank,
              label_attr,
              link_title,
              link_class,
              req,
              in_row_click
            );
          },
        };
      case "ChildList":
      case "OneToOneShow":
        const [viewnm, tbl, fld, throughTable, through] = vrest.split(".");
        const varPath = through ? `${throughTable}.${through}.${fld}` : fld;
        return {
          label: viewnm,
          key: (r: Row) => {
            const target = `${safePrefix}/view/${encodeURIComponent(
              viewnm
            )}?${varPath}=${r.id}`;
            return link_view(
              isWeb || in_modal ? target : `javascript:execLink('${target}')`,
              get_label(viewnm, r),
              in_modal && srcViewName && { reload_view: srcViewName },
              link_style,
              link_size,
              link_icon || icon,
              textStyle,
              link_bgcol,
              link_bordercol,
              link_textcol,
              in_dropdown && "dropdown-item",
              get_extra_state(r),
              link_target_blank,
              label_attr,
              link_title,
              link_class,
              req,
              in_row_click
            );
          },
        };
      case "ParentShow":
        const [pviewnm, ptbl, pfld] = vrest.split(".");
        //console.log([pviewnm, ptbl, pfld])
        return {
          label: pviewnm,
          key: (r: Row) => {
            const reffield = fields.find((f) => f.name === pfld);
            const summary_field = r[`summary_field_${ptbl.toLowerCase()}`];
            if (r[pfld]) {
              const target = `${safePrefix}/view/${encodeURIComponent(
                pviewnm
              )}?${reffield!.refname}=${
                typeof r[pfld] === "object" ? r[pfld].id : r[pfld]
              }`;
              return link_view(
                isWeb || in_modal ? target : `javascript:execLink('${target}')`,
                get_label(
                  typeof summary_field === "undefined"
                    ? pviewnm
                    : summary_field,
                  r
                ),
                in_modal && srcViewName && { reload_view: srcViewName },
                link_style,
                link_size,
                link_icon || icon,
                textStyle,
                link_bgcol,
                link_bordercol,
                link_textcol,
                in_dropdown && "dropdown-item",
                get_extra_state(r),
                link_target_blank,
                label_attr,
                link_title,
                link_class,
                req,
                in_row_click
              );
            } else return "";
          },
        };
      default:
        throw new Error("Invalid relation: " + view);
    }
  }
};

/**
 * @param {string} nm
 * @returns {boolean}
 */
const action_requires_write = (nm: string): boolean | undefined => {
  if (!nm) return false;
  if (nm === "Delete") return true;
  if (nm.startsWith("Toggle")) return true;
};

// flapMap if f returns array
const flapMapish = (xs: any[], f: (x: any, index: number) => any): any[] => {
  const res: any[] = [];
  let index = 0;
  for (const x of xs) {
    const y = f(x, index++);
    if (Array.isArray(y)) res.push(...y);
    else res.push(y);
  }
  return res;
};

const get_viewable_fields_from_layout = (
  viewname: string,
  statehash: string,
  table: Table,
  fields: Field[],
  columns: any[],
  isShow: boolean,
  req: GenObj,
  __: (s: string) => string,
  state: GenObj = {},
  srcViewName?: string,
  layoutCols?: any[],
  viewResults?: GenObj,
  in_row_click?: boolean
): any[] => {
  const typeMap: Record<string, string> = {
    field: "Field",
    join_field: "JoinField",
    view_link: "ViewLink",
    view: "View",
    link: "Link",
    action: "Action",
    blank: "Text",
    aggregation: "Aggregation",
    dropdown_menu: "DropdownMenu",
    container: "Container",
  };
  const toArray = (x: any) =>
    !x ? [] : Array.isArray(x) ? x : x.above ? x.above : [x];
  //console.log("layout cols", layoutCols);
  const newCols = (layoutCols || []).map(({ contents, ...rest }: any) => {
    if (!contents) contents = rest;
    if (contents.above) {
      const newContents = { type: "container", contents: contents };
      contents = newContents;
    }
    const col: any = {
      ...contents,
      ...rest,
      type: typeMap[contents.type] || contents.type,
    };
    switch (contents.type) {
      case "link":
        col.link_text = contents.text;
        col.link_url = contents.url;
        col.link_url_formula = contents.isFormula?.url;
        col.link_text_formula = contents.isFormula?.text;
        col.link_target_blank = contents.target_blank;
        break;
      case "view_link":
        col.view_label_formula = contents.isFormula?.label;
        break;
      case "dropdown_menu":
        col.dropdown_columns = get_viewable_fields_from_layout(
          viewname,
          statehash,
          table,
          fields,
          columns,
          isShow,
          req,
          __,
          state,
          srcViewName,
          toArray(contents.contents)
        );
        break;
      case "blank":
        if (contents.isFormula?.text) {
          col.type = "FormulaValue";
          col.formula = col.contents;
        }
        if (contents.isHTML)
          col.interpolator = (row: any) =>
            interpolate(contents.contents, row, req?.user, "HTML element");
        break;
      case "action":
        col.action_label_formula = contents.isFormula?.action_label;
        break;
    }
    return col;
  });

  //console.log("newCols", newCols);
  return get_viewable_fields(
    viewname,
    statehash,
    table,
    fields,
    newCols,
    isShow,
    req,
    __,
    state,
    srcViewName,
    viewResults,
    in_row_click
  );
};

/**
 * @function
 * @param {string} viewname
 * @param {Table|object} table
 * @param {Field[]} fields
 * @param {object[]} columns
 * @param {boolean} isShow
 * @param {object} req
 * @param {*} __
 * @returns {object[]}
 */
const get_viewable_fields = (
  viewname: string,
  statehash: string,
  table: Table,
  fields: Field[],
  columns: any[],
  isShow: boolean,
  req: GenObj,
  __: (s: string) => string,
  state: GenObj = {},
  srcViewName?: string,
  viewResults?: GenObj,
  in_row_click?: boolean
): any[] => {
  const dropdown_actions: any[] = [];
  const checkShowIf =
    (tFieldGenF: (column: any, index: number) => any) =>
    (column: any, index: number) => {
      const tfield = tFieldGenF(column, index);
      if (column.showif) {
        const oldKeyF = tfield.key;
        if (typeof oldKeyF !== "function") return tfield;
        const newKeyF = (r: Row) => {
          if (
            eval_expression(
              column.showif,
              r,
              req.user,
              "Column show if formula"
            )
          )
            return oldKeyF(r);
          else return "";
        };
        tfield.key = newKeyF;
      }
      return tfield;
    };
  const tfields = flapMapish(
    columns,
    checkShowIf((column: any, index: number) => {
      const role = req.user ? req.user.role_id : 100;
      const user_id = req.user ? req.user.id : null;
      const setWidth: any = column.col_width
        ? { width: `${column.col_width}${column.col_width_units}` }
        : {};
      setWidth.align =
        !column.alignment || column.alignment === "Default"
          ? undefined
          : column.alignment.toLowerCase();
      if (column.type === "FormulaValue") {
        return {
          ...setWidth,
          label: column.header_label ? __(column.header_label) : "",
          key: (r: Row) =>
            text(
              eval_expression(
                column.formula,
                r,
                req.user,
                "Formula value column"
              )
            ),
        };
      } else if (column.type === "Text") {
        return {
          ...setWidth,
          label: column.header_label ? __(column.header_label) : "",
          key: (r: Row) =>
            column.interpolator
              ? column.interpolator(r)
              : text(column.contents),
        };
      } else if (column.type === "Container") {
        return {
          ...setWidth,
          label: column.header_label ? __(column.header_label) : "",
          key: (r: Row) => {
            const layout = structuredClone({ ...column, type: "container" });
            traverseSync(
              layout,
              standardLayoutRowVisitor(viewname, state, table, r, req)
            );
            return renderLayout({
              blockDispatch: {
                ...standardBlockDispatch(viewname, state, table, { req }, r),
                view(column: any) {
                  return viewResults?.[column.view + column.relation]?.(r);
                },
              },
              layout,
              role,
              is_owner: false,
              req,
              hints: getState().getLayout(req.user).hints || {},
            });
          },
        };
      } else if (column.type === "DropdownMenu") {
        //console.log(column);
        const btn_label =
          column.label == " "
            ? ""
            : column.label || (column.action_icon ? "" : req.__("Action"));
        return {
          ...setWidth,
          label: column.header_label ? __(column.header_label) : "",
          key: (r: Row) =>
            div(
              { class: "dropdown" },
              button(
                {
                  class:
                    column.action_style === "btn-link"
                      ? "btn btn-link"
                      : `btn ${column.action_style || "btn-primary"} ${
                          column.action_size || ""
                        } d-inline-block dropdown-toggle`,
                  "data-boundary": "viewport",
                  type: "button",
                  id: `actiondd${r.id}_${index}`, //TODO need unique
                  "data-bs-toggle": "dropdown",
                  "aria-haspopup": "true",
                  "aria-expanded": "false",
                  "aria-label": "Additional actions",
                  onclick: in_row_click ? "event.stopPropagation()" : undefined,
                  style:
                    column.action_style === "btn-custom-color"
                      ? `background-color: ${
                          column.action_bgcol || "#000000"
                        };border-color: ${
                          column.action_bordercol || "#000000"
                        }; color: ${column.action_textcol || "#000000"}`
                      : null,
                },
                show_icon_and_label(column.action_icon, btn_label)
              ),
              div(
                {
                  class: [
                    "dropdown-menu",
                    column.menu_direction === "end" && "dropdown-menu-end",
                  ],
                  "aria-labelledby": `actiondd${r.id}_${index}`,
                },
                column.dropdown_columns.map((acol: any) =>
                  div({ class: "dropdown-item" }, acol.key(r))
                )
              )
            ),
        };
      } else if (column.type === "Action") {
        if (column.minRole && column.minRole != 100) {
          const minRole = +column.minRole;
          const userRole = req?.user?.role_id || 100;
          if (minRole < userRole) return false;
        }
        const action_col = {
          ...setWidth,
          label: column.header_label ? __(column.header_label) : "",
          key: (r: Row) => {
            if (action_requires_write(column.action_name)) {
              if (table.min_role_write < role && !table.is_owner(req.user, r))
                return "";
            }
            const url = action_url(
              viewname,
              table,
              column.action_name,
              r,
              column.rndid || column.action_name,
              column.rndid ? "rndid" : "action_name",
              column.confirm,
              index,
              column.run_async
            );
            const label = column.action_label_formula
              ? eval_expression(
                  column.action_label,
                  r,
                  req.user,
                  "Action label formula"
                )
              : __(column.action_label) || __(column.action_name);
            const icon = column.action_icon || column.icon || undefined;
            if (typeof url !== "string" && url.javascript)
              return a(
                {
                  href: "javascript:void(0)",
                  class: [
                    column.in_dropdown && "dropdown-item",
                    column.action_style !== "btn-link" &&
                      `btn ${column.action_style || "btn-primary"} ${
                        column.action_size || ""
                      }`,
                  ],
                  onclick:
                    url.javascript +
                    (column.spinner ? ";spin_action_link(this)" : "") +
                    (in_row_click ? ";event.stopPropagation()" : ""),
                  ...(!label || label === " "
                    ? { "aria-label": column.action_name }
                    : {}),
                },
                !!icon &&
                  icon !== "empty" &&
                  i({ class: icon }) + (label === " " ? "" : "&nbsp;"),
                label
              );
            else
              return post_btn(url, label, req.csrfToken(), {
                small: true,
                ajax: true,
                icon,
                reload_on_done: true,
                confirm: column.confirm,
                spinner: column.spinner,
                btnClass: column.in_dropdown
                  ? "dropdown-item"
                  : column.action_style || "btn-primary",
                req,
              });
          },
        };
        if (column.in_dropdown) {
          //legacy
          dropdown_actions.push(action_col);
          return false;
        } else return action_col;
      } else if (column.type === "View") {
        return {
          label: column.header_label ? __(column.header_label) : "",
          key: (r: Row) => viewResults?.[column.view + column.relation]?.(r),
        };
      } else if (column.type === "ViewLink") {
        if (!column.view) return;
        const r: any = view_linker(
          column,
          fields,
          __,
          isWeb(req),
          req.user,
          "",
          state,
          req,
          srcViewName,
          undefined,
          in_row_click
        );
        //console.log(column);
        if (column.view_label_formula) {
          const fml_field = table.getField(column.view_label);
          if (fml_field) {
            if (column.view_label.includes(".")) {
              const path = column.view_label.split(".");
              if (path.length === 2) {
                const [refNm, targetNm] = path;
                r.statekey = `${refNm}.${
                  table.getField(refNm)!.reftable_name
                }->${targetNm}`;
                r.header_filter = headerFilterForField(
                  fml_field,
                  state,
                  r.statekey
                );
              }
            } else {
              r.header_filter = headerFilterForField(fml_field, state);
              r.statekey = fml_field.name;
            }
          }
        }

        if (column.header_label) r.label = __(column.header_label);
        Object.assign(r, setWidth);
        if (column.in_dropdown) {
          dropdown_actions.push(r);
          return false;
        } else return r;
      } else if (column.type === "Link") {
        const r = make_link(column, fields, __, in_row_click);
        if (column.header_label) r.label = __(column.header_label);
        Object.assign(r, setWidth);
        if (column.in_dropdown) {
          dropdown_actions.push(r);
          return false;
        } else return r;
      } else if (column.type === "JoinField") {
        //console.log(column);
        let fvrun;
        const fieldview = column.join_fieldview || column.fieldview;
        let refNm, targetNm, through, key, type;
        const keypath = column.join_field.split(".");
        if (column.join_field.includes("->")) {
          const [relation, target] = column.join_field.split("->");
          const [ontable, ref] = relation.split(".");
          targetNm = target;
          refNm = ref;
          key = validSqlId(
            column.targetNm ||
              `${ref}_${ontable.replaceAll(" ", "").toLowerCase()}_${target}`
          );
        } else {
          refNm = keypath[0];
          targetNm = keypath[keypath.length - 1];
          key = keypath.join("_");
        }
        const field = table.getField(column.join_field);

        if (column.field_type) type = getState().types[column.field_type];
        else {
          if (field && field.type === "File") column.field_type = "File";
          else if (
            (field?.type as any)?.name &&
            (field?.type as any)?.fieldviews?.[fieldview]
          ) {
            column.field_type = (field!.type as any).name;
            type = getState().types[column.field_type];
          }
        }
        if (fieldview && type?.fieldviews?.[fieldview]?.expandColumns) {
          return type.fieldviews[fieldview].expandColumns(
            field,
            {
              ...field!.attributes,
              ...column,
            },
            column
          );
        }
        let header_filter;
        let statekey;

        if (!column.join_field.includes("->") && keypath.length == 2) {
          statekey = `${refNm}.${
            table.getField(refNm)!.reftable_name
          }->${targetNm}`;
          header_filter = headerFilterForField(field || null, state, statekey);
        }
        let gofv =
          fieldview && type && type.fieldviews && type.fieldviews[fieldview]
            ? (row: any) =>
                type.fieldviews[fieldview].run(row[key], req, {
                  row,
                  ...(field?.attributes || {}),
                  ...column,
                  ...(column?.configuration || {}),
                })
            : null;
        if (!gofv && column.field_type === "File") {
          gofv = (row: any) =>
            row[key]
              ? getState().fileviews[fieldview].run(row[key], "", {
                  row,
                  ...column,
                  ...(column?.configuration || {}),
                })
              : "";
        }

        fvrun = {
          ...setWidth,
          label: headerLabelForName(
            column.header_label ? __(column.header_label) : targetNm,
            key,
            req,
            __,
            statehash
          ),
          row_key: key,
          row_label: field?.label,
          statekey,
          header_filter,
          key: gofv ? gofv : (row: any) => text(row[key]),
          sortlink: sortlinkForName(key, req, viewname, statehash),
        };
        if (column.click_to_edit) {
          const reffield = fields.find((f) => f.name === refNm);

          const oldkey =
            typeof fvrun.key === "function"
              ? fvrun.key
              : (r: Row) => r[fvrun.key];
          const newkey = (row: any) =>
            div(
              {
                "data-inline-edit-fielddata": encodeURIComponent(
                  JSON.stringify({
                    field_name: keypath[0],
                    table_name: table.name,
                    pk: row[table.pk_name],
                    fieldview,
                    configuration: column?.configuration,
                    join_field: keypath[keypath.length - 1],
                  })
                ),
                "data-inline-edit-ajax": "true",
                "data-inline-edit-dest-url": `/api/${table.name}/${
                  row[table.pk_name]
                }`,
              },
              span({ class: "current" }, oldkey(row)),
              i({ class: "editicon fas fa-edit ms-1" })
            );
          fvrun.key = newkey;
        }
        return fvrun;
      } else if (column.type === "Aggregation") {
        let table, fld, through;
        if (column.agg_relation.includes("->")) {
          let restpath;
          [through, restpath] = column.agg_relation.split("->");
          [table, fld] = restpath.split(".");
        } else {
          [table, fld] = column.agg_relation.split(".");
        }
        let targetNm =
          column.targetNm ||
          db.sqlsanitize(
            (
              column.stat.replace(" ", "") +
                "_" +
                table +
                "_" +
                fld +
                "_" +
                column.agg_field.split("@")[0] +
                "_" +
                column.aggwhere || ""
            ).toLowerCase()
          );
        if (targetNm.length > 58) {
          targetNm = targetNm
            .split("")
            .filter((c: string, i: number) => i % 2 == 0)
            .join("");
        }
        let showValue = (value: any) => {
          if (value === true || value === false)
            return bool.fieldviews.show.run(value);
          if (value instanceof Date) return date.fieldviews.show.run(value);
          return value?.toString ? value.toString() : value;
        };
        if (column.agg_fieldview && column.agg_field?.includes("@")) {
          const tname = column.agg_field.split("@")[1];
          const type = getState().types[tname];
          if (type?.fieldviews[column.agg_fieldview])
            showValue = (x: any) =>
              type.fieldviews[column.agg_fieldview].run(x, req, column);
        } else if (column.agg_fieldview) {
          const aggField = Table.findOne(table)?.getField?.(column.agg_field);
          const outcomeType =
            column.stat === "Percent true" || column.stat === "Percent false"
              ? "Float"
              : column.stat === "Count" || column.stat === "CountUnique"
              ? "Integer"
              : (aggField?.type as any)?.name;
          const type = getState().types[outcomeType];
          if (type?.fieldviews[column.agg_fieldview])
            showValue = (x: any) =>
              type.fieldviews[column.agg_fieldview].run(type.read(x), req, {
                ...column,
                ...(column?.configuration || {}),
              });
        }

        let key = (r: Row) => {
          const value = r[targetNm];
          return showValue(value);
        };
        if (column.stat.toLowerCase() === "array_agg")
          key = (r: Row) =>
            Array.isArray(r[targetNm])
              ? r[targetNm].map((v: any) => showValue(v)).join(", ")
              : "";
        return {
          ...setWidth,
          label: headerLabelForName(
            column.header_label
              ? column.header_label
              : column.stat + " " + table,

            targetNm,
            req,
            __,
            statehash
          ),
          key,
          sortlink: sortlinkForName(targetNm, req, viewname, statehash),
        };
      } else if (column.type === "Field") {
        //console.log(column);
        let f = fields.find((fld) => fld.name === column.field_name);
        let f_with_val = f;
        if (f && f.attributes && f.attributes.localized_by) {
          const locale = req?.getLocale?.();
          const localized_fld_nm = f.attributes.localized_by[locale];
          f_with_val = fields.find((fld) => fld.name === localized_fld_nm) || f;
        }
        const ftype = f?.type as any;
        const isNum = f && ftype && ftype.name === "Integer";
        if (isNum && !setWidth.align) setWidth.align = "right";
        let fvrun: any;
        let header_filter = headerFilterForField(f || null, state);

        if (
          column.fieldview &&
          ftype?.fieldviews?.[column.fieldview]?.expandColumns
        ) {
          fvrun = ftype.fieldviews[column.fieldview].expandColumns(
            f,
            {
              ...f!.attributes,
              ...column.configuration,
            },
            column
          );
        } else
          fvrun = f && {
            ...setWidth,
            label: headerLabelForName(
              column.header_label ? __(column.header_label) : __(f.label),
              f.name,
              req,
              __,
              statehash
            ),
            row_key: f_with_val!.name,
            row_label: f.label,
            key:
              column.fieldview && f.type === "File"
                ? (row: any) =>
                    row[f!.name] &&
                    getState().fileviews[column.fieldview].run(
                      row[f!.name],
                      row[`${f!.name}__filename`],
                      { row, ...column, ...(column?.configuration || {}) }
                    )
                : column.fieldview &&
                  ftype.fieldviews &&
                  ftype.fieldviews[column.fieldview]
                ? (row: any) =>
                    ftype.fieldviews[column.fieldview].run(
                      row[f_with_val!.name],
                      req,
                      { row, ...f!.attributes, ...column.configuration }
                    )
                : isShow
                ? ftype.showAs
                  ? (row: any) => ftype.showAs(row[f_with_val!.name])
                  : (row: any) => text(row[f_with_val!.name])
                : f.listKey,
            header_filter,
            sortlink:
              !f.calculated || f.stored
                ? sortlinkForName(f.name, req, viewname, statehash)
                : undefined,
          };
        if (column.click_to_edit) {
          const updateKey = (fvr: any, column_key?: any) => {
            const oldkey =
              typeof fvr.key === "function" ? fvr.key : (r: Row) => r[fvr.key];
            const doSetKey =
              (column.fieldview === "subfield" ||
                column.fieldview === "keys_expand_columns") &&
              column_key;
            const schema =
              doSetKey && f!.attributes?.hasSchema
                ? (f!.attributes.schema || []).find(
                    (s: any) => s.key === column_key
                  )
                : undefined;
            const newkey = (row: any) => {
              if (role <= table.min_role_write || table.is_owner(req.user, row))
                return div(
                  {
                    "data-inline-edit-fielddata": encodeURIComponent(
                      JSON.stringify({
                        field_name: f!.name,
                        table_name: table.name,
                        pk: row[table.pk_name],
                        fieldview: column.fieldview,
                        configuration: column?.configuration,
                      })
                    ),
                    "data-inline-edit-ajax": "true",
                    "data-inline-edit-dest-url": `/api/${table.name}/${
                      row[table.pk_name]
                    }`,
                  },
                  span({ class: "current" }, oldkey(row)),
                  i({ class: "editicon fas fa-edit ms-1" })
                );
              else return oldkey(row);
            };
            fvr.key = newkey;
          };
          if (Array.isArray(fvrun)) {
            fvrun.forEach((fvr: any) => {
              updateKey(fvr, fvr.row_key[1]);
            });
          } else updateKey(fvrun, column.configuration?.key || column.key);
        }
        return fvrun;
      }
    })
  ).filter((v: any) => !!v);
  if (dropdown_actions.length > 0) {
    //legacy
    tfields.push({
      label: req.__("Action"),
      key: (r: Row) =>
        div(
          { class: "dropdown" },
          button(
            {
              class: "btn btn-sm btn-xs btn-outline-secondary dropdown-toggle",
              "data-boundary": "viewport",
              type: "button",
              id: `actiondd${r.id}`,
              "data-bs-toggle": "dropdown",
              "aria-haspopup": "true",
              "aria-expanded": "false",
            },
            req.__("Action")
          ),
          div(
            {
              class: "dropdown-menu dropdown-menu-end",
              "aria-labelledby": `actiondd${r.id}`,
            },
            dropdown_actions.map((acol: any) => acol.key(r))
          )
        ),
    });
  }
  return tfields;
};

const headerFilterForField =
  (f: Field | null, state: GenObj, path?: string) =>
  (id?: string): string => {
    const ftype = f?.type as any;
    if (!f) return "";
    if (ftype?.name === "Date") {
      const set_initial =
        state[`_fromdate_${f.name}`] && state[`_todate_${f.name}`]
          ? `defaultDate: ["${state[`_fromdate_${f.name}`]}", "${
              state[`_todate_${f.name}`]
            }"],`
          : "";
      return (
        div(
          { class: "input-group hdrfilterdate" },
          input({
            type: "text",
            class: "form-control",
            id: `daterangefilter${f.name}`,
            //placeholder: ,
          }),
          button(
            {
              class: "btn btn-outline-secondary btn-border-color-input",
              style: { paddingLeft: "3px", paddingRight: "3px" },
              onclick: `set_state_fields({_fromdate_${f.name}: {unset: true}, _todate_${f.name}: {unset: true} })`,
            },
            i({ class: "fas fa-times" })
          )
        ) +
        script(
          domReady(
            `ensure_script_loaded("/static_assets/${
              db.connectObj.version_tag
            }/flatpickr.min.js");
      ensure_css_loaded("/static_assets/${
        db.connectObj.version_tag
      }/flatpickr.min.css");
      $('#daterangefilter${f.name}').flatpickr({mode:'range',
        dateFormat: "Y-m-d",${set_initial}
        onChange: function(selectedDates, dateStr, instance) {
            set_header_filter($(instance.element));
            if(selectedDates.length==2) {

               set_state_fields({_fromdate_${
                 f.name
               }: selectedDates[0].toLocaleDateString('en-CA'), _todate_${
              f.name
            }: selectedDates[1].toLocaleDateString('en-CA') }, false, ${
              id ? `document.getElementById('${id}')` : "this"
            })


            }
        },
    });`
          )
        )
      );
    }

    let fieldviewObjs;
    /*if (f.is_fkey) {
    fieldviewObjs = [getState().keyFieldviews.select];
  } else */
    let extraAttrs: any = {};
    if (ftype?.name === "Bool") {
      fieldviewObjs = [ftype.fieldviews.tristate];
      extraAttrs.outline_buttons = true;
    } else if (ftype?.name === "String")
      fieldviewObjs = [ftype.fieldviews.edit];
    else if (ftype?.name === "Integer" || ftype?.name === "Float")
      fieldviewObjs = [
        ftype.fieldviews.above_input,
        ftype.fieldviews.below_input,
      ];

    if (!fieldviewObjs) return "";

    return div(
      { class: "d-flex" },
      fieldviewObjs
        .map(
          (fvObj: any) =>
            fvObj?.run(
              f.name,
              state[path || f.name],
              {
                preOnChange: `set_header_filter(this);`,
                onChange: `set_header_filter(this);set_state_field('${encodeURIComponent(
                  path || f.name
                )}', this.value, ${
                  id ? `document.getElementById('${id}')` : "this"
                })`,
                isFilter: true,
                ...f.attributes,
                ...extraAttrs,
              },
              "",
              false,
              f,
              state
            ) || ""
        )
        .join("")
    );
  };

/**
 * @param {string} fname
 * @param {object} req
 * @returns {string}
 */
const sortlinkForName = (
  fname: string,
  req: any,
  viewname: string,
  statehash: string
): string => {
  const _sortby = req.query ? req.query[`_${statehash}_sortby`] : undefined;
  const _sortdesc = req.query ? req.query[`_${statehash}_sortdesc`] : undefined;
  const desc =
    typeof _sortdesc == "undefined"
      ? _sortby === fname
      : _sortdesc
      ? "false"
      : "true";
  return `sortby('${text(fname)}', ${desc}, '${statehash}', this)`;
};

const standardLayoutRowVisitor = (
  viewname: string,
  state: GenObj,
  table: Table,
  row: Row,
  req: GenObj
) => {
  const session_id = getSessionId(req);
  const locale = req.getLocale();
  const fields = table.fields;

  const evalMaybeExpr = (segment: any, key: string, fmlkey?: string) => {
    if (segment.isFormula && segment.isFormula[fmlkey || key] && segment[key]) {
      segment[key] = eval_expression(
        segment[key],
        { session_id, locale, ...row },
        req.user,
        `property ${key} in segment of type ${segment.type}`
      );
    }
  };
  return {
    link(segment: any) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "text");
      if (
        req?.generate_email &&
        req.get_base_url &&
        segment.url.startsWith("/")
      ) {
        const targetPrefix = req.get_base_url();
        const safePrefix = (targetPrefix || "").endsWith("/")
          ? targetPrefix.substring(0, targetPrefix.length - 1)
          : targetPrefix || "";
        segment.url = safePrefix + segment.url;
      }
    },
    view_link(segment: any) {
      evalMaybeExpr(segment, "view_label", "label");
    },
    blank(segment: any) {
      evalMaybeExpr(segment, "contents", "text");
    },
    tabs(segment: any) {
      const to_delete = new Set<number>();

      (segment.showif || []).forEach((sif: any, ix: number) => {
        if (sif) {
          const showit = eval_expression(
            sif,
            { session_id, ...row },
            req.user,
            `Tabs show if formula`
          );
          if (!showit) to_delete.add(ix);
        }
      });

      // TODO mutation here - potential issue with renderRows
      segment.titles = segment.titles.filter(
        (v: any, ix: number) => !to_delete.has(ix)
      );
      segment.contents = segment.contents.filter(
        (v: any, ix: number) => !to_delete.has(ix)
      );

      (segment.titles || []).forEach((t: any, ix: number) => {
        if (typeof t === "string" && t.includes("{{")) {
          segment.titles[ix] = interpolate(t, row, req.user, "Tab titles");
        }
      });
    },
    action(segment: any) {
      evalMaybeExpr(segment, "action_label");
    },
    card(segment: any) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "title");
      evalMaybeExpr(segment, "class");
    },
    image(segment: any) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "alt");
      if (segment.srctype === "Field") {
        const field = fields.find((f) => f.name === segment.field);
        if (!field) return;
        const ftype = field.type as any;
        if (ftype?.name === "String") segment.url = row[segment.field];
        if (ftype === "File") {
          segment.url = `/files/serve/${row[segment.field]}`;
          segment.fileid = row[segment.field];
        }
      }
    },
    container(segment: any) {
      evalMaybeExpr(segment, "bgColor");
      evalMaybeExpr(segment, "customClass");
      evalMaybeExpr(segment, "customId");
      evalMaybeExpr(segment, "url");
      if (segment.bgType === "Image Field") {
        segment.bgType = "Image";
        segment.bgFileId = row[segment.bgField];
      }

      if (segment.showIfFormula) {
        const f = get_expression_function(segment.showIfFormula, fields);
        if (!f({ ...dollarizeObject(state || {}), ...row }, req.user))
          segment.hide = true;
        else segment.hide = false;
      }
      if (segment.click_action) {
        segment.url = `javascript:view_post('${viewname}', 'run_action', {click_action: '${
          segment.click_action
        }', ${table.pk_name}: ${JSON.stringify(row[table.pk_name])}})`;
      }
    },
  };
};

const standardBlockDispatch = (
  viewname: string,
  state: GenObj,
  table: Table,
  extra: { req: GenObj; [key: string]: any },
  row: Row
) => {
  const req = extra.req;
  const fields = table.fields;
  const locale = req.getLocale();
  const role = req.user?.role_id || 100;
  return {
    field({ field_name, fieldview, configuration, click_to_edit }: any) {
      let field = fields.find((fld) => fld.name === field_name);
      if (!field) return "";
      const ftype = field.type as any;

      let val = row[field_name];
      let fvrun;
      if (
        field &&
        field.attributes &&
        field.attributes.localized_by &&
        field.attributes.localized_by[locale]
      ) {
        const localized_fld = field.attributes.localized_by[locale];
        val = row[localized_fld];
      }
      const cfg = {
        row,
        ...field.attributes,
        ...configuration,
      };
      if (fieldview && ftype === "File") {
        if (req.generate_email) cfg.targetPrefix = getSafeBaseUrl();
        fvrun = val
          ? getState().fileviews[fieldview].run(
              val,
              row[`${field_name}__filename`],
              cfg
            )
          : "";
      } else if (
        fieldview &&
        ftype &&
        ftype.fieldviews &&
        ftype.fieldviews[fieldview]
      )
        fvrun = ftype.fieldviews[fieldview].run(val, req, cfg);
      else fvrun = text(val);
      if (
        click_to_edit &&
        (role <= table.min_role_write || table.is_owner(req.user, row))
      )
        return div(
          {
            "data-inline-edit-fielddata": encodeURIComponent(
              JSON.stringify({
                field_name,
                table_name: table.name,
                pk: row[table.pk_name],
                fieldview,
                configuration,
              })
            ),
            "data-inline-edit-ajax": "true",
            "data-inline-edit-dest-url": `/api/${table.name}/${
              row[table.pk_name]
            }`,
            class: !isWeb(req) ? "mobile-data-inline-edit" : "",
          },
          fvrun
        );
      else return fvrun;
    },
    join_field(jf: any) {
      const {
        join_field,
        field_type,
        fieldview,
        configuration,
        target_field_attributes,
        click_to_edit,
      } = jf;
      const keypath = join_field.split(".");
      let value;
      if (join_field.includes("->")) {
        const [relation, target] = join_field.split("->");
        const [ontable, ref] = relation.split(".");
        const key =
          jf.targetNm ||
          `${ref}_${ontable.replaceAll(" ", "").toLowerCase()}_${target}`;
        value = row[validSqlId(key)];
      } else {
        value = row[join_field.split(".").join("_")];
      }
      if (field_type === "File") {
        return value
          ? getState().fileviews[fieldview].run(value, "", configuration || {})
          : "";
      }
      let fvRes;
      if (field_type && fieldview) {
        const type = getState().types[field_type];
        if (type && getState().types[field_type]) {
          fvRes = type.fieldviews[fieldview].run(value, req, {
            row,
            ...(target_field_attributes || {}),
            ...configuration,
          });
        } else fvRes = text(value);
      } else fvRes = text(value);
      if (
        click_to_edit &&
        (role <= table.min_role_write || table.is_owner(req.user, row))
      )
        return div(
          {
            "data-inline-edit-fielddata": encodeURIComponent(
              JSON.stringify({
                field_name: keypath[0],
                table_name: table.name,
                pk: row[table.pk_name],
                fieldview,
                configuration,
                join_field: keypath[keypath.length - 1],
              })
            ),
            "data-inline-edit-ajax": "true",
            "data-inline-edit-dest-url": `/api/${table.name}/${
              row[table.pk_name]
            }`,
            class: !isWeb(req) ? "mobile-data-inline-edit" : "",
          },
          fvRes
        );
      else return fvRes;
    },
    aggregation(column: any) {
      const { agg_relation, stat, aggwhere, agg_field } = column;
      let table, fld, through;
      if (agg_relation.includes("->")) {
        let restpath;
        [through, restpath] = agg_relation.split("->");
        [table, fld] = restpath.split(".");
      } else {
        [table, fld] = agg_relation.split(".");
      }
      let targetNm =
        column.targetNm ||
        db.sqlsanitize(
          (
            stat +
              "_" +
              table +
              "_" +
              fld +
              "_" +
              (agg_field || "").split("@")[0] +
              "_" +
              aggwhere || ""
          ).toLowerCase()
        );
      if (targetNm.length > 58) {
        targetNm = targetNm
          .split("")
          .filter((c: string, i: number) => i % 2 == 0)
          .join("");
      }
      const val = row[targetNm];
      if (stat.toLowerCase() === "array_agg" && Array.isArray(val))
        return val.map((v: any) => text(v?.toString?.())).join(", ");
      else if (column.agg_fieldview) {
        const aggField = Table.findOne(table)?.getField?.(column.agg_field);
        const outcomeType =
          stat === "Percent true" || stat === "Percent false"
            ? "Float"
            : stat === "Count" || stat === "CountUnique"
            ? "Integer"
            : (aggField?.type as any)?.name;
        const type = getState().types[outcomeType];
        if (type?.fieldviews[column.agg_fieldview]) {
          const readval = type.read(val);
          return type.fieldviews[column.agg_fieldview].run(
            readval,
            req,
            column?.configuration || {}
          );
        }
      }
      return text(val);
    },
    action(segment: any) {
      if (segment.action_style === "on_page_load") {
        if (extra?.isPreview) return "";
        run_action_column({
          col: { ...segment },
          referrer: req?.get?.("Referrer"),
          req: req,
        }).catch((e: any) => Crash.create(e, req));
        return "";
      }
      let url: any = action_url(
        viewname,
        table,
        segment.action_name,
        row,
        segment.rndid,
        "rndid",
        segment.confirm,
        undefined,
        !!segment.run_async
      );
      if (
        segment.action_name === "Delete" &&
        segment.configuration?.after_delete_action == "Reload page"
      ) {
        url = {
          javascript: `ajax_post('${table.delete_url(
            row
          )}', {success:()=>{close_saltcorn_modal();location.reload();}})`,
        };
        return action_link(url, req, segment);
      } else if (segment.action_name === "Delete")
        url = `${table.delete_url(
          row,
          `redirect=${encodeURIComponent(
            interpolate(
              segment.configuration?.after_delete_url || "/",
              row,
              req?.user,
              "delete action: after delete URL"
            )
          )}`
        )}`;
      return action_link(url, req, segment);
    },
    view_link(view: any) {
      const prefix =
        req.generate_email && req.get_base_url ? req.get_base_url() : "";
      const { key } = view_linker(
        view,
        fields,
        (s: string) => s,
        isWeb(req),
        req.user,
        prefix,
        state,
        req,
        viewname
      );
      return key(row);
    },
    tabs(segment: any, go: (contents: any) => string) {
      if (segment.tabsStyle !== "Value switch") return false;
      const rval = row[segment.field];
      const value = rval?.id || rval; // TODO pkname of join table
      const ix = segment.titles.findIndex((t: any) =>
        typeof t.value === "undefined"
          ? `${t}` === `${value}`
          : value === t.value
      );
      if (ix === -1) return "";
      return go(segment.contents[ix]);
    },
    blank(segment: any) {
      if (segment.isHTML) {
        return interpolate(
          segment.contents,
          { locale, ...row },
          req?.user,
          "HTML element"
        );
      } else return segment.contents;
    },
  };
};

/**
 * @param {object} column
 * @param {object} f
 * @param {object} req
 * @param {*} __
 * @returns {string}
 */
const headerLabelForName = (
  label: string,
  fname: string,
  req: GenObj,
  __: (s: string) => string,
  statehash: string
): string => {
  //const { _sortby, _sortdesc } = req.query || {};
  const _sortby = req?.query ? req.query[`_${statehash}_sortby`] : undefined;
  const _sortdesc = req?.query
    ? req.query[`_${statehash}_sortdesc`]
    : undefined;

  let arrow =
    _sortby !== fname
      ? ""
      : _sortdesc
      ? i({ class: "fas fa-caret-down sortdir" })
      : i({ class: "fas fa-caret-up sortdir" });
  return arrow ? span({ class: "text-nowrap" }, label + arrow) : label;
};

/**
 * @function
 * @param {Field[]} fields
 * @param {object} state
 * @param {boolean} [fuzzyStrings]
 * @returns {object}
 */
const splitUniques = (
  fields: Field[],
  state: GenObj,
  fuzzyStrings?: boolean
): { uniques: GenObj; nonUniques: GenObj } => {
  let uniques: GenObj = {};
  let nonUniques: GenObj = {};
  Object.entries(state).forEach(([k, v]) => {
    const field = fields.find((f) => f.name === k);
    if (
      field &&
      (field.is_unique || field.primary_key) &&
      fuzzyStrings &&
      field.type &&
      (field.type as any).name === "String"
    )
      uniques[k] = { ilike: v };
    else if (field && (field.is_unique || field.primary_key))
      uniques[k] = (field.type as any).read
        ? (field.type as any).read(v, field.attributes)
        : v;
    else nonUniques[k] = v;
  });
  return { uniques, nonUniques };
};

/**
 * @param {object} table
 * @param {string} viewname
 * @param {object[]} [columns]
 * @param {object} layout0
 * @param {boolean|null} id
 * @param {object} req
 * @param {boolean} isRemote
 * @returns {Promise<Form>}
 */
const getForm = async (
  table: Table,
  viewname: string,
  columns: any[],
  layout0: any,
  id: any,
  req: any,
  isRemote?: boolean
): Promise<any> => {
  const fields = table.getFields();
  const state = getState();
  const tfields = (columns || [])
    .map((column: any) => {
      if (column.type === "Field") {
        const f0 = fields.find((fld) => fld.name === column.field_name);

        if (f0) {
          const f = new Field(f0);
          f.fieldview = column.fieldview;
          if (f.type === "Key") {
            if (state.keyFieldviews[column.fieldview])
              f.fieldviewObj = state.keyFieldviews[column.fieldview];
            f.input_type =
              !f.fieldview ||
              !f.fieldviewObj ||
              (f.fieldview === "select" && !f.fieldviewObj)
                ? "select"
                : "fromtype";
          }
          if (f.type === "File") {
            const fvNm = column.fieldview || "upload";
            if (state.fileviews[fvNm]) f.fieldviewObj = state.fileviews[fvNm];
            f.input_type =
              !f.fieldview || !f.fieldviewObj ? "file" : "fromtype";
          }
          if (f.calculated) {
            const qs = objToQueryString(column.configuration);
            f.sourceURL = `/field/show-calculated/${table.name}/${f.name}/${f.fieldview}?${qs}`;
          }
          f.attributes = { ...column.configuration, ...f.attributes };
          if (
            typeof column.block !== "undefined" &&
            typeof f.attributes.block === "undefined"
          )
            f.attributes.block = column.block;
          return f;
        } else if (table.name === "users" && column.field_name === "password") {
          return new Field({
            name: "password",
            fieldview: column.fieldview,
            type: "String",
          });
        } else if (
          table.name === "users" &&
          column.field_name === "passwordRepeat"
        ) {
          return new Field({
            name: "passwordRepeat",
            fieldview: column.fieldview,
            type: "String",
          });
        } else if (table.name === "users" && column.field_name === "remember") {
          return new Field({
            name: "remember",
            fieldview: column.fieldview,
            type: "Bool",
          });
        }
      }
    })
    .filter((tf: any) => !!tf);
  const path = isWeb(req) ? req.baseUrl + req.path : "";
  const qs = objectToQueryString(req.query);
  let action = `/view/${viewname}${qs ? "?" + qs : ""}`;
  if (path && path.startsWith("/auth/")) action = path;
  const layout = structuredClone(layout0);
  traverseSync(layout, {
    container(segment: any) {
      if (segment.showIfFormula) {
        segment.showIfFormulaInputs = segment.showIfFormula;
        const fvs = [...freeVariables(segment.showIfFormula)];
        const jfFvs = fvs.filter(
          (fv: string) => fv.includes(".") && !fv.startsWith("user.")
        );
        if (jfFvs.length)
          segment.showIfFormulaJoinFields = jfFvs
            .map((jf: string) => {
              const [ref, target] = jf.split(".");
              const refField = table.getField(ref);
              if (!refField || !refField?.reftable_name) return null;
              return {
                ref: ref.replace("?", ""),
                target,
                refTable: refField.reftable_name,
                refTablePK: Table.findOne(refField.reftable_name)!.pk_name,
              };
            })
            .filter(Boolean);
      }
    },
  });
  if (!req.layout_hints)
    req.layout_hints = state.getLayout(req.user).hints || {};
  let isMobileLogin = false;
  if (isRemote) {
    const loginForm = getState().getConfig("login_form", "");
    if (loginForm && viewname === loginForm) isMobileLogin = true;
  }
  let submitActionJS = undefined;
  const submitActionCol = columns.find((c: any) => c.is_submit_action);

  if (submitActionCol) {
    submitActionJS = `event.preventDefault();view_post(this, 'run_action', {rndid:'${submitActionCol.rndid}', ...get_form_record(this) })`;
    if (layout.above) layout.above.push(`<input type="submit" hidden />`);
    //TODO what if there is no above, e.g. all in card or container
  }

  const form = new Form({
    action: action,
    onSubmit:
      isRemote || isOfflineMode()
        ? `javascript:${
            !isMobileLogin
              ? `formSubmit(this, '/view/', '${viewname}')`
              : "loginFormSubmit(this)"
          }`
        : submitActionJS,
    viewname: viewname,
    fields: tfields,
    layout,
    req,
    pk_name: table.pk_name,
  });
  if (id) form.hidden(form.pk_name);
  return form;
};

const transformForm = async ({
  form,
  table,
  req,
  row,
  res,
  getRowQuery,
  viewname,
  optionsQuery,
  state,
}: {
  form: any;
  table: Table;
  req: any;
  row: Row | null;
  res: any;
  getRowQuery?: (
    tableId: number,
    viewSelect: GenObj,
    rowId: any,
    orderField?: string
  ) => Promise<Row[]>;
  viewname: string;
  optionsQuery?: GenObj;
  state: GenObj;
}): Promise<void> => {
  let originalState = state;
  let pseudo_row: any = {};
  if (!row) {
    table.fields.forEach((f) => {
      pseudo_row[f.name] = undefined;
    });
  }
  const appState = getState();
  const __ =
    db.is_node && appState
      ? (s: string) =>
          appState.i18n.__({ phrase: s, locale: req.getLocale() }) || s
      : (s: string) => {
          return s;
        };
  await traverse(form.layout, {
    container(segment: any) {
      if (segment.click_action) {
        segment.url = `javascript:view_post(this, 'run_action', {click_action: '${segment.click_action}', ...get_form_record(this) })`;
      }
    },
    async action(segment: any) {
      if (segment.action_style === "on_page_load") {
        segment.type = "blank";
        segment.style = {};
        if (segment.minRole && segment.minRole != 100) {
          const minRole = +segment.minRole;
          const userRole = req?.user?.role_id || 100;
          if (minRole < userRole) return;
        }
        if (req.method === "POST") return;

        //run action
        try {
          const actionResult = await run_action_column({
            col: { ...segment },
            referrer: req?.get?.("Referrer"),
            req,
            res,
            table,
            row: row || pseudo_row,
          });

          if (actionResult)
            segment.contents = script(
              domReady(
                `common_done(${JSON.stringify(actionResult)}, "${viewname}")`
              )
            );
        } catch (e: unknown) {
          const err = e as Error;
          appState.log(
            5,
            `Error in Edit ${viewname} on page load action: ${err.message}`
          );
          err.message = `Error in evaluating Run on Page Load action in view ${viewname}: ${err.message}`;
          throw err;
        }
      }
      if (segment.action_name === "Delete") {
        if (form.values && form.values[table.pk_name]) {
          segment.action_url = table.delete_url(form.values);
        } else {
          segment.type = "blank";
          segment.contents = "";
        }
      } else if (
        segment.action_name === "form_action" &&
        segment.configuration?.form_action === "Save" &&
        table.fields.some((f) => f.type === "File")
      ) {
        let url = action_url(
          viewname,
          table,
          segment.action_name,
          row || pseudo_row,
          segment.rndid,
          "rndid",
          segment.confirm
        );
        if (typeof url !== "string" && url.javascript) {
          //redo to include dynamic row
          const confirmStr = segment.confirm
            ? `if(confirm('Are you sure?'))`
            : "";
          url.javascript = `${confirmStr}view_post(this, 'run_action', get_form_data(this, '${segment.rndid}') );`;
        }
        segment.action_link = action_link(url, req, segment, __);
      } else if (
        !["Sign up", ...edit_build_in_actions].includes(segment.action_name) &&
        !segment.action_name.startsWith("Login")
      ) {
        let url = action_url(
          viewname,
          table,
          segment.action_name,
          row || pseudo_row,
          segment.rndid,
          "rndid",
          segment.confirm,
          undefined,
          segment.run_async
        );
        if (typeof url !== "string" && url.javascript) {
          //redo to include dynamic row
          const confirmStr = segment.confirm
            ? `if(confirm('Are you sure?'))`
            : "";

          // If this is a Multi-step action or the form/table contains File fields,
          // post multipart FormData so req.files is populated server-side.
          const hasFileFields = table.fields?.some(
            (f: any) => f.type === "File"
          );
          if (segment.action_name === "Multi-step action" || hasFileFields) {
            url.javascript = `${confirmStr}view_post(this, 'run_action', get_form_data(this, '${segment.rndid}') );`;
          } else {
            url.javascript = `${confirmStr}view_post(this, 'run_action', {rndid:'${segment.rndid}', ...get_form_record(this)});`;
          }
        }
        segment.action_link = action_link(url, req, segment, __);
      }
    },
    join_field(segment: any) {
      const qs = objToQueryString(segment.configuration);
      segment.sourceURL = `/field/show-calculated/${table.name}/${segment.join_field}/${segment.fieldview}?${qs}`;
    },
    tabs(segment: any) {
      const to_delete = new Set<number>();
      (segment.showif || []).forEach((sif: any, ix: number) => {
        if (sif) {
          const showit = eval_expression(
            sif,
            row || pseudo_row,
            req.user,
            "Tab show if formula"
          );
          if (!showit) to_delete.add(ix);
        }
      });

      segment.titles = segment.titles.filter(
        (v: any, ix: number) => !to_delete.has(ix)
      );
      segment.contents = segment.contents.filter(
        (v: any, ix: number) => !to_delete.has(ix)
      );

      (segment.titles || []).forEach((t: any, ix: number) => {
        if (typeof t === "string" && t.includes("{{")) {
          segment.titles[ix] = interpolate(t, row, req.user, "Tab titles");
        }
      });
    },
    view_link(segment: any) {
      segment.type = "blank";
      const view_select = parse_view_select(segment.view);
      if (!row && view_select.type !== "Independent") {
        segment.contents = "";
      } else {
        const prefix =
          req.generate_email && req.get_base_url ? req.get_base_url() : "";
        const { key } = view_linker(
          segment,
          table.fields,
          (s: string) => s,
          isWeb(req),
          req.user,
          prefix,
          req.query,
          req,
          viewname
        );
        segment.contents = key(row || {});
      }
    },
    async view(segment: any) {
      //console.log(segment);
      const view_select = parse_view_select(segment.view, segment.relation);
      //console.log({ view_select });

      const view = View.findOne({ name: view_select.viewname });
      if (!view)
        throw new InvalidConfiguration(
          `Cannot find embedded view: ${view_select.viewname}`
        );
      // check if the relation path matches a ChildList relations
      let childListRelPath = false;
      if (segment.relation && view.table_id) {
        const targetTbl = Table.findOne({ id: view.table_id })!;
        const relation = new Relation(
          segment.relation,
          targetTbl.name,
          displayType(await view.get_state_fields())
        );
        childListRelPath = relation.type === RelationType.CHILD_LIST;
      }
      // Edit-in-edit
      if (
        view.viewtemplate === "Edit" &&
        (view_select.type === "ChildList" || childListRelPath)
      ) {
        if (childListRelPath) updateViewSelect(view_select);
        const childTable = Table.findOne({ id: view.table_id })!;
        const childForm = await getForm(
          childTable,
          view.name,
          view.configuration.columns,
          view.configuration.layout,
          row?.id,
          req,
          !isWeb(req)
        );
        traverseSync(childForm.layout, {
          field(segment: any) {
            segment.field_name = `${view_select.field_name}.${segment.field_name}`;
          },
        });
        for (const field of childForm.fields) {
          if (field.name === childTable.pk_name) {
            field.class = field.class
              ? `${field.class} omit-repeater-clone`
              : "omit-repeater-clone";
          }
        }
        await childForm.fill_fkey_options(false, optionsQuery, req.user);

        const fr = new FieldRepeat({
          name: view_select.field_name,
          label: view_select.field_name,
          fields: childForm.fields,
          layout: childForm.layout,
          metadata: {
            table_id: childTable.id,
            view: segment.view,
            relation: view_select.field_name,
            relation_path: segment.relation,
            order_field: segment.order_field,
          },
        });
        if (row?.id) {
          const childRows = getRowQuery
            ? await getRowQuery(
                view.table_id!,
                view_select,
                row.id,
                segment.order_field
              )
            : await childTable.getRows(
                {
                  [view_select.field_name]: row.id,
                },
                segment.order_field ? { orderBy: segment.order_field } : {}
              );
          fr.metadata.rows = childRows;
          if (!fr.fields.map((f: any) => f.name).includes(childTable.pk_name))
            fr.fields.push({
              name: childTable.pk_name,
              input_type: "hidden",
            });
        }
        form.fields.push(fr);
        segment.type = "field_repeat";
        segment.field_repeat = fr;
        return;
      } // end edit in edit
      const outerState: any = {};
      Object.entries(originalState || {}).forEach(([k, v]) => {
        if (k.startsWith("_")) outerState[k] = v;
      });
      let state: any = {};
      let urlFormula: any;
      let needFields = new Set<string>();
      if (view_select.type === "RelationPath" && view.table_id) {
        const pathToUrlFormula = (relation: any) => {
          const st = pathToState(relation, (k: string) => `row.` + k);
          return Object.entries(st)
            .map(([k, v]: [string, any]) => {
              needFields.add(v.split(".")[1]);
              return `${k}='+${v}+'`;
            })
            .join("&");
        };

        const targetTbl = Table.findOne({ id: view.table_id });
        if (targetTbl) {
          const relation = new Relation(
            segment.relation,
            targetTbl.name,
            displayType(await view.get_state_fields())
          );
          const relFmlQS = pathToUrlFormula(relation);
          const type = relation.type;
          if (!row && type == RelationType.OWN) {
            segment.type = "blank";
            urlFormula = `add_extra_state('/view/${
              view.name
            }/?${relFmlQS}', ${JSON.stringify(
              segment.extra_state_fml
            )}, row, ${JSON.stringify(outerState)})`;
            segment.contents = segment.contents = div({
              class: "d-inline",
              "data-sc-embed-viewname": view.name,
              "data-view-source-need-fields": [...needFields].join(","),
              "data-view-source": encodeURIComponent(urlFormula),
            });
            return;
          } else if (
            !row &&
            type !== RelationType.INDEPENDENT &&
            !relation.isFixedRelation()
          ) {
            urlFormula = `add_extra_state('/view/${
              view.name
            }/?${relFmlQS}', ${JSON.stringify(
              segment.extra_state_fml
            )}, row, ${JSON.stringify(outerState)})`;
            segment.contents = segment.contents = div({
              class: "d-inline",
              "data-sc-embed-viewname": view.name,
              "data-view-source-need-fields": [...needFields].join(","),
              "data-view-source": encodeURIComponent(urlFormula),
            });
            return;
          }
          const userId = req?.user?.id;
          state = pathToState(
            relation,
            relation.isFixedRelation() ? () => userId : (k: string) => row![k]
          );

          urlFormula = `add_extra_state('/view/${
            view.name
          }?${relFmlQS}', ${JSON.stringify(
            segment.extra_state_fml
          )}, row, ${JSON.stringify(outerState)})`;
        }
      } else {
        const isIndependent = view_select.type === "Independent";
        // legacy none check ?

        if (!view)
          throw new InvalidConfiguration(
            `Edit view incorrectly configured: cannot find embedded view ${view_select.viewname}`
          );
        switch (view_select.type) {
          case "Own":
            state = { id: row?.id };
            urlFormula = `add_extra_state('/view/${
              view.name
            }/?id='+row.id, ${JSON.stringify(
              segment.extra_state_fml
            )}, row, ${JSON.stringify(outerState)})`;
            needFields.add("id");
            break;
          case "Independent":
            state = {};
            urlFormula = `add_extra_state('/view/${
              view.name
            }/?id='+row.id, ${JSON.stringify(
              segment.extra_state_fml
            )}, row, ${JSON.stringify(outerState)})`;
            needFields.add("id");
            break;
          case "ChildList":
          case "OneToOneShow":
            state = { [view_select.field_name]: row?.id };
            urlFormula = `add_extra_state('/view/${view.name}/?${
              view_select.field_name
            }='+row.id, ${JSON.stringify(
              segment.extra_state_fml
            )}, row, ${JSON.stringify(outerState)})`;
            needFields.add("id");
            break;
          case "ParentShow":
            state = { id: row?.[view_select.field_name] };
            urlFormula = `add_extra_state('/view/${view.name}/?id='+row.${
              view_select.field_name
            }, ${JSON.stringify(
              segment.extra_state_fml
            )}, row, ${JSON.stringify(outerState)})`;
            needFields.add(view_select.field_name);
            break;
        }
        if (!row && !isIndependent) {
          segment.type = "blank";
          segment.contents = div({
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-view-source-need-fields": [...needFields].join(","),
            "data-view-source": encodeURIComponent(urlFormula),
          });
          return;
        }
      }
      const extra_state = segment.extra_state_fml
        ? eval_expression(
            segment.extra_state_fml,
            {
              ...dollarizeObject(req.query),
              session_id: getSessionId(req),
              ...(row || pseudo_row),
            },
            req.user,
            `Extra state formula for embedding view ${view.name}`
          )
        : {};

      const qs = stateToQueryString(
        { ...state, ...outerState, ...extra_state },
        true
      );
      segment.contents = div(
        {
          class: "d-inline",
          "data-sc-embed-viewname": view.name,
          "data-sc-view-source": `/view/${view.name}${qs}`,
          "data-view-source-current": `/view/${view.name}${qs}`,
          "data-view-source-need-fields": [...needFields].join(","),
          "data-view-source": encodeURIComponent(urlFormula),
        },
        view.renderLocally()
          ? await view.run(
              { ...state, ...outerState, ...extra_state },
              { req, res },
              view.isRemoteTable()
            )
          : await renderServerSide(view.name, {
              ...state,
              ...outerState,
              ...extra_state,
            })
      );
    },
  });
  translateLayout(form.layout, req.getLocale());

  if (req.headers?.saltcornmodalrequest) form.xhrSubmit = true;
  setDateLocales(form, req.getLocale());
};

const setDateLocales = (form: { fields: Field[] }, locale: string): void => {
  form.fields.forEach((f) => {
    const ftype = f.type as any;
    if (ftype && ftype.name === "Date") {
      f.attributes.locale = locale;
    }
  });
};

/**
 * update viewSelect so that it looks like a normal ChildList
 */
const updateViewSelect = (viewSelect: GenObj): void => {
  if (viewSelect.path.length === 1) {
    viewSelect.field_name = viewSelect.path[0].inboundKey;
    viewSelect.table_name = viewSelect.path[0].table;
  } else if (viewSelect.path.length === 2) {
    viewSelect.field_name = viewSelect.path[1].inboundKey;
    viewSelect.table_name = viewSelect.path[1].table;
    viewSelect.throughTable = viewSelect.path[0].inboundKey;
    viewSelect.through = viewSelect.path[0].table;
  }
};
/**
 * @param {object} table
 * @param {object} req
 * @param {object} fixed
 * @returns {Promise<object>}
 */
const fill_presets = async (
  table: Table | null,
  req: GenObj,
  fixed: GenObj
): Promise<GenObj> => {
  if (!table) return fixed;
  const fields = table.getFields();
  Object.keys(fixed || {}).forEach((k: string) => {
    if (k.startsWith("preset_")) {
      if (fixed[k]) {
        const fldnm = k.replace("preset_", "");
        const fld = fields.find((f) => f.name === fldnm);
        if (fld) {
          if (table.name === "users" && fld.primary_key)
            fixed[fldnm] = req.user ? req.user.id : null;
          else
            fixed[fldnm] = (fld.presets as any)[fixed[k]]({
              user: req.user,
              req,
              field: fld,
            });
        }
      }
      delete fixed[k];
    } else {
      const fld = fields.find((f) => f.name === k);
      if (!fld) delete fixed[k];
      if (fixed[k] === null || fixed[k] === "") delete fixed[k];
    }
  });
  return fixed;
};
const objToQueryString = (o: GenObj | undefined): string =>
  Object.entries(o || {})
    .map(
      ([k, v]: [string, any]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    )
    .join("&");

// edit template build in actions
const edit_build_in_actions: string[] = [
  "Save",
  "SaveAndContinue",
  "UpdateMatchingRows",
  "SubmitWithAjax",
  "Reset",
  "GoBack",
  "Delete",
  "Cancel",
];

export {
  get_viewable_fields,
  get_viewable_fields_from_layout,
  action_url,
  objToQueryString,
  action_link,
  view_linker,
  parse_view_select,
  splitUniques,
  getForm,
  fill_presets,
  get_view_link_query,
  make_link,
  edit_build_in_actions,
  standardBlockDispatch,
  standardLayoutRowVisitor,
  setDateLocales,
  transformForm,
  updateViewSelect,
};
