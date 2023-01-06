/**
 * Plugin-helper
 * @category saltcorn-data
 * @module plugin-helper
 */
const View = require("./models/view");
const Field = require("./models/field");
const Table = require("./models/table");
const Trigger = require("./models/trigger");

const { getState } = require("./db/state");
const db = require("./db");
const { button, a, text, i } = require("@saltcorn/markup/tags");
const { applyAsync, InvalidConfiguration } = require("./utils");
const { jsexprToWhere, freeVariables } = require("./models/expression");
const { traverseSync } = require("./models/layout");
const { isNode } = require("./utils");
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
  url0,
  label,
  popup,
  link_style = "",
  link_size = "",
  link_icon = "",
  textStyle = "",
  link_bgcol,
  link_bordercol,
  link_textcol,
  extraClass,
  extraState,
  link_target_blank
) => {
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
    if (!link_style)
      return a(
        {
          href: `javascript:${
            isNode() ? `ajax_modal('${url}')` : `mobile_modal('${url}')`
          }`,
          style,
          class: [textStyle, link_style, link_size, extraClass],
        },
        link_icon ? i({ class: link_icon }) + "&nbsp;" : "",
        label
      );
    else
      return button(
        {
          class: [
            textStyle,
            link_style,
            link_size,
            !link_style && "btn btn-link",
            extraClass,
          ],
          type: "button",
          onClick: isNode() ? `ajax_modal('${url}')` : `mobile_modal('${url}')`,
          style,
        },
        link_icon ? i({ class: link_icon }) + "&nbsp;" : "",
        label
      );
  } else
    return a(
      {
        href: url,
        class: [textStyle, link_style, link_size, extraClass],
        style,
        target: link_target_blank ? "_blank" : undefined,
      },
      link_icon ? i({ class: link_icon }) + "&nbsp;" : "",
      text(label)
    );
};

/**
 * @function
 * @param {object} [state]
 * @returns {string}
 */
const stateToQueryString = (state) => {
  if (!state || Object.keys(state).length === 0) return "";

  return (
    "?" +
    Object.entries(state)
      .map(([k, v]) =>
        k === "id" ? null : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
      )
      .filter((s) => !!s)
      .join("&")
  );
};

/**
 * @function
 * @param {Field[]} fields
 * @param mode
 * @returns {object}
 */
const calcfldViewOptions = (fields, mode) => {
  const isEdit = mode === "edit";
  const isFilter = mode === "filter";
  let fvs = {};
  const handlesTextStyle = {};
  const blockDisplay = {};
  fields.forEach((f) => {
    handlesTextStyle[f.name] = [];
    blockDisplay[f.name] = [];
    if (f.type === "File") {
      if (!isEdit && !isFilter)
        fvs[f.name] = Object.entries(getState().fileviews)
          .filter(([k, v]) => !v.isEdit)
          .map(([k, v]) => k);
      else
        fvs[f.name] = Object.entries(getState().fileviews).map(([k, v]) => k);
    } else if (f.type === "Key") {
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

      Object.entries(getState().keyFieldviews).forEach(([k, v]) => {
        if (v && v.handlesTextStyle) handlesTextStyle[f.name].push(k);
        if (v && v.blockDisplay) blockDisplay[f.name].push(k);
      });
    } else if (f.type && f.type.fieldviews) {
      const tfvs = Object.entries(f.type.fieldviews).filter(
        ([k, fv]) =>
          (f.calculated ? !fv.isEdit : !fv.isEdit || isEdit || isFilter) &&
          !(mode !== "list" && fv.expandColumns)
      );
      let tfvs_ordered = [];
      if (isEdit) {
        tfvs_ordered = [
          ...tfvs.filter(([k, fv]) => fv.isEdit),
          ...tfvs.filter(([k, fv]) => !fv.isEdit && !fv.isFilter),
        ];
      } else if (isFilter) {
        tfvs_ordered = [
          ...tfvs.filter(([k, fv]) => fv.isFilter),
          ...tfvs.filter(([k, fv]) => fv.isEdit),
        ];
      } else tfvs_ordered = tfvs.filter(([k, fv]) => !fv.isFilter);
      fvs[f.name] = tfvs_ordered.map(([k, fv]) => {
        if (fv && fv.handlesTextStyle) handlesTextStyle[f.name].push(k);
        if (fv && fv.blockDisplay) blockDisplay[f.name].push(k);
        return k;
      });
    }
  });
  return { field_view_options: fvs, handlesTextStyle, blockDisplay };
};

/**
 * @function
 * @param {Field[]} fields
 * @param isEdit
 * @param nrecurse
 * @returns {Promise<object>}
 */
const calcfldViewConfig = async (fields, isEdit, nrecurse = 2) => {
  const fieldViewConfigForms = {};
  for (const f of fields) {
    f.fill_table();
    fieldViewConfigForms[f.name] = {};
    const fieldviews =
      f.type === "Key"
        ? getState().keyFieldviews
        : f.type === "File"
        ? getState().fileviews
        : (f.type && f.type.fieldviews) || {};
    for (const [nm, fv] of Object.entries(fieldviews)) {
      if (fv.configFields)
        fieldViewConfigForms[f.name][nm] = await applyAsync(fv.configFields, f);
    }
    if (f.type === "Key") {
      if (f.reftable_name && nrecurse > 0) {
        const reftable = Table.findOne({ name: f.reftable_name });
        if (reftable && reftable.fields) {
          const joinedCfg = await calcfldViewConfig(
            reftable.fields,
            isEdit,
            nrecurse - 1
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
 * @function
 * @param {Table|object} table
 * @param {string} viewname
 * @returns {Promise<{link_view_opts: object[]}>}
 */
const get_link_view_opts = async (table, viewname, accept = () => true) => {
  const own_link_views = await View.find_possible_links_to_table(table);
  const all_views = await View.find({});
  const all_tables = await Table.find({});
  const table_id_to_name = {};
  all_tables.forEach((t) => {
    table_id_to_name[t.id] = t.name;
  });
  const view_name_opts = all_views.filter(accept).map((v) => ({
    label: `${v.name} [${v.viewtemplate} ${
      table_id_to_name[v.table_id] || ""
    }]`,
    name: v.name,
  }));
  const view_relation_opts = {};
  const link_view_opts = [];
  const push_view_option = ({ name, label, view, relation }) => {
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
  const link_view_opts_push = (o) => {
    if (!link_view_opts.map((v) => v.name).includes(o.name))
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
        link_view_opts_push({
          view: view.name,
          name: `ChildList:${view.name}.${throughTable.name}.${through.name}.${related_table.name}.${relation.name}`,
          label: `${view.name} [${view.viewtemplate} ${related_table.name}.${relation.name}.${through.name}]`,
          relation: `${related_table.name}.${relation.name}.${through.name}`,
        });
      } else {
        link_view_opts_push({
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
      link_view_opts_push({
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
      link_view_opts_push({
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
    link_view_opts_push({
      view: view.name,
      label: `${view.name} [${view.viewtemplate}]`,
      name: `Independent:${view.name}`,
      relation: "None",
    });
  });
  return { link_view_opts, view_name_opts, view_relation_opts };
};

/**
 * Get Action configuration fields
 * @param {object} action
 * @param {object} table
 * @returns {Promise<object[]>}
 */
const getActionConfigFields = async (action, table) =>
  typeof action.configFields === "function"
    ? await action.configFields({ table })
    : action.configFields || [];

/**
 * @function
 * @param {Table|object} table
 * @param {string} viewname
 * @param {object} req
 * @returns {Promise<object[]>}
 */
const field_picker_fields = async ({ table, viewname, req }) => {
  const __ = (...s) => (req ? req.__(...s) : s.join(""));
  const fields = await table.getFields();
  for (const field of fields) {
    if (field.type === "Key") {
      field.reftable = await Table.findOne({ name: field.reftable_name });
      if (field.reftable) await field.reftable.getFields();
    }
  }
  const boolfields = fields.filter((f) => f.type && f.type.name === "Bool");

  const stateActions = getState().actions;
  const stateActionKeys = Object.entries(stateActions)
    .filter(([k, v]) => !v.disableInList)
    .map(([k, v]) => k);

  const actions = [
    "Delete",
    ...boolfields.map((f) => `Toggle ${f.name}`),
    ...stateActionKeys,
  ];
  const triggers = Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  });
  triggers.forEach((tr) => {
    actions.push(tr.name);
  });
  const actionConfigFields = [];
  for (const [name, action] of Object.entries(stateActions)) {
    if (!stateActionKeys.includes(name)) continue;
    const cfgFields = await getActionConfigFields(action, table);

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
  const fldOptions = fields.map((f) => f.name);
  const { field_view_options } = calcfldViewOptions(fields, "list");
  const fieldViewConfigForms = await calcfldViewConfig(fields, false);
  const fvConfigFields = [];
  for (const [field_name, fvOptFields] of Object.entries(
    fieldViewConfigForms
  )) {
    for (const [fieldview, formFields] of Object.entries(fvOptFields)) {
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
  const { link_view_opts, view_name_opts, view_relation_opts } =
    await get_link_view_opts(table, viewname);
  const { parent_field_list } = await table.get_parent_relations(true, true);
  const { child_field_list, child_relations } = await table.get_child_relations(
    true
  );
  const aggStatOptions = {};
  const agg_fieldviews = [];
  Object.values(getState().types).forEach((t) => {
    const fvnames = Object.entries(t.fieldviews)
      .filter(([k, v]) => !v.isEdit && !v.isFilter)
      .map(([k, v]) => k);
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
      label: "Format",
      type: "String",
      sublabel: "moment.js format specifier",
      showIf: {
        type: "Aggregation",
        "agg_field|_@_1": "Date",
        agg_fieldview: "format",
      },
    },
  ];

  const agg_field_opts = child_relations.map(
    ({ table, key_field, through }) => {
      const aggKey =
        (through ? `${through.name}->` : "") +
        `${table.name}.${key_field.name}`;
      aggStatOptions[aggKey] = [
        "Count",
        "Avg",
        "Sum",
        "Max",
        "Min",
        "Array_Agg",
      ];
      table.fields.forEach((f) => {
        if (f.type && f.type.name === "Date") {
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
            .map((f) => ({ label: f.name, name: `${f.name}@${f.type_name}` })),
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
      class: "validate-expression",
      showIf: { type: "FormulaValue" },
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
    {
      name: "fieldview",
      label: __("Field view"),
      type: "String",
      required: false,
      attributes: {
        calcOptions: ["field_name", field_view_options],
      },
      showIf: { type: "Field" },
    },
    {
      name: "join_field",
      label: __("Join Field"),
      type: "String",
      required: true,
      attributes: {
        options: parent_field_list,
      },
      showIf: { type: "JoinField" },
    },
    {
      name: "join_fieldview",
      label: __("Field view"),
      type: "String",
      required: false,
      attributes: {
        calcOptions: ["join_field", field_view_options],
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
          { name: "btn-sm btn-xs", label: "X-Small" },
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
          { name: "btn-sm btn-xs", label: "X-Small" },
          { name: "btn-block", label: "Block" },
          { name: "btn-block btn-lg", label: "Large block" },
        ],
      },
      showIf: { type: "ViewLink" },
    },
    {
      name: "extra_state_fml",
      label: __("Extra state Formula"),
      sublabel:
        "Formula for JavaScript object that will be added to state parameters",
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
      fieldview: "radio_group",
      attributes: {
        inline: true,
        options: ["px", "%", "vw", "em", "rem"],
      },
    },
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
const get_child_views = async (table, viewname, nrecurse = 2) => {
  const rels = await Field.find({ reftable_name: table.name });
  const possibleThroughTables = new Set();
  let child_views = [];
  for (const relation of rels) {
    const related_table = Table.findOne({ id: relation.table_id });
    const views = await View.find_table_views_where(
      related_table.id,
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
const get_parent_views = async (table, viewname) => {
  let parent_views = [];
  const parentrels = (await table.getFields()).filter(
    (f) => f.is_fkey && f.type !== "File"
  );
  for (const relation of parentrels) {
    const related_table = await Table.findOne({
      name: relation.reftable_name,
    });
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
const get_onetoone_views = async (table, viewname) => {
  const rels = await Field.find({
    reftable_name: table.name,
    is_unique: true,
  });
  let child_views = [];
  for (const relation of rels) {
    const related_table = await Table.findOne({ id: relation.table_id });
    const views = await View.find_table_views_where(
      related_table.id,
      ({ state_fields, viewrow }) =>
        viewrow.name !== viewname && state_fields.some((sf) => sf.name === "id")
    );
    child_views.push({ relation, related_table, views });
  }
  return child_views;
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
const picked_fields_to_query = (columns, fields, layout) => {
  let joinFields = {};
  let aggregations = {};
  let freeVars = new Set(); // for join fields

  (columns || []).forEach((column) => {
    if (column.type === "JoinField") {
      if (column.join_field && column.join_field.split) {
        if (column.join_field.includes("->")) {
          const [relation, target] = column.join_field.split("->");
          const [ontable, ref] = relation.split(".");
          joinFields[`${ref}_${ontable}_${target}`] = {
            ref,
            target,
            ontable,
          };
        } else {
          const kpath = column.join_field.split(".");
          if (kpath.length === 2) {
            const [refNm, targetNm] = kpath;
            joinFields[`${refNm}_${targetNm}`] = {
              ref: refNm,
              target: targetNm,
            };
          } else if (kpath.length === 3) {
            const [refNm, through, targetNm] = kpath;
            joinFields[`${refNm}_${through}_${targetNm}`] = {
              ref: refNm,
              target: targetNm,
              through,
            };
          } else if (kpath.length === 4) {
            const [refNm, through1, through2, targetNm] = kpath;
            joinFields[`${refNm}_${through1}_${through2}_${targetNm}`] = {
              ref: refNm,
              target: targetNm,
              through: [through1, through2],
            };
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
      if (column.view_label_formula)
        freeVars = new Set([...freeVars, ...freeVariables(column.view_label)]);
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
          where: column.aggwhere ? jsexprToWhere(column.aggwhere) : undefined,
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
      },
      blank(v) {
        if (v?.isFormula?.text && typeof v.contents === "string")
          freeVars = new Set([...freeVars, ...freeVariables(v.contents)]);
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
      },
    });
  }
  add_free_variables_to_joinfields(freeVars, joinFields, fields);
  return { joinFields, aggregations };
};
/**
 * Add free variables to join fields
 * @param freeVars
 * @param joinFields
 * @param fields
 */
const add_free_variables_to_joinfields = (freeVars, joinFields, fields) => {
  const joinFieldNames = new Set(
    fields.filter((f) => f.is_fkey).map((f) => f.name)
  );
  [...freeVars]
    .filter((v) => v.includes("."))
    .forEach((v) => {
      const kpath = v.split(".");
      if (joinFieldNames.has(kpath[0]))
        if (kpath.length === 2) {
          const [refNm, targetNm] = kpath;
          joinFields[`${refNm}_${targetNm}`] = {
            ref: refNm,
            target: targetNm,
            rename_object: [refNm, targetNm],
          };
        } else if (kpath.length === 3) {
          const [refNm, through, targetNm] = kpath;
          joinFields[`${refNm}_${through}_${targetNm}`] = {
            ref: refNm,
            target: targetNm,
            through,
            rename_object: [refNm, through, targetNm],
          };
        } else if (kpath.length === 4) {
          const [refNm, through1, through2, targetNm] = kpath;
          joinFields[`${refNm}_${through1}_${through2}_${targetNm}`] = {
            ref: refNm,
            target: targetNm,
            through: [through1, through2],
            rename_object: [refNm, through1, through2, targetNm],
          };
        }
    });
};

/**
 * State fields to Query
 * @function
 * @param {object}
 * @returns {object}
 */
const stateFieldsToQuery = ({ state, stateHash, fields, prefix = "" }) => {
  let q = {};
  const stateKeys = Object.keys(state);
  const sortbyName = `_${stateHash}_sortby`;
  const sortDescName = `_${stateHash}_sortdesc`;
  if (state[sortbyName]) {
    const field = fields.find((f) => f.name === state[sortbyName]);
    //this is ok because it has to match fieldname
    if (field) q.orderBy = state[sortbyName];
    if (state[sortDescName]) q.orderDesc = true;
  }
  const pagesize =
    stateHash && state[`_${stateHash}_pagesize`]
      ? parseInt(state[`_${stateHash}_pagesize`])
      : undefined;
  if (pagesize) {
    q.limit = parseInt(pagesize);
    const page =
      stateHash && state[`_${stateHash}_page`]
        ? parseInt(state[`_${stateHash}_page`])
        : undefined;
    if (page) {
      q.offset = (page - 1) * pagesize;
    }
  }
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
const addOrCreateList = (container, key, x) => {
  if (container[key]) container[key].push(x);
  else container[key] = [x];
};

/**
 * @function
 * @param {object} opts
 * @param {Field[]} opts.fields
 * @param {object} opts.state missing in contract
 * @param {boolean} [opts.approximate = true]
 * @param {Table} opts.table
 * @returns {object}
 */
const stateFieldsToWhere = ({ fields, state, approximate = true, table }) => {
  let qstate = {};
  Object.entries(state || {}).forEach(([k, v]) => {
    if (k === "_fts" || (table?.name && k === `_fts_${table.name}`)) {
      qstate["_fts"] = {
        searchTerm: v.replace(/\0/g, ""),
        fields,
        schema: db.getTenantSchema(),
      };
      return;
    }

    const field = fields.find((fld) => fld.name === k);
    if (k.startsWith("_fromdate_")) {
      const datefield = db.sqlsanitize(k.replace("_fromdate_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield)
        addOrCreateList(qstate, datefield, { gt: new Date(v), equal: true });
    } else if (k.startsWith("_todate_")) {
      const datefield = db.sqlsanitize(k.replace("_todate_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield)
        addOrCreateList(qstate, datefield, { lt: new Date(v), equal: true });
    } else if (k.startsWith("_gte_")) {
      const datefield = db.sqlsanitize(k.replace("_gte_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield) addOrCreateList(qstate, datefield, { gt: v, equal: true });
    } else if (k.startsWith("_lte_")) {
      const datefield = db.sqlsanitize(k.replace("_lte_", ""));
      const dfield = fields.find((fld) => fld.name === datefield);
      if (dfield) addOrCreateList(qstate, datefield, { lt: v, equal: true });
    } else if (field && field.type.name === "String" && v && v.slugify) {
      qstate[k] = v;
    } else if (
      field &&
      field.type.name === "String" &&
      !(field.attributes && field.attributes.options) &&
      approximate
    ) {
      qstate[k] = { ilike: v };
    } else if (field && field.type.name === "Bool" && state[k] === "?") {
      // omit
    } else if (typeof v === "object" && v && field?.type?.name === "JSON") {
      let json = {};
      if (Object.values(v).length === 1 && Object.values(v)[0] === "") return;
      Object.entries(v).forEach(([kj, vj]) => {
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

          if (field.attributes?.hasSchema) {
            const s = field.attributes.schema.find(
              (f) => f.key === Object.keys(v)[0]
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
    } else if (field && field.type && field.type.read)
      qstate[k] = Array.isArray(v)
        ? { or: v.map(field.type.read) }
        : field.type.read(v);
    else if (field) qstate[k] = v;
    else if (k.includes("->")) {
      // jFieldNm.jtnm->lblField
      // where jFieldNm in (select id from jtnm where lblField=v)
      const [jFieldNm, krest] = k.split(".");
      const [jtNm, lblField] = krest.split("->");
      let where = { [db.sqlsanitize(lblField)]: v };
      const jTable = Table.findOne({ name: jtNm });
      const lblFld = (jTable.fields || []).find((f) => f.name === lblField);
      if (
        lblFld &&
        lblFld.type?.name === "String" &&
        !lblFld.attributes?.options
      )
        where = { [db.sqlsanitize(lblField)]: { ilike: v } };

      qstate[jFieldNm] = [
        ...(qstate[jFieldNm] ? [qstate[jFieldNm]] : []),
        {
          // where jFieldNm in (select id from jtnm where lblField=v)
          inSelect: {
            table: `${db.getTenantSchemaPrefix()}"${db.sqlsanitize(jtNm)}"`,
            field: "id",
            where,
          },
        },
      ];
    } else if (k.includes(".")) {
      const kpath = k.split(".");
      if (kpath.length === 3) {
        const [jtNm, jFieldNm, lblField] = kpath;
        qstate.id = [
          ...(qstate.id ? [qstate.id] : []),
          {
            // where id in (select jFieldNm from jtnm where lblField=v)
            inSelect: {
              table: `${db.getTenantSchemaPrefix()}"${db.sqlsanitize(jtNm)}"`,
              field: db.sqlsanitize(jFieldNm),
              where: { [db.sqlsanitize(lblField)]: v },
            },
          },
        ];
      } else if (kpath.length === 4) {
        const [jtNm, jFieldNm, tblName, lblField] = kpath;
        qstate.id = [
          ...(qstate.id ? [qstate.id] : []),
          {
            // where id in (select jFieldNm from jtnm where lblField=v)
            inSelect: {
              table: `${db.getTenantSchemaPrefix()}"${db.sqlsanitize(jtNm)}"`,
              field: db.sqlsanitize(jFieldNm),
              valField: "id",
              through: `${db.getTenantSchemaPrefix()}"${db.sqlsanitize(
                tblName
              )}"`,
              where: { [db.sqlsanitize(lblField)]: v },
            },
          },
        ];
      }
    }
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
  (isEdit) =>
  async ({ table_id, exttable_name }) => {
    const table = await Table.findOne(
      table_id ? { id: table_id } : { name: exttable_name }
    );

    const fields = (await table.getFields()).filter(
      (f) => !f.primary_key && (!isEdit || !f.calculated)
    );
    let cfg = { columns: [] };
    let aboves = [null];
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
          join_field: `${f.name}.${f.attributes.summary_field}`,
        });
        aboves.push({
          widths: [2, 10],
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
        });
        aboves.push({
          widths: [2, 10],
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
        type: "action",
        block: false,
        minRole: 10,
        action_name: "Save",
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
const strictParseInt = (x) => {
  const y = +x;
  return !isNaN(y) && y ? y : undefined;
};

/**
 * Read State
 * @param {object} state
 * @param {object[]} fields
 * @param req
 * @returns {object}
 */
const readState = (state, fields, req) => {
  fields.forEach((f) => {
    const current = state[f.name];
    if (typeof current !== "undefined") {
      if (Array.isArray(current) && f.type.read) {
        state[f.name] = current.map(f.type.read);
      } else if (current && current.slugify)
        state[f.name] = f.type.read
          ? { slugify: f.type.read(current.slugify) }
          : current;
      else if (typeof current === "object") {
        //ignore
      } else if (f.type.read) state[f.name] = f.type.read(current);
      else if (typeof current === "string" && current.startsWith("Preset:")) {
        const preset = f.presets[current.replace("Preset:", "")];
        state[f.name] = preset(req);
      } else if (f.type === "File") state[f.name] = current;
      else if (f.type === "Key")
        state[f.name] =
          current === "null" || current === "" || current === null
            ? null
            : getState().types[f.reftype].read(current);
    }
  });
  return state;
};

/**
 * Read State Strict
 * @param {object} state
 * @param {object[]} fields
 * @returns {boolean|*}
 */
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
const json_list_to_external_table = (get_json_list, fields0) => {
  const fields = fields0.map((f) =>
    f.constructor.name === Object.name ? new Field(f) : f
  );
  const getRows = async (where = {}, selopts = {}) => {
    let data_in = await get_json_list({ where, ...selopts });
    const restricts = Object.entries(where);
    const sat =
      (x) =>
      ([k, v]) => {
        if (Array.isArray(v)) return v.every((v1) => sat(x)([k, v1]));
        else if (v?.lt) return x[k] < +v.lt;
        else if (v?.gt) return x[k] > +v.gt;
        else if (v?.ilike) return (x[k] || "").includes(v.ilike);
        else return x[k] === v;
      };
    const data_filtered =
      restricts.length === 0
        ? data_in
        : data_in.filter((x) => restricts.every(sat(x)));
    if (selopts.orderBy) {
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
  const tbl = {
    getFields() {
      return fields;
    },
    getField(fnm) {
      return fields.find((f) => f.name === fnm);
    },
    fields,
    getRows,
    get min_role_read() {
      const roles = getState().getConfig("exttables_min_role_read", {});
      return roles[tbl.name] || 10;
    },
    getJoinedRows(opts = {}) {
      const { where, ...rest } = opts;
      return getRows(where || {}, rest || {});
    },
    async countRows(where) {
      let data_in = await get_json_list({ where });
      return data_in.length;
    },
    get_child_relations() {
      return { child_relations: [], child_field_list: [] };
    },
    get_parent_relations() {
      return { parent_relations: [], parent_field_list: [] };
    },
    external: true,
    owner_fieldname() {
      return null;
    },
    async distinctValues(fldNm) {
      let data_in = await get_json_list({});
      const s = new Set(data_in.map((x) => x[fldNm]));
      return [...s];
    },
  };
  return tbl;
};

/**
 * Run Action Column
 * @param {object} col
 * @param {object} req
 * @param {...*} rest
 * @returns {Promise<*>}
 */
const run_action_column = async ({ col, req, ...rest }) => {
  let state_action = getState().actions[col.action_name];
  let configuration;
  if (state_action) configuration = col.configuration;
  else {
    const trigger = await Trigger.findOne({ name: col.action_name });
    state_action = getState().actions[trigger.action];
    configuration = trigger.configuration;
  }
  return await state_action.run({
    configuration,
    user: req.user,
    req,
    ...rest,
  });
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
};
