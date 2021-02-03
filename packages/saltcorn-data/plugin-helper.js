const View = require("./models/view");
const Field = require("./models/field");
const Table = require("./models/table");
const { getState } = require("./db/state");
const db = require("./db");
const { contract, is } = require("contractis");
const { fieldlike, is_table_query, is_column } = require("./contracts");
const { link } = require("@saltcorn/markup");
const { button, a, label, text } = require("@saltcorn/markup/tags");
const { applyAsync } = require("./utils");
const { jsexprToSQL } = require("./models/expression");

const link_view = (url, label, popup, link_style = "", link_size = "") => {
  if (popup) {
    return button(
      {
        class: "btn btn-secondary btn-sm",
        onClick: `ajax_modal('${url}')`,
      },
      label
    );
  } else
    return a(
      {
        href: url,
        ...(link_style || link_size
          ? { class: `${link_style} ${link_size}` }
          : {}),
      },
      text(label)
    );
};

const stateToQueryString = contract(
  is.fun(is.maybe(is.obj()), is.str),
  (state) => {
    if (!state || Object.keys(state).length === 0) return "";

    return (
      "?" +
      Object.entries(state)
        .map(([k, v]) =>
          k === "id"
            ? null
            : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
        )
        .filter((s) => !!s)
        .join("&")
    );
  }
);

const calcfldViewOptions = contract(
  is.fun([is.array(is.class("Field")), is.bool], is.objVals(is.array(is.str))),
  (fields, isEdit) => {
    var fvs = {};
    fields.forEach((f) => {
      if (f.type === "File") {
        if (!isEdit) fvs[f.name] = Object.keys(getState().fileviews);
        else fvs[f.name] = ["upload"];
      } else if (f.type === "Key") {
        fvs[f.name] = ["select", ...Object.keys(getState().keyFieldviews)];
      } else if (f.type && f.type.fieldviews) {
        const tfvs = Object.entries(f.type.fieldviews).filter(([k, fv]) =>
          f.calculated ? !fv.isEdit : !fv.isEdit === !isEdit
        );
        fvs[f.name] = tfvs.map(([k, fv]) => k);
      }
    });
    return fvs;
  }
);
const calcfldViewConfig = contract(
  is.fun([is.array(is.class("Field")), is.bool], is.promise(is.obj())),
  async (fields, isEdit) => {
    const fieldViewConfigForms = {};
    for (const f of fields) {
      fieldViewConfigForms[f.name] = {};
      const fieldviews =
        f.type === "Key" ? getState().keyFieldviews : f.type.fieldviews || {};
      for (const [nm, fv] of Object.entries(fieldviews)) {
        if (fv.configFields)
          fieldViewConfigForms[f.name][nm] = await applyAsync(
            fv.configFields,
            f
          );
      }
    }
    return fieldViewConfigForms;
  }
);

const get_link_view_opts = contract(
  is.fun(
    [is.class("Table"), is.str],
    is.promise(is.array(is.obj({ label: is.str, name: is.str })))
  ),
  async (table, viewname) => {
    const own_link_views = await View.find_possible_links_to_table(table.id);
    const link_view_opts = own_link_views
      .filter((v) => v.name !== viewname)
      .map((v) => ({
        label: v.name,
        name: `Own:${v.name}`,
      }));
    const child_views = await get_child_views(table, viewname);
    for (const { relation, related_table, views } of child_views) {
      for (const view of views) {
        link_view_opts.push({
          name: `ChildList:${view.name}.${related_table.name}.${relation.name}`,
          label: `${view.name} of ${relation.label} on ${related_table.name}`,
        });
      }
    }

    const parent_views = await get_parent_views(table, viewname);
    for (const { relation, related_table, views } of parent_views) {
      for (const view of views) {
        link_view_opts.push({
          name: `ParentShow:${view.name}.${related_table.name}.${relation.name}`,
          label: `${view.name} of ${relation.name} on ${related_table.name}`,
        });
      }
    }
    return link_view_opts;
  }
);

const getActionConfigFields = async (action, table) =>
  typeof action.configFields === "function"
    ? await action.configFields({ table })
    : action.configFields || [];

const field_picker_fields = contract(
  is.fun(
    is.obj({ table: is.class("Table"), viewname: is.str }),
    is.promise(is.array(fieldlike))
  ),
  async ({ table, viewname, req }) => {
    const __ = (...s) => (req ? req.__(...s) : s.join(""));
    const fields = await table.getFields();
    fields.push(new Field({ name: "id", label: "id", type: "Integer" }));

    const boolfields = fields.filter((f) => f.type && f.type.name === "Bool");

    const stateActions = getState().actions;

    const actions = [
      "Delete",
      ...boolfields.map((f) => `Toggle ${f.name}`),
      ...Object.keys(stateActions),
    ];

    const actionConfigFields = [];
    for (const [name, action] of Object.entries(stateActions)) {
      const cfgFields = await getActionConfigFields(action, table);

      for (const field of cfgFields) {
        actionConfigFields.push({
          ...field,
          showIf: {
            action_name: name,
            type: "Action",
            ...(field.showIf || {}),
          },
        });
      }
    }
    const fldOptions = fields.map((f) => f.name);
    const fldViewOptions = calcfldViewOptions(fields, false);

    const link_view_opts = await get_link_view_opts(table, viewname);

    const { parent_field_list } = await table.get_parent_relations(true);
    const {
      child_field_list,
      child_relations,
    } = await table.get_child_relations();
    const aggStatOptions = {};
    const agg_field_opts = child_relations.map(({ table, key_field }) => {
      aggStatOptions[`${table.name}.${key_field.name}`] = [
        "Count",
        "Avg",
        "Sum",
        "Max",
        "Min",
      ];
      table.fields.forEach((f) => {
        if (f.type && f.type.name === "Date") {
          aggStatOptions[`${table.name}.${key_field.name}`].push(
            `Latest ${f.name}`
          );
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
            .map((f) => f.name)
            .join(),
        },
        showIf: {
          agg_relation: `${table.name}.${key_field.name}`,
          type: "Aggregation",
        },
      };
    });
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
          ],
        },
      },
      {
        name: "field_name",
        label: __("Field"),
        type: "String",
        required: true,
        attributes: {
          options: fldOptions.join(),
        },
        showIf: { type: "Field" },
      },
      {
        name: "fieldview",
        label: __("Field view"),
        type: "String",
        required: false,
        attributes: {
          calcOptions: ["field_name", fldViewOptions],
        },
        showIf: { type: "Field" },
      },
      {
        name: "action_name",
        label: __("Action"),
        type: "String",
        required: true,
        attributes: {
          options: actions.join(),
        },
        showIf: { type: "Action" },
      },
      {
        name: "action_label",
        label: __("Action Label"),
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
          options: [
            { name: "btn-primary", label: "Primary button" },
            { name: "btn-secondary", label: "Secondary button" },
            { name: "btn-success", label: "Success button" },
            { name: "btn-danger", label: "Danger button" },
            { name: "btn-outline-primary", label: "Primary outline button" },
            {
              name: "btn-outline-secondary",
              label: "Secondary outline button",
            },
            { name: "btn-link", label: "Link" },
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
            { name: "", label: "Standard" },
            { name: "btn-lg", label: "Large" },
            { name: "btn-sm", label: "Small" },
            { name: "btn-block", label: "Block" },
            { name: "btn-block btn-lg", label: "Large block" },
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
        name: "view",
        label: __("View"),
        type: "String",
        required: true,
        attributes: {
          options: link_view_opts,
        },
        showIf: { type: "ViewLink" },
      },
      {
        name: "view_label",
        label: __("View label"),
        sublabel: __("Leave blank for default label."),
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
        name: "in_modal",
        label: __("Open in popup modal?"),
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
          options: [
            { name: "", label: "Link" },
            { name: "btn btn-primary", label: "Primary button" },
            { name: "btn btn-secondary", label: "Secondary button" },
            { name: "btn btn-success", label: "Success button" },
            { name: "btn btn-danger", label: "Danger button" },
            {
              name: "btn btn-outline-primary",
              label: "Primary outline button",
            },
            {
              name: "btn btn-outline-secondary",
              label: "Secondary outline button",
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
            { name: "", label: "Standard" },
            { name: "btn-lg", label: "Large" },
            { name: "btn-sm", label: "Small" },
            { name: "btn-block", label: "Block" },
            { name: "btn-block btn-lg", label: "Large block" },
          ],
        },
        showIf: { type: "ViewLink" },
      },
      {
        name: "link_text",
        label: __("Link text"),
        type: "String",
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
        name: "link_target_blank",
        label: __("Open in new tab"),
        type: "Bool",
        required: false,
        showIf: { type: "Link" },
      },
      {
        name: "join_field",
        label: __("Join Field"),
        type: "String",
        required: true,
        attributes: {
          options: parent_field_list.join(),
        },
        showIf: { type: "JoinField" },
      },
      {
        name: "agg_relation",
        label: __("Relation"),
        type: "String",
        required: true,
        attributes: {
          options: child_field_list.join(),
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
      {
        name: "aggwhere",
        label: __("Where"),
        sublabel: __("Formula"),
        type: "String",
        required: false,
        showIf: { type: "Aggregation" },
      },
      {
        name: "state_field",
        label: __("In search form"),
        type: "Bool",
        showIf: { type: "Field" },
      },
      {
        name: "header_label",
        label: __("Header label"),
        type: "String",
      },
    ];
  }
);

const get_child_views = contract(
  is.fun(
    [is.class("Table"), is.str],
    is.promise(
      is.array(
        is.obj({
          relation: is.class("Field"),
          related_table: is.class("Table"),
          views: is.array(is.class("View")),
        })
      )
    )
  ),
  async (table, viewname) => {
    const rels = await Field.find({ reftable_name: table.name });
    var child_views = [];
    for (const relation of rels) {
      const related_table = await Table.findOne({ id: relation.table_id });
      const views = await View.find_table_views_where(
        relation.table_id,
        ({ state_fields, viewrow }) =>
          viewrow.name !== viewname && state_fields.every((sf) => !sf.required)
      );
      child_views.push({ relation, related_table, views });
    }
    return child_views;
  }
);

const get_parent_views = contract(
  is.fun(
    [is.class("Table"), is.str],
    is.promise(
      is.array(
        is.obj({
          relation: is.class("Field"),
          related_table: is.class("Table"),
          views: is.array(is.class("View")),
        })
      )
    )
  ),
  async (table, viewname) => {
    var parent_views = [];
    const parentrels = (await table.getFields()).filter(
      (f) => f.is_fkey && f.type !== "File"
    );
    for (const relation of parentrels) {
      const related_table = await Table.findOne({
        name: relation.reftable_name,
      });
      const views = await View.find_table_views_where(
        related_table.id,
        ({ state_fields, viewrow }) =>
          viewrow.name !== viewname &&
          state_fields.some((sf) => sf.name === "id")
      );

      parent_views.push({ relation, related_table, views });
    }
    return parent_views;
  }
);

const picked_fields_to_query = contract(
  is.fun([is.array(is_column), is.array(is.class("Field"))], is_table_query),
  (columns, fields) => {
    var joinFields = {};
    var aggregations = {};
    (columns || []).forEach((column) => {
      if (column.type === "JoinField") {
        const kpath = column.join_field.split(".");
        if (kpath.length === 2) {
          const [refNm, targetNm] = kpath;
          joinFields[`${refNm}_${targetNm}`] = { ref: refNm, target: targetNm };
        } else {
          const [refNm, through, targetNm] = kpath;
          joinFields[`${refNm}_${through}_${targetNm}`] = {
            ref: refNm,
            target: targetNm,
            through,
          };
        }
      }
      if (column.type === "ViewLink") {
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
        //console.log(column)
        if (column.agg_relation && column.agg_relation.split) {
          const [table, fld] = column.agg_relation.split(".");
          const field = column.agg_field;
          const targetNm = (
            column.stat.replace(" ", "") +
            "_" +
            table +
            "_" +
            fld +
            db.sqlsanitize(column.aggwhere || "")
          ).toLowerCase();
          aggregations[targetNm] = {
            table,
            ref: fld,
            where: jsexprToSQL(column.aggwhere),
            field,
            aggregate: column.stat,
          };
        }
      }
    });

    return { joinFields, aggregations };
  }
);

const stateFieldsToQuery = contract(
  is.fun(is.obj(), is.obj()),
  ({ state, fields, prefix = "" }) => {
    let q = {};
    const stateKeys = Object.keys(state);
    if (state._sortby) {
      const field = fields.find((f) => f.name === state._sortby);
      if (field) q.orderBy = state._sortby;
      if (state._sortdesc) q.orderDesc = true;
    }
    if (state._pagesize) q.limit = parseInt(state._pagesize);
    if (state._pagesize && state._page)
      q.offset = (parseInt(state._page) - 1) * parseInt(state._pagesize);
    const latNear = stateKeys.find((k) => k.startsWith("_near_lat_"));
    const longNear = stateKeys.find((k) => k.startsWith("_near_long_"));
    if (latNear && longNear) {
      const latfield = db.sqlsanitize(latNear.replace("_near_lat_", ""));
      const longfield = db.sqlsanitize(longNear.replace("_near_long_", ""));
      const lat = parseFloat(state[latNear]);
      const long = parseFloat(state[longNear]);
      const cos_lat_2 = Math.pow(Math.cos((lat * Math.PI) / 180), 2);
      q.orderBy = {
        sql: `((${prefix}${latfield} - ${lat})*(${prefix}${latfield} - ${lat})) + ((${prefix}${longfield} - ${long})*(${prefix}${longfield} - ${long})*${cos_lat_2})`,
      };
    }
    return q;
  }
);
const addOrCreateList = (container, key, x) => {
  if (container[key]) container[key].push(x);
  else container[key] = [x];
};
const stateFieldsToWhere = contract(
  is.fun(
    is.obj({
      fields: is.array(is.class("Field")),
      approximate: is.maybe(is.bool),
    }),
    is.obj()
  ),
  ({ fields, state, approximate = true }) => {
    var qstate = {};
    Object.entries(state).forEach(([k, v]) => {
      if (k === "_fts") {
        qstate[k] = { searchTerm: v.replace(/\0/g, ""), fields };
        return;
      }
      const field = fields.find((fld) => fld.name == k);
      if (k.startsWith("_fromdate_")) {
        const datefield = db.sqlsanitize(k.replace("_fromdate_", ""));
        addOrCreateList(qstate, datefield, { gt: new Date(v), equal: true });
      } else if (k.startsWith("_todate_")) {
        const datefield = db.sqlsanitize(k.replace("_todate_", ""));
        addOrCreateList(qstate, datefield, { lt: new Date(v), equal: true });
      } else if (
        field &&
        field.type.name === "String" &&
        !(field.attributes && field.attributes.options) &&
        approximate
      ) {
        qstate[k] = { ilike: v };
      } else if (field && field.type.name === "Bool" && state[k] === "?") {
        // omit
      } else if (k === "id") qstate[k] = strictParseInt(v);
      else if (field && field.type && field.type.read)
        qstate[k] = field.type.read(v);
      else if (field) qstate[k] = v;
      else if (k.includes(".")) {
        const kpath = k.split(".");
        if (kpath.length === 3) {
          const [jtNm, jFieldNm, lblField] = kpath;
          qstate.id = [
            ...(qstate.id || []),
            {
              // where id in (select jFieldNm from jtnm where lblField=v)
              inSelect: {
                table: `${db.getTenantSchemaPrefix()}"${db.sqlsanitize(jtNm)}"`,
                field: db.sqlsanitize(jFieldNm),
                where: { [db.sqlsanitize(lblField)]: v },
              },
            },
          ];
        }
      }
    });
    return qstate;
  }
);

const initial_config_all_fields = contract(
  is.fun(
    is.bool,
    is.fun(
      is.obj({ table_id: is.posint }),
      is.promise(is.obj({ columns: is.array(is.obj()), layout: is.obj() }))
    )
  ),
  (isEdit) => async ({ table_id }) => {
    const table = await Table.findOne({ id: table_id });

    const fields = (await table.getFields()).filter(
      (f) => !isEdit || !f.calculated
    );
    var cfg = { columns: [] };
    var aboves = [null];
    fields.forEach((f) => {
      const flabel = {
        above: [
          null,
          {
            type: "blank",
            block: false,
            contents: f.label,
            textStyle: "",
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
          join_field: `${f.name}.${f.attributes.summary_field}`,
        });
        aboves.push({
          widths: [2, 10],
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
        const fvNm = f.type.fieldviews
          ? Object.entries(f.type.fieldviews).find(
              ([nm, fv]) => fv.isEdit === isEdit
            )[0]
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
          state_field: true,
        });
        aboves.push({
          widths: [2, 10],
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
      aboves.push({ type: "line_break" });
    });
    if (isEdit)
      aboves.push({
        type: "action",
        block: false,
        minRole: 10,
        action_name: "Save",
      });
    cfg.layout = { above: aboves };
    return cfg;
  }
);

const strictParseInt = (x) => {
  const y = +x;
  return !isNaN(y) && y ? y : undefined;
};

const readState = (state, fields) => {
  fields.forEach((f) => {
    const current = state[f.name];
    if (typeof current !== "undefined") {
      if (f.type.read) state[f.name] = f.type.read(current);
      else if (f.type === "Key" || f.type === "File")
        state[f.name] =
          current === "null" || current === "" || current === null
            ? null
            : strictParseInt(current);
    }
  });
  if (typeof state.id !== "undefined") state.id = strictParseInt(state.id);
  return state;
};

const readStateStrict = (state, fields) => {
  let hasErrors = false;
  fields.forEach((f) => {
    const current = state[f.name];
    //console.log(f.name, current, typeof current);

    if (typeof current !== "undefined") {
      if (f.type.read) {
        const readval = f.type.read(current);
        if (typeof readval === "undefined") {
          if (current === "" && !f.required) delete state[f.name];
          else hasErrors = true;
        }
        if (f.type && f.type.validate) {
          const vres = f.type.validate(f.attributes || {})(readval);
          if (vres.error) hasErrors = true;
        }
        state[f.name] = readval;
      } else if (f.type === "Key" || f.type === "File")
        state[f.name] =
          current === "null" || current === "" || current === null
            ? null
            : +current;
    } else if (f.required) hasErrors = true;
  });
  return hasErrors ? false : state;
};

module.exports = {
  field_picker_fields,
  picked_fields_to_query,
  get_child_views,
  get_parent_views,
  stateFieldsToWhere,
  stateFieldsToQuery,
  initial_config_all_fields,
  calcfldViewOptions,
  get_link_view_opts,
  is_column,
  readState,
  readStateStrict,
  stateToQueryString,
  link_view,
  getActionConfigFields,
  calcfldViewConfig,
  strictParseInt,
};
