const { post_btn, link } = require("@saltcorn/markup");
const { text } = require("@saltcorn/markup/tags");
const { getState } = require("../../db/state");
const { contract, is } = require("contractis");
const { is_column } = require("../../contracts");

const action_url = contract(
  is.fun([is.str, is.class("Table"), is_column, is.obj()], is.any),
  (viewname, table, column, r) => {
    if (column.action_name === "Delete")
      return `/delete/${table.name}/${r.id}?redirect=/view/${viewname}`;
    else if (column.action_name.startsWith("Toggle")) {
      const field_name = column.action_name.replace("Toggle ", "");
      return `/edit/toggle/${table.name}/${r.id}/${field_name}?redirect=/view/${viewname}`;
    }
  }
);
const get_view_link_query = contract(
  is.fun(is.array(is.class("Field")), is.fun(is.obj(), is.str)),
  fields => {
    const fUnique = fields.find(f => f.is_unique);
    if (fUnique)
      return r => `?${fUnique.name}=${encodeURIComponent(r[fUnique.name])}`;
    else return r => `?id=${r.id}`;
  }
);

const view_linker = contract(
  is.fun(
    [is.obj(), is.array(is.class("Field"))],
    is.promise(is.obj({ key: is.fun(is.obj(), is.str), label: is.str }))
  ),
  async (column, fields) => {
    const [vtype, vrest] = column.view.split(":");
    switch (vtype) {
      case "Own":
        const vnm = vrest;
        const get_query = get_view_link_query(fields);
        return {
          label: vnm,
          key: r => link(`/view/${vnm}${get_query(r)}`, vnm)
        };
      case "ChildList":
        const [viewnm, tbl, fld] = vrest.split(".");
        return {
          label: viewnm,
          key: r => link(`/view/${viewnm}?${fld}=${r.id}`, viewnm)
        };
      case "ParentShow":
        const [pviewnm, ptbl, pfld] = vrest.split(".");
        //console.log([pviewnm, ptbl, pfld])
        return {
          label: pviewnm,
          key: r =>
            r[pfld] ? link(`/view/${pviewnm}?id=${r[pfld]}`, pviewnm) : ""
        };
      default:
        throw new Error(column.view);
    }
  }
);

const asyncMap = async (xs, asyncF) => {
  var res = [];
  var ix = 0;
  for (const x of xs) {
    res.push(await asyncF(x, ix));
    ix += 1;
  }
  return res;
};

const get_viewable_fields = contract(
  is.fun(
    [
      is.str,
      is.class("Table"),
      is.array(is.class("Field")),
      is.array(is_column),
      is.bool,
      is.str
    ],
    is.promise(
      is.array(
        is.obj({
          key: is.or(is.fun(is.obj(), is.str), is.str, is.undefined),
          label: is.str
        })
      )
    )
  ),
  async (viewname, table, fields, columns, isShow, csrfToken) =>
    (
      await asyncMap(columns, async column => {
        if (column.type === "Action")
          return {
            label: column.action_name,
            key: r =>
              post_btn(
                action_url(viewname, table, column, r),
                column.action_name,
                csrfToken
              )
          };
        else if (column.type === "ViewLink") {
          return await view_linker(column, fields);
        } else if (column.type === "JoinField") {
          const [refNm, targetNm] = column.join_field.split(".");
          return {
            label: text(targetNm),
            key: text(targetNm)
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
            label: text(column.stat + " " + table),
            key: text(targetNm)
            // sortlink: `javascript:sortby('${text(targetNm)}')`
          };
        } else if (column.type === "Field") {
          const f = fields.find(fld => fld.name === column.field_name);

          return (
            f && {
              label: text(f.label),
              key:
                column.fieldview && f.type === "File"
                  ? row =>
                      row[f.name] &&
                      getState().fileviews[column.fieldview].run(
                        row[f.name],
                        row[`${f.name}__filename`]
                      )
                  : column.fieldview && f.type.fieldviews[column.fieldview]
                  ? row =>
                      f.type.fieldviews[column.fieldview].run(
                        row[f.name],
                        row[`${f.name}__filename`]
                      )
                  : isShow
                  ? f.type.showAs
                    ? row => f.type.showAs(row[f.name])
                    : row => text(row[f.name])
                  : f.listKey,
              sortlink: `javascript:sortby('${text(f.name)}')`
            }
          );
        }
      })
    ).filter(v => !!v)
);

const stateToQueryString = contract(
  is.fun(is.maybe(is.obj()), is.str),
  state => {
    if (!state || Object.keys(state).length === 0) return "";

    return (
      "?" +
      Object.entries(state)
        .map(([k, v]) =>
          k === "id"
            ? null
            : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
        )
        .filter(s => !!s)
        .join("&")
    );
  }
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
      const field = fields.find(f => f.name === k);
      if (k === "id") uniques[k] = v;
      else if (field && field.is_unique && fuzzyStrings && field.type && field.type.name==='String') uniques[k] = {ilike: v};
      else if (field && field.is_unique) uniques[k] = v;
      else nonUniques[k] = v;
    });
    return { uniques, nonUniques };
  }
);

module.exports = {
  get_viewable_fields,
  action_url,
  stateToQueryString,
  asyncMap,
  view_linker,
  splitUniques
};
