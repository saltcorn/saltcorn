const { post_btn, link } = require("@saltcorn/markup");
const { text, a, i } = require("@saltcorn/markup/tags");
const { getState } = require("../../db/state");
const { contract, is } = require("contractis");
const { is_column, is_tablely } = require("../../contracts");
const { link_view, strictParseInt } = require("../../plugin-helper");
const { get_expression_function } = require("../../models/expression");
const Field = require("../../models/field");
const Form = require("../../models/form");
const { traverseSync } = require("../../models/layout");
const { structuredClone } = require("../../utils");
const db = require("../../db");

const action_url = contract(
  is.fun([is.str, is_tablely, is.str, is.obj()], is.any),
  (viewname, table, action_name, r, colId, colIdNm) => {
    if (action_name === "Delete")
      return `/delete/${table.name}/${r.id}?redirect=/view/${viewname}`;
    else if (action_name.startsWith("Toggle")) {
      const field_name = action_name.replace("Toggle ", "");
      return `/edit/toggle/${table.name}/${r.id}/${field_name}?redirect=/view/${viewname}`;
    }
    return {
      javascript: `view_post('${viewname}', 'run_action', {${colIdNm}:'${colId}', id:${r.id}});`,
    };
  }
);

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
  },
  __ = (s) => s
) => {
  const label = __(action_label) || action_name;
  if (url.javascript)
    return a(
      {
        href: "javascript:" + url.javascript,
        class:
          action_style === "btn-link"
            ? ""
            : `btn ${action_style || "btn-primary"} ${action_size || ""}`,
      },
      action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
      label
    );
  else
    return post_btn(url, label, req.csrfToken(), {
      confirm,
      req,
      icon: action_icon,
      btnClass: `${action_style || "btn-primary"} ${action_size || ""}`,
    });
};
const get_view_link_query = contract(
  is.fun(is.array(is.class("Field")), is.fun(is.obj(), is.str)),
  (fields) => {
    const fUniqueString = fields.find(
      (f) => f.is_unique && f.type.name === "String"
    );
    if (fUniqueString)
      return (r) =>
        `?${fUniqueString.name}=${encodeURIComponent(r[fUniqueString.name])}`;
    const fUnique = fields.find((f) => f.is_unique);
    if (fUnique)
      return (r) => `?${fUnique.name}=${encodeURIComponent(r[fUnique.name])}`;
    else {
      const pk_name = fields.find((f) => f.primary_key).name;
      return (r) => `?${pk_name}=${r[pk_name]}`;
    }
  }
);

const make_link = contract(
  is.fun(
    [is.obj({ link_text: is.str }), is.array(is.class("Field"))],
    is.obj({ key: is.fun(is.obj(), is.str), label: is.str })
  ),
  (
    {
      link_text,
      link_text_formula,
      link_url,
      link_url_formula,
      link_target_blank,
    },
    fields,
    __ = (s) => s
  ) => {
    return {
      label: "",
      key: (r) => {
        const txt = link_text_formula
          ? get_expression_function(link_text, fields)(r)
          : link_text;
        const href = link_url_formula
          ? get_expression_function(link_url, fields)(r)
          : link_url;
        const attrs = { href };
        if (link_target_blank) attrs.target = "_blank";
        return a(attrs, txt);
      },
    };
  }
);
const parse_view_select = (s) => {
  const colonSplit = s.split(":");
  if (colonSplit.length === 1) return { type: "Own", viewname: s };
  const [type, vrest] = colonSplit;
  switch (type) {
    case "Own":
      return { type, viewname: vrest };
    case "ChildList":
      const [viewnm, tbl, fld] = vrest.split(".");
      return { type, viewname: viewnm, table_name: tbl, field_name: fld };
    case "ParentShow":
      const [pviewnm, ptbl, pfld] = vrest.split(".");
      return { type, viewname: pviewnm, table_name: ptbl, field_name: pfld };
  }
};

//todo: use above to simplify code
const view_linker = contract(
  is.fun(
    [is.obj({ view: is.str }), is.array(is.class("Field"))],
    is.obj({ key: is.fun(is.obj(), is.str), label: is.str })
  ),
  (
    {
      view,
      view_label,
      in_modal,
      view_label_formula,
      link_style = "",
      link_size = "",
      link_icon = "",
      textStyle = "",
    },
    fields,
    __ = (s) => s
  ) => {
    const get_label = (def, row) => {
      if (!view_label || view_label.length === 0) return def;
      if (!view_label_formula) return view_label;
      const f = get_expression_function(view_label, fields);
      return f(row);
    };
    const [vtype, vrest] = view.split(":");
    switch (vtype) {
      case "Own":
        const vnm = vrest;
        const get_query = get_view_link_query(fields);
        return {
          label: vnm,
          key: (r) =>
            link_view(
              `/view/${encodeURIComponent(vnm)}${get_query(r)}`,
              get_label(vnm, r),
              in_modal,
              link_style,
              link_size,
              link_icon,
              textStyle
            ),
        };
      case "ChildList":
        const [viewnm, tbl, fld] = vrest.split(".");
        return {
          label: viewnm,
          key: (r) =>
            link_view(
              `/view/${encodeURIComponent(viewnm)}?${fld}=${r.id}`,
              get_label(viewnm, r),
              in_modal,
              link_style,
              link_size,
              link_icon,
              textStyle
            ),
        };
      case "ParentShow":
        const [pviewnm, ptbl, pfld] = vrest.split(".");
        //console.log([pviewnm, ptbl, pfld])
        return {
          label: pviewnm,
          key: (r) => {
            const reffield = fields.find((f) => f.name === pfld);
            const summary_field = r[`summary_field_${ptbl.toLowerCase()}`];
            return r[pfld]
              ? link_view(
                  `/view/${encodeURIComponent(pviewnm)}?${reffield.refname}=${
                    r[pfld]
                  }`,
                  get_label(
                    typeof summary_field === "undefined"
                      ? pviewnm
                      : summary_field,
                    r
                  ),
                  in_modal,
                  link_style,
                  link_size,
                  link_icon,
                  textStyle
                )
              : "";
          },
        };
      default:
        throw new Error(view);
    }
  }
);

const action_requires_write = (nm) => {
  if (!nm) return false;
  if (nm === "Delete") return true;
  if (nm.startsWith("Toggle")) return true;
};

const get_viewable_fields = contract(
  is.fun(
    [
      is.str,
      is_tablely,
      is.array(is.class("Field")),
      is.array(is_column),
      is.bool,
      is.obj({ csrfToken: is.fun([], is.str) }),
    ],

    is.array(
      is.obj({
        key: is.or(is.fun(is.obj(), is.str), is.str, is.undefined),
        label: is.str,
      })
    )
  ),
  (viewname, table, fields, columns, isShow, req, __) =>
    columns
      .map((column) => {
        const role = req.user ? req.user.role_id : 10;
        const user_id = req.user ? req.user.id : null;
        if (column.type === "Action")
          return {
            label: column.header_label ? text(__(column.header_label)) : "",
            key: (r) => {
              if (action_requires_write(column.action_name)) {
                const owner_field = table.owner_fieldname_from_fields(fields);
                if (
                  table.min_role_write < role &&
                  (!owner_field || r[owner_field] !== user_id)
                )
                  return "";
              }
              const url = action_url(
                viewname,
                table,
                column.action_name,
                r,
                column.action_name,
                "action_name"
              );
              const label = column.action_label_formula
                ? get_expression_function(column.action_label, fields)(r)
                : __(column.action_label) || column.action_name;
              if (url.javascript)
                return a(
                  {
                    href: "javascript:" + url.javascript,
                    class:
                      column.action_style === "btn-link"
                        ? ""
                        : `btn ${column.action_style || "btn-primary"} ${
                            column.action_size || ""
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
                  btnClass: column.action_style || "btn-primary",
                  req,
                });
            },
          };
        else if (column.type === "ViewLink") {
          if (!column.view) return;
          const r = view_linker(column, fields, __);
          if (column.header_label) r.label = text(__(column.header_label));
          return r;
        } else if (column.type === "Link") {
          const r = make_link(column, fields, __);
          if (column.header_label) r.label = text(__(column.header_label));
          return r;
        } else if (column.type === "JoinField") {
          const keypath = column.join_field.split(".");
          let refNm, targetNm, through, key;
          if (keypath.length === 2) {
            [refNm, targetNm] = keypath;
            key = `${refNm}_${targetNm}`;
          } else {
            [refNm, through, targetNm] = keypath;
            key = `${refNm}_${through}_${targetNm}`;
          }

          return {
            label: column.header_label
              ? text(__(column.header_label))
              : text(targetNm),
            key,
            // sortlink: `javascript:sortby('${text(targetNm)}')`
          };
        } else if (column.type === "Aggregation") {
          //console.log(column)
          const [table, fld] = column.agg_relation.split(".");
          const targetNm = (
            column.stat.replace(" ", "") +
            "_" +
            table +
            "_" +
            fld +
            db.sqlsanitize(column.aggwhere || "")
          ).toLowerCase();

          return {
            label: column.header_label
              ? text(column.header_label)
              : text(column.stat + " " + table),
            key: text(targetNm),
            // sortlink: `javascript:sortby('${text(targetNm)}')`
          };
        } else if (column.type === "Field") {
          let f = fields.find((fld) => fld.name === column.field_name);
          const isNum = f && f.type && f.type.name === "Integer";
          return (
            f && {
              align: isNum ? "right" : undefined,
              label: headerLabelForName(column, f, req, __),
              key:
                column.fieldview && f.type === "File"
                  ? (row) =>
                      row[f.name] &&
                      getState().fileviews[column.fieldview].run(
                        row[f.name],
                        row[`${f.name}__filename`]
                      )
                  : column.fieldview &&
                    f.type.fieldviews &&
                    f.type.fieldviews[column.fieldview]
                  ? (row) =>
                      f.type.fieldviews[column.fieldview].run(
                        row[f.name],
                        req,
                        column.configuration
                      )
                  : isShow
                  ? f.type.showAs
                    ? (row) => f.type.showAs(row[f.name])
                    : (row) => text(row[f.name])
                  : f.listKey,
              sortlink:
                !f.calculated || f.stored
                  ? sortlinkForName(f.name, req)
                  : undefined,
            }
          );
        }
      })
      .filter((v) => !!v)
);
const sortlinkForName = (fname, req) => {
  const { _sortby, _sortdesc } = req.query || {};
  const desc =
    typeof _sortdesc == "undefined"
      ? _sortby === fname
      : _sortdesc
      ? "false"
      : "true";
  return `javascript:sortby('${text(fname)}', ${desc})`;
};
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
const splitUniques = contract(
  is.fun(
    [is.array(is.class("Field")), is.obj(), is.maybe(is.bool)],
    is.obj({ uniques: is.obj(), nonUniques: is.obj() })
  ),
  (fields, state, fuzzyStrings) => {
    var uniques = [];
    var nonUniques = [];
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
  }
);
const getForm = async (table, viewname, columns, layout0, id, req) => {
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
          if (f.calculated)
            f.sourceURL = `/field/show-calculated/${table.name}/${f.name}/${f.fieldview}`;

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
  const path = req.baseUrl + req.path;
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
    action,
    fields: tfields,
    layout,
  });
  await form.fill_fkey_options();
  if (id) form.hidden("id");
  return form;
};
module.exports = {
  get_viewable_fields,
  action_url,
  action_link,
  view_linker,
  parse_view_select,
  splitUniques,
  getForm,
};
