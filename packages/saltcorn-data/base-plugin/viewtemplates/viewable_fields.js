/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/viewable_fields
 * @subcategory base-plugin
 */
const { post_btn } = require("@saltcorn/markup");
const { text, a, i, div, button } = require("@saltcorn/markup/tags");
const { getState } = require("../../db/state");
const { link_view } = require("../../plugin-helper");
const { eval_expression } = require("../../models/expression");
const Field = require("../../models/field");
const Form = require("../../models/form");
const { traverseSync } = require("../../models/layout");
const { structuredClone, isWeb } = require("../../utils");
const db = require("../../db");
const View = require("../../models/view");
const Table = require("../../models/table");
const { isNode } = require("../../utils");
const { bool, date } = require("../types");


/**
 * formats the column index of a view cfg
 * @param {number|undefined} colIndex
 * @returns json formatted attribute for run_action
 */
const columnIndex = (colIndex) =>
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
  viewname,
  table,
  action_name,
  r,
  colId,
  colIdNm,
  confirm,
  colIndex
) => {
  if (action_name === "Delete")
    return `/delete/${table.name}/${r.id}?redirect=/view/${viewname}`;
  else if (action_name === "GoBack")
    return { javascript: isNode() ? "history.back()" : "parent.goBack()" };
  else if (action_name.startsWith("Toggle")) {
    const field_name = action_name.replace("Toggle ", "");
    return `/edit/toggle/${table.name}/${r.id}/${field_name}?redirect=/view/${viewname}`;
  }
  const confirmStr = confirm ? `if(confirm('${"Are you sure?"}'))` : "";
  return {
    javascript: `${confirmStr}view_post('${viewname}', 'run_action', {${colIdNm}:'${colId}', id:${r?.id
      }${columnIndex(colIndex)}});`,
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
  url,
  req,
  {
    action_name,
    action_label,
    confirm,
    rndid,
    action_style,
    action_size,
    action_icon,
    action_bgcol,
    action_bordercol,
    action_textcol,
    block,
  },
  __ = (s) => s
) => {
  const label = __(action_label) || action_name;
  let style =
    action_style === "btn-custom-color"
      ? `background-color: ${action_bgcol || "#000000"};border-color: ${action_bordercol || "#000000"
      }; color: ${action_textcol || "#000000"}`
      : null;
  if (url.javascript)
    return a(
      {
        href: "javascript:" + url.javascript,
        class:
          action_style === "btn-link"
            ? ""
            : `btn ${action_style || "btn-primary"} ${action_size || ""}`,
        style,
      },
      action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
      label
    );
  else
    return post_btn(url, label, req.csrfToken(), {
      confirm,
      req,
      icon: action_icon,
      style,
      btnClass: `${action_style || "btn-primary"} ${action_size || ""}`,
      formClass: !block && "d-inline",
    });
};

const slug_transform = (row) => (step) =>
  step.transform === "slugify"
    ? `/${db.slugify(row[step.field])}`
    : `/${row[step.field]}`;
/**
 * @function
 * @param {Field[]} fields
 * @returns {function}
 */
const get_view_link_query = (fields, view) => {
  if (view && view.slug && view.slug.steps && view.slug.steps.length > 0) {
    return (r) => view.slug.steps.map(slug_transform(r)).join("");
  }

  const pk_name = fields.find((f) => f.primary_key).name;

  return (r) => `?${pk_name}=${r[pk_name]}`;

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
  },
  fields,
  __ = (s) => s
) => {
  return {
    label: "",
    key: (r) => {
      let txt, href;
      try {
        txt = link_text_formula ? eval_expression(link_text, r) : link_text;
      } catch (error) {
        error.message = `Error in formula ${link_text} for link text:\n${error.message}`;
        throw error;
      }
      try {
        href = link_url_formula ? eval_expression(link_url, r) : link_url;
      } catch (error) {
        error.message = `Error in formula ${link_url} for link URL:\n${error.message}`;
        throw error;
      }
      const attrs = { href };
      if (link_target_blank) attrs.target = "_blank";
      if (in_dropdown) attrs.class = "dropdown-item";
      if (in_modal)
        return a(
          {
            ...attrs,
            href: isNode()
              ? `javascript:ajax_modal('${href}');`
              : `javascript:mobile_modal('${href}');`,
          },
          txt
        );
      return a(attrs, txt);
    },
  };
};

/**
 * @param {string} s
 * @returns {object}
 */
const parse_view_select = (s) => {
  const colonSplit = s.split(":");
  if (colonSplit.length === 1) return { type: "Own", viewname: s };
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
};

//todo: use above to simplify code
/**
 * @function
 * @param {object} opts
 * @param {string} opts.view,
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
    view_label,
    in_modal,
    view_label_formula,
    link_style = "",
    link_size = "",
    link_icon = "",
    textStyle = "",
    link_bgcol,
    link_bordercol,
    link_textcol,
    in_dropdown,
    extra_state_fml,
    link_target_blank,
  },
  fields,
  __ = (s) => s,
  isWeb = true,
  user
) => {
  const get_label = (def, row) => {
    if (!view_label || view_label.length === 0) return def;
    if (!view_label_formula) return view_label;
    return eval_expression(view_label, row);
  };
  const get_extra_state = (row) => {
    if (!extra_state_fml) return "";
    const o = eval_expression(extra_state_fml, row, user);
    return Object.entries(o)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
  };
  const [vtype, vrest] = view.split(":");
  switch (vtype) {
    case "Own":
      const vnm = vrest;
      const viewrow = View.findOne({ name: vnm });
      const get_query = get_view_link_query(fields, viewrow || {});
      return {
        label: vnm,
        key: (r) => {
          const target = `/view/${encodeURIComponent(vnm)}${get_query(r)}`;
          return link_view(
            isWeb || in_modal ? target : `javascript:execLink('${target}')`,
            get_label(vnm, r),
            in_modal,
            link_style,
            link_size,
            link_icon,
            textStyle,
            link_bgcol,
            link_bordercol,
            link_textcol,
            in_dropdown && "dropdown-item",
            get_extra_state(r),
            link_target_blank
          );
        },
      };
    case "Independent":
      const ivnm = vrest;
      return {
        label: ivnm,
        key: (r) => {
          const target = `/view/${encodeURIComponent(ivnm)}`;
          return link_view(
            isWeb || in_modal ? target : `javascript:execLink('${target}')`,
            get_label(ivnm, r),
            in_modal,
            link_style,
            link_size,
            link_icon,
            textStyle,
            link_bgcol,
            link_bordercol,
            link_textcol,
            in_dropdown && "dropdown-item",
            get_extra_state(r),
            link_target_blank
          );
        },
      };
    case "ChildList":
    case "OneToOneShow":
      const [viewnm, tbl, fld, throughTable, through] = vrest.split(".");
      const varPath = through ? `${throughTable}.${through}.${fld}` : fld;
      return {
        label: viewnm,
        key: (r) => {
          const target = `/view/${encodeURIComponent(viewnm)}?${varPath}=${r.id
            }`;
          return link_view(
            isWeb || in_modal ? target : `javascript:execLink('${target}')`,
            get_label(viewnm, r),
            in_modal,
            link_style,
            link_size,
            link_icon,
            textStyle,
            link_bgcol,
            link_bordercol,
            link_textcol,
            in_dropdown && "dropdown-item",
            get_extra_state(r),
            link_target_blank
          );
        },
      };
    case "ParentShow":
      const [pviewnm, ptbl, pfld] = vrest.split(".");
      //console.log([pviewnm, ptbl, pfld])
      return {
        label: pviewnm,
        key: (r) => {
          const reffield = fields.find((f) => f.name === pfld);
          const summary_field = r[`summary_field_${ptbl.toLowerCase()}`];
          if (r[pfld]) {
            const target = `/view/${encodeURIComponent(pviewnm)}?${reffield.refname
              }=${typeof r[pfld] === "object" ? r[pfld].id : r[pfld]}`;
            return link_view(
              isWeb || in_modal ? target : `javascript:execLink('${target}')`,
              get_label(
                typeof summary_field === "undefined" ? pviewnm : summary_field,
                r
              ),
              in_modal,
              link_style,
              link_size,
              link_icon,
              textStyle,
              link_bgcol,
              link_bordercol,
              link_textcol,
              in_dropdown && "dropdown-item",
              get_extra_state(r),
              link_target_blank
            );
          } else return "";
        },
      };
    default:
      throw new Error(view);
  }
};

/**
 * @param {string} nm
 * @returns {boolean}
 */
const action_requires_write = (nm) => {
  if (!nm) return false;
  if (nm === "Delete") return true;
  if (nm.startsWith("Toggle")) return true;
};

// flapMap if f returns array
const flapMaipish = (xs, f) => {
  const res = [];
  let index = 0;
  for (const x of xs) {
    const y = f(x, index++);
    if (Array.isArray(y)) res.push(...y);
    else res.push(y);
  }
  return res;
};

/**
 * @function
 * @param {string} viewname
 * @param {Table|object} table
 * @param {Fields[]} fields
 * @param {object[]} columns
 * @param {boolean} isShow
 * @param {object} req
 * @param {*} __
 * @returns {object[]}
 */
const get_viewable_fields = (
  viewname,
  table,
  fields,
  columns,
  isShow,
  req,
  __
) => {
  const dropdown_actions = [];
  const tfields = flapMaipish(columns, (column, index) => {
    const role = req.user ? req.user.role_id : 10;
    const user_id = req.user ? req.user.id : null;
    const setWidth = column.col_width
      ? { width: `${column.col_width}${column.col_width_units}` }
      : {};
    if (column.type === "FormulaValue") {
      return {
        ...setWidth,
        label: column.header_label ? text(__(column.header_label)) : "",
        key: (r) => text(eval_expression(column.formula, r))
      }
    } else if (column.type === "Action") {
      const action_col = {
        ...setWidth,
        label: column.header_label ? text(__(column.header_label)) : "",
        key: (r) => {
          if (action_requires_write(column.action_name)) {
            if (table.min_role_write < role && !table.is_owner(req.user, r))
              return "";
          }
          const url = action_url(
            viewname,
            table,
            column.action_name,
            r,
            column.action_name,
            "action_name",
            column.confirm,
            index
          );
          const label = column.action_label_formula
            ? eval_expression(column.action_label, r)
            : __(column.action_label) || column.action_name;
          if (url.javascript)
            return a(
              {
                href: "javascript:" + url.javascript,
                class: column.in_dropdown
                  ? "dropdown-item"
                  : column.action_style === "btn-link"
                    ? ""
                    : `btn ${column.action_style || "btn-primary"} ${column.action_size || ""
                    }`,
              },
              label
            );
          else
            return post_btn(url, label, req.csrfToken(), {
              small: true,
              ajax: true,
              reload_on_done: true,
              confirm: column.confirm,
              btnClass: column.in_dropdown
                ? "dropdown-item"
                : column.action_style || "btn-primary",
              req,
            });
        },
      };
      if (column.in_dropdown) {
        dropdown_actions.push(action_col);
        return false;
      } else return action_col;
    } else if (column.type === "ViewLink") {
      if (!column.view) return;
      const r = view_linker(column, fields, __, isWeb(req), req.user);
      if (column.header_label) r.label = text(__(column.header_label));
      Object.assign(r, setWidth);
      if (column.in_dropdown) {
        dropdown_actions.push(r);
        return false;
      } else return r;
    } else if (column.type === "Link") {
      const r = make_link(column, fields, __);
      if (column.header_label) r.label = text(__(column.header_label));
      Object.assign(r, setWidth);
      if (column.in_dropdown) {
        dropdown_actions.push(r);
        return false;
      } else return r;
    } else if (column.type === "JoinField") {
      //console.log(column);
      let refNm, targetNm, through, key, type;
      if (column.join_field.includes("->")) {
        const [relation, target] = column.join_field.split("->");
        const [ontable, ref] = relation.split(".");
        targetNm = target;
        refNm = ref;
        key = `${ref}_${ontable}_${target}`;
      } else {
        const keypath = column.join_field.split(".");
        refNm = keypath[0];
        targetNm = keypath[keypath.length - 1];
        key = keypath.join("_");
      }
      if (column.field_type) type = getState().types[column.field_type];
      if (
        column.join_fieldview &&
        type?.fieldviews?.[column.join_fieldview]?.expandColumns
      ) {
        const reffield = fields.find((f) => f.name === refNm);
        const reftable = Table.findOne({
          name: reffield.reftable_name,
        });
        const field = reftable.fields.find((f) => f.name === targetNm);
        return type.fieldviews[column.join_fieldview].expandColumns(
          field,
          {
            ...field.attributes,
            ...column,
          },
          column
        );
      }

      return {
        ...setWidth,
        label: column.header_label
          ? text(__(column.header_label))
          : text(targetNm),
        row_key: key,
        key:
          column.join_fieldview &&
            type &&
            type.fieldviews &&
            type.fieldviews[column.join_fieldview]
            ? (row) =>
              type.fieldviews[column.join_fieldview].run(
                row[key],
                req,
                column
              )
            : (row) => text(row[key]),
        // sortlink: `javascript:sortby('${text(targetNm)}')`
      };
    } else if (column.type === "Aggregation") {

      let table, fld, through;
      if (column.agg_relation.includes("->")) {
        let restpath;
        [through, restpath] = column.agg_relation.split("->");
        [table, fld] = restpath.split(".");

      } else {
        [table, fld] = column.agg_relation.split(".");
      }
      const targetNm = (
        column.stat.replace(" ", "") +
        "_" +
        table +
        "_" +
        fld +
        db.sqlsanitize(column.aggwhere || "")
      ).toLowerCase();
      let showValue = value => {
        if (value === true || value === false)
          return bool.fieldviews.show.run(value)
        if (value instanceof Date)
          return date.fieldviews.show.run(value)
        return value.toString()
      }
      let key = r => {
        const value = r[targetNm]
        return showValue(value)
      };
      if (column.stat.toLowerCase() === "array_agg")
        key = (r) =>
          Array.isArray(r[targetNm])
            ? r[targetNm].map((v) => showValue(v)).join(", ")
            : "";
      return {
        ...setWidth,
        label: column.header_label
          ? text(column.header_label)
          : text(column.stat + " " + table),
        key,
        // sortlink: `javascript:sortby('${text(targetNm)}')`
      };
    } else if (column.type === "Field") {
      //console.log(column);
      let f = fields.find((fld) => fld.name === column.field_name);
      let f_with_val = f;
      if (f && f.attributes && f.attributes.localized_by) {
        const locale = req.getLocale();
        const localized_fld_nm = f.attributes.localized_by[locale];
        f_with_val = fields.find((fld) => fld.name === localized_fld_nm) || f;
      }
      const isNum = f && f.type && f.type.name === "Integer";
      if (
        column.fieldview &&
        f?.type?.fieldviews?.[column.fieldview]?.expandColumns
      ) {
        return f.type.fieldviews[column.fieldview].expandColumns(
          f,
          {
            ...f.attributes,
            ...column.configuration,
          },
          column
        );
      }

      return (
        f && {
          ...setWidth,
          align: isNum ? "right" : undefined,
          label: headerLabelForName(column, f, req, __),
          row_key: f_with_val.name,
          key:
            column.fieldview && f.type === "File"
              ? (row) =>
                row[f.name] &&
                getState().fileviews[column.fieldview].run(
                  row[f.name],
                  row[`${f.name}__filename`],
                  column
                )
              : column.fieldview &&
                f.type.fieldviews &&
                f.type.fieldviews[column.fieldview]
                ? (row) =>
                  f.type.fieldviews[column.fieldview].run(
                    row[f_with_val.name],
                    req,
                    { ...f.attributes, ...column.configuration }
                  )
                : isShow
                  ? f.type.showAs
                    ? (row) => f.type.showAs(row[f_with_val.name])
                    : (row) => text(row[f_with_val.name])
                  : f.listKey,
          sortlink:
            !f.calculated || f.stored
              ? sortlinkForName(f.name, req, viewname)
              : undefined,
        }
      );
    }
  }).filter((v) => !!v);
  if (dropdown_actions.length > 0) {
    tfields.push({
      label: "Action",
      key: (r) =>
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
            "Action"
          ),
          div(
            {
              class: "dropdown-menu dropdown-menu-end",
              "aria-labelledby": `actiondd${r.id}`,
            },
            dropdown_actions.map((acol) => acol.key(r))
          )
        ),
    });
  }
  return tfields;
};
/**
 * @param {string} fname
 * @param {object} req
 * @returns {string}
 */
const sortlinkForName = (fname, req, viewname) => {
  const { _sortby, _sortdesc } = req.query || {};
  const desc =
    typeof _sortdesc == "undefined"
      ? _sortby === fname
      : _sortdesc
        ? "false"
        : "true";
  return isWeb(req)
    ? `javascript:sortby('${text(fname)}', ${desc})`
    : `javascript:sortby('${text(fname)}', ${desc}, '${viewname}')`;
};

/**
 * @param {object} column
 * @param {object} f
 * @param {object} req
 * @param {*} __
 * @returns {string}
 */
const headerLabelForName = (column, f, req, __) => {
  const label = column.header_label
    ? text(__(column.header_label))
    : text(f.label);
  const { _sortby, _sortdesc } = req.query || {};
  let arrow =
    _sortby !== f.name
      ? ""
      : _sortdesc
        ? i({ class: "fas fa-caret-down" })
        : i({ class: "fas fa-caret-up" });
  return label + arrow;
};

/**
 * @function
 * @param {Field[]} fields
 * @param {object} state
 * @param {boolean} [fuzzyStrings]
 * @returns {object}
 */
const splitUniques = (fields, state, fuzzyStrings) => {
  let uniques = {};
  let nonUniques = {};
  Object.entries(state).forEach(([k, v]) => {
    const field = fields.find((f) => f.name === k);
    if (
      field &&
      field.is_unique &&
      fuzzyStrings &&
      field.type &&
      field.type.name === "String"
    )
      uniques[k] = { ilike: v };
    else if (field && field.is_unique)
      uniques[k] = field.type.read ? field.type.read(v) : v;
    else nonUniques[k] = v;
  });
  return { uniques, nonUniques };
};

/**
 * @param {object} table
 * @param {string} viewname
 * @param {object[]} [columns]
 * @param {object} layout0
 * @param {boolean} id
 * @param {object} req
 * @returns {Promise<Form>}
 */
const getForm = async (
  table,
  viewname,
  columns,
  layout0,
  id,
  req,
  isRemote
) => {
  const fields = await table.getFields();

  const tfields = (columns || [])
    .map((column) => {
      if (column.type === "Field") {
        const f = fields.find((fld) => fld.name === column.field_name);
        if (f) {
          f.fieldview = column.fieldview;
          if (f.type === "Key") {
            if (getState().keyFieldviews[column.fieldview])
              f.fieldviewObj = getState().keyFieldviews[column.fieldview];
            f.input_type =
              !f.fieldview ||
                !f.fieldviewObj ||
                (f.fieldview === "select" && !f.fieldviewObj)
                ? "select"
                : "fromtype";
          }
          if (f.type === "File") {
            const fvNm = column.fieldview || "upload";
            if (getState().fileviews[fvNm])
              f.fieldviewObj = getState().fileviews[fvNm];
            f.input_type =
              !f.fieldview || !f.fieldviewObj ? "file" : "fromtype";
          }
          if (f.calculated)
            f.sourceURL = `/field/show-calculated/${table.name}/${f.name}/${f.fieldview}`;
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
    .filter((tf) => !!tf);
  const path = isWeb(req) ? req.baseUrl + req.path : "";
  let action = `/view/${viewname}`;
  if (path && path.startsWith("/auth/")) action = path;
  const layout = structuredClone(layout0);
  traverseSync(layout, {
    container(segment) {
      if (segment.showIfFormula) {
        segment.showIfFormulaInputs = segment.showIfFormula;
      }
    },
  });
  const form = new Form({
    action: action,
    onSubmit: isRemote
      ? `javascript:formSubmit(this, '/view/', '${viewname}')`
      : undefined,
    fields: tfields,
    layout,
    req,
  });
  if (id) form.hidden("id");
  return form;
};

/**
 * @param {object} table
 * @param {object} req
 * @param {object} fixed
 * @returns {Promise<object>}
 */
const fill_presets = async (table, req, fixed) => {
  if (!table) return fixed;
  const fields = await table.getFields();
  Object.keys(fixed || {}).forEach((k) => {
    if (k.startsWith("preset_")) {
      if (fixed[k]) {
        const fldnm = k.replace("preset_", "");
        const fld = fields.find((f) => f.name === fldnm);
        if (fld) {
          if (table.name === "users" && fld.primary_key)
            fixed[fldnm] = req.user ? req.user.id : null;
          else fixed[fldnm] = fld.presets[fixed[k]]({ user: req.user, req });
        }
      }
      delete fixed[k];
    } else {
      const fld = fields.find((f) => f.name === k);
      if (!fld) delete fixed[k];
    }
  });
  return fixed;
};
const objToQueryString = (o) =>
  Object.entries(o || {})
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

module.exports = {
  get_viewable_fields,
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
};
