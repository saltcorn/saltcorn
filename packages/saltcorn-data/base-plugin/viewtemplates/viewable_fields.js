const { post_btn, link } = require("@saltcorn/markup");
const { text, a } = require("@saltcorn/markup/tags");
const { getState } = require("../../db/state");
const { contract, is } = require("contractis");
const { is_column } = require("../../contracts");
const { link_view } = require("../../plugin-helper");
const { get_expression_function } = require("../../models/expression");

const action_url = contract(
  is.fun([is.str, is.class("Table"), is.str, is.obj()], is.any),
  (viewname, table, action_name, r) => {
    if (action_name === "Delete")
      return `/delete/${table.name}/${r.id}?redirect=/view/${viewname}`;
    else if (action_name.startsWith("Toggle")) {
      const field_name = action_name.replace("Toggle ", "");
      return `/edit/toggle/${table.name}/${r.id}/${field_name}?redirect=/view/${viewname}`;
    }
  }
);
const get_view_link_query = contract(
  is.fun(is.array(is.class("Field")), is.fun(is.obj(), is.str)),
  (fields) => {
    const fUnique = fields.find((f) => f.is_unique);
    if (fUnique)
      return (r) => `?${fUnique.name}=${encodeURIComponent(r[fUnique.name])}`;
    else return (r) => `?id=${r.id}`;
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
    fields
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

const view_linker = contract(
  is.fun(
    [is.obj({ view: is.str }), is.array(is.class("Field"))],
    is.obj({ key: is.fun(is.obj(), is.str), label: is.str })
  ),
  ({ view, view_label, in_modal, view_label_formula }, fields) => {
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
              in_modal
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
              in_modal
            ),
        };
      case "ParentShow":
        const [pviewnm, ptbl, pfld] = vrest.split(".");
        //console.log([pviewnm, ptbl, pfld])
        return {
          label: pviewnm,
          key: (r) => {
            const summary_field = r[`summary_field_${ptbl.toLowerCase()}`];
            return r[pfld]
              ? link_view(
                  `/view/${encodeURIComponent(pviewnm)}?id=${r[pfld]}`,
                  get_label(
                    typeof summary_field === "undefined"
                      ? pviewnm
                      : summary_field,
                    r
                  ),
                  in_modal
                )
              : "";
          },
        };
      default:
        throw new Error(view);
    }
  }
);

const get_viewable_fields = contract(
  is.fun(
    [
      is.str,
      is.class("Table"),
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
  (viewname, table, fields, columns, isShow, req) =>
    columns
      .map((column) => {
        if (column.type === "Action")
          return {
            label: column.header_label ? text(column.header_label) : "",
            key: (r) =>
              post_btn(
                action_url(viewname, table, column.action_name, r),
                column.action_label || column.action_name,
                req.csrfToken(),
                { small: true, ajax: true, reload_on_done: true }
              ),
          };
        else if (column.type === "ViewLink") {
          const r = view_linker(column, fields);
          if (column.header_label) r.label = text(column.header_label);
          return r;
        } else if (column.type === "Link") {
          const r = make_link(column, fields);
          if (column.header_label) r.label = text(column.header_label);
          return r;
        } else if (column.type === "JoinField") {
          const [refNm, targetNm] = column.join_field.split(".");
          return {
            label: column.header_label
              ? text(column.header_label)
              : text(targetNm),
            key: `${refNm}_${targetNm}`,
            // sortlink: `javascript:sortby('${text(targetNm)}')`
          };
        } else if (column.type === "Aggregation") {
          //console.log(column)
          const [table, fld] = column.agg_relation.split(".");
          const targetNm = (
            column.stat +
            "_" +
            table +
            "_" +
            fld
          ).toLowerCase();

          return {
            label: column.header_label
              ? text(column.header_label)
              : text(column.stat + " " + table),
            key: text(targetNm),
            // sortlink: `javascript:sortby('${text(targetNm)}')`
          };
        } else if (column.type === "Field") {
          const f = fields.find((fld) => fld.name === column.field_name);

          return (
            f && {
              label: column.header_label
                ? text(column.header_label)
                : text(f.label),
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
                      f.type.fieldviews[column.fieldview].run(row[f.name], req)
                  : isShow
                  ? f.type.showAs
                    ? (row) => f.type.showAs(row[f.name])
                    : (row) => text(row[f.name])
                  : f.listKey,
              sortlink: `javascript:sortby('${text(f.name)}')`,
            }
          );
        }
      })
      .filter((v) => !!v)
);

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
      if (k === "id") uniques[k] = v;
      else if (
        field &&
        field.is_unique &&
        fuzzyStrings &&
        field.type &&
        field.type.name === "String"
      )
        uniques[k] = { ilike: v };
      else if (field && field.is_unique) uniques[k] = v;
      else nonUniques[k] = v;
    });
    return { uniques, nonUniques };
  }
);

module.exports = {
  get_viewable_fields,
  action_url,
  view_linker,
  splitUniques,
};
