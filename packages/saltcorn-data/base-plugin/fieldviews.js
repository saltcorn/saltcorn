/**
 * @category saltcorn-data
 * @module base-plugin/fieldviews
 * @subcategory base-plugin
 */

const View = require("../models/view");
const Table = require("../models/table");
const Field = require("../models/field");
const { eval_expression, jsexprToWhere } = require("../models/expression");
const {
  option,
  a,
  h5,
  span,
  text_attr,
  script,
  input,
} = require("@saltcorn/markup/tags");
const tags = require("@saltcorn/markup/tags");
const { select_options, radio_group } = require("@saltcorn/markup/helpers");
const { isNode, nubBy } = require("../utils");

/**
 * select namespace
 * @namespace
 * @category saltcorn-data
 */
const select = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  blockDisplay: true,

  /**
   * @type {object[]}
   */
  configFields: () => [
    {
      name: "neutral_label",
      label: "Neutral label",
      type: "String",
    },
    {
      name: "where",
      label: "Where",
      type: "String",
    },
    {
      name: "label_formula",
      label: "Label formula",
      type: "String",
      class: "validate-expression",
      sublabel: "Uses summary field if blank",
    },
    {
      name: "force_required",
      label: "Force required",
      sublabel:
        "User must select a value, even if the table field is not required",
      type: "Bool",
    },
    {
      name: "disable",
      label: "Disable",
      type: "Bool",
    },
  ],

  /**
   * @param {*} nm
   * @param {*} v
   * @param {*} attrs
   * @param {*} cls
   * @param {*} reqd
   * @param {*} field
   * @returns {object}
   */
  run: (nm, v, attrs, cls, reqd, field) => {
    if (attrs.disabled) {
      const value =
        (field.options || []).find((lv) => lv?.value === v)?.label || v;
      return (
        input({
          class: `${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          readonly: true,
          placeholder: value || field.label,
        }) + span({ class: "ml-m1" }, "v")
      );
    }
    const selOptions = select_options(
      v,
      field,
      (attrs || {}).force_required,
      (attrs || {}).neutral_label
    );
    if (attrs.disable) {
      return (
        tags.select(
          {
            class: `form-control form-select ${cls} ${field.class || ""}`,
            disabled: true,
          },
          selOptions
        ) +
        input({
          type: "hidden",
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          value: v,
        })
      );
    }
    return tags.select(
      {
        class: `form-control form-select ${cls} ${field.class || ""}`,
        "data-fieldname": field.form_name,
        name: text_attr(nm),
        id: `input${text_attr(nm)}`,
        disabled: attrs.disabled,
        readonly: attrs.readonly,
        onChange: attrs.onChange,
        ...(attrs?.dynamic_where
          ? {
              "data-selected": v,
              "data-fetch-options": encodeURIComponent(
                JSON.stringify(attrs?.dynamic_where)
              ),
            }
          : {}),
      },
      selOptions
    );
  },
};

/**
 * select namespace
 * @namespace
 * @category saltcorn-data
 */
const select_from_table = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  blockDisplay: true,

  /**
   * @type {object[]}
   */
  configFields: async (fld) => {
    //find tables with required key
    const fields = await Field.find(
      { reftable_name: fld.reftable_name },
      { cached: true }
    );
    const fldOption = fields.map(
      (f) => `${Table.findOne(f.table_id).name}.${f.name}`
    );
    return [
      {
        name: "source_field",
        label: "Source field",
        type: "String",
        required: true,
        attributes: { options: fldOption },
      },
      {
        name: "neutral_label",
        label: "Neutral label",
        type: "String",
      },
      {
        name: "where",
        label: "Where",
        type: "String",
      },
      /*{
        name: "label_formula",
        label: "Label formula",
        type: "String",
        class: "validate-expression",
        sublabel: "Uses summary field if blank",
      },*/
      {
        name: "force_required",
        label: "Force required",
        sublabel:
          "User must select a value, even if the table field is not required",
        type: "Bool",
      },
      {
        name: "disable",
        label: "Disable",
        type: "Bool",
      },
    ];
  },

  async fill_options(
    field,
    force_allow_none,
    where,
    extraCtx,
    optionsQuery,
    formFieldNames
  ) {
    const [tableNm, fieldNm] = field.attributes.source_field.split(".");
    const srcTable = Table.findOne(tableNm);
    const srcField = srcTable.getField(fieldNm);
    const rows = await Field.select_options_query(
      tableNm,
      where,
      field.attributes,
      srcField.attributes.summary_field
        ? {
            summary_field: {
              ref: fieldNm,
              target: srcField.attributes.summary_field,
            },
          }
        : {}
    );
    const get_label = field.attributes?.label_formula
      ? (r) => {
          try {
            return eval_expression(field.attributes?.label_formula, r);
          } catch (error) {
            error.message = `Error in formula ${field.attributes?.label_formula} for select label:\n${error.message}`;
            throw error;
          }
        }
      : srcField.attributes.summary_field
      ? (r) => r.summary_field
      : (r) => r[fieldNm];

    const isDynamic = (formFieldNames || []).some((nm) =>
      (field.attributes.where || "").includes("$" + nm)
    );

    /*console.log({
      where,
      tableNm,
      fieldNm,
      rows,
      refname: field.refname,
      fieldattrs: field.attributes,
    });*/
    if (isDynamic) {
      const fakeEnv = {};
      formFieldNames.forEach((nm) => {
        fakeEnv[nm] = "$" + nm;
      });
      field.attributes.dynamic_where = {
        table: tableNm,
        refname: srcField.name,
        where: field.attributes.where,
        whereParsed: jsexprToWhere(field.attributes.where, fakeEnv),
        summary_field: `${srcField.name}_${srcField.attributes.summary_field}`,
        label_formula: field.attributes.label_formula,
        dereference: srcField.name,
        nubBy: fieldNm,
        required: field.required,
      };
    }
    field.options = nubBy(fieldNm, rows).map((r) => ({
      label: get_label(r),
      value: r[fieldNm],
    }));
    if (!field.required || force_allow_none)
      field.options.unshift({ label: "", value: "" });
  },

  /**
   * @param {*} nm
   * @param {*} v
   * @param {*} attrs
   * @param {*} cls
   * @param {*} reqd
   * @param {*} field
   * @returns {object}
   */
  run: (nm, v, attrs, cls, reqd, field) => {
    if (attrs.disabled) {
      const value =
        (field.options || []).find((lv) => lv?.value === v)?.label || v;
      return (
        input({
          class: `${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          readonly: true,
          placeholder: value || field.label,
        }) + span({ class: "ml-m1" }, "v")
      );
    }
    const selOptions = select_options(
      v,
      field,
      (attrs || {}).force_required,
      (attrs || {}).neutral_label
    );
    if (attrs.disable) {
      return (
        tags.select(
          {
            class: `form-control form-select ${cls} ${field.class || ""}`,
            disabled: true,
          },
          selOptions
        ) +
        input({
          type: "hidden",
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          value: v,
        })
      );
    }
    return tags.select(
      {
        class: `form-control form-select ${cls} ${field.class || ""}`,
        "data-fieldname": field.form_name,
        name: text_attr(nm),
        id: `input${text_attr(nm)}`,
        disabled: attrs.disabled,
        readonly: attrs.readonly,
        onChange: attrs.onChange,
        ...(attrs?.dynamic_where
          ? {
              "data-selected": v,
              "data-fetch-options": encodeURIComponent(
                JSON.stringify(attrs?.dynamic_where)
              ),
            }
          : {}),
      },
      selOptions
    );
  },
};

const two_level_select = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  blockDisplay: true,

  /**
   * @type {object[]}
   */
  configFields: async ({ table, name }) => {
    if (!table) return [];
    const fields = table.getFields();
    const relOpts = [""];
    const field = fields.find((f) => f.name === name);
    if (!field) return [];

    if (field.is_fkey && field.reftable_name) {
      const relTable = Table.findOne(field.reftable_name);
      if (!relTable) return [];

      const relFields = relTable.getFields();
      relFields.forEach((relField) => {
        if (relField.is_fkey) {
          relOpts.push(relField.name);
        }
      });
    }

    return [
      {
        name: "relation",
        label: "Top level field",
        input_type: "select",
        options: relOpts,
      },
      {
        name: "neutral_label",
        label: "Neutral label",
        type: "String",
      },
      {
        name: "force_required",
        label: "Force required",
        sublabel:
          "User must select a value, even if the table field is not required",
        type: "Bool",
      },
    ];
  },

  run: (nm, v, attrs, cls, reqd, field) => {
    const options2 = {};

    Object.entries(field.options || {}).forEach(([label, { id, options }]) => {
      options2[id] = options;
      if (attrs.isFilter) options2[id].unshift({ label: "", value: "" });
    });
    const calcOptions = [`_${field.name}_toplevel`, options2];
    return (
      tags.select(
        {
          class: `form-control form-select w-50 ${cls} ${
            field.class || ""
          } d-inline`,
          "data-fieldname": `_${field.name}_toplevel`,
          id: `twolevelfirst_${text_attr(nm)}`,
          onChange: attrs.isFilter ? "apply_showif()" : undefined,
        },
        select_options_first_level(v, field, attrs || {}, attrs || {})
      ) +
      tags.select(
        {
          class: `form-control form-select w-50 ${cls} ${
            field.class || ""
          }  d-inline`,
          "data-fieldname": field.form_name,
          "data-selected": v,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          onChange: attrs.onChange,
          "data-calc-options": encodeURIComponent(JSON.stringify(calcOptions)),
        },
        option({ value: "" }, "")
      )
    );
  },
};
const select_options_first_level = (
  v,
  hdr,
  { force_required, neutral_label, isFilter }
) => {
  const os = Object.entries(hdr.options || {}).map(([label, { id, options }]) =>
    option(
      { value: id, selected: (options || []).map((o) => o.value).includes(v) },
      label
    )
  );
  if (isFilter) os.unshift(option({ value: "" }, ""));
  return os;
};

/**
 * radio_select namespace
 * @namespace
 * @category saltcorn-data
 */
const radio_select = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  /**
   * @param {*} nm
   * @param {*} v
   * @param {*} attrs
   * @param {*} cls
   * @param {*} reqd
   * @param {*} field
   * @returns {object}
   */
  run: (nm, v, attrs, cls, reqd, field) =>
    radio_group({
      class: `${cls} ${field.class || ""}`,
      name: text_attr(nm),
      options: field.options,
      value: v,
    }),
};

/**
 * select namespace
 * @namespace
 * @category saltcorn-data
 */
const search_or_create = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  blockDisplay: true,

  /**
   * @param {object} field
   * @returns {Promise<object[]>}
   */
  configFields: async (field) => {
    const reftable = Table.findOne({ name: field.reftable_name });
    if (!reftable) return [];
    const views = await View.find({ table_id: reftable.id }, { cached: true });
    return [
      {
        name: "viewname",
        label: "View to create",
        input_type: "select",
        form_name: field.form_name,
        options: views.map((v) => v.name),
      },
      {
        name: "label",
        label: "Label on link to create",
        type: "String",
      },
      {
        name: "where",
        label: "Where",
        type: "String",
      },
      {
        name: "label_formula",
        label: "Option label formula",
        type: "String",
        class: "validate-expression",
        sublabel: "Uses summary field if blank",
      },
    ];
  },

  /**
   * @param {*} nm
   * @param {*} v
   * @param {*} attrs
   * @param {*} cls
   * @param {*} reqd
   * @param {*} field
   * @returns {object}
   */
  run: (nm, v, attrs, cls, reqd, field) => {
    return (
      tags.select(
        {
          class: `form-control form-select ${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,

          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          onChange: attrs.onChange,
          ...(attrs?.dynamic_where
            ? {
                "data-selected": v,
                "data-fetch-options": encodeURIComponent(
                  JSON.stringify(attrs?.dynamic_where)
                ),
              }
            : {}),
        },
        select_options(v, field)
      ) +
      a(
        {
          href: `javascript:${
            isNode() ? "ajax_modal" : "mobile_modal"
          }('/view/${
            attrs.viewname
          }',{submitReload: false,onClose: soc_process_${nm}})`,
        },
        attrs.label || "Or create new"
      ) +
      script(`
      function soc_process_${nm}(){
        $.ajax('/api/${field.reftable_name}', {
          success: function (res, textStatus, request) {
            var opts = res.success.map(x=>'<option value="'+x.id+'">'+x.${
              attrs.summary_field
            }+'</option>').join("")
            ${reqd ? "" : `opts = '<option></option>'+opts`}
            $('#input${text_attr(
              nm
            )}').html(opts).prop('selectedIndex', res.success.length${
        reqd ? "-1" : ""
      }); 
          }
        })
      }`)
    );
  },
};

const search_join_field = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  blockDisplay: true,

  isEdit: false,
  isFilter: true,
  configFields: async (field) => {
    const reftable = Table.findOne({ name: field.reftable_name });
    if (!reftable) return [];
    const fields = reftable.getFields();
    return [
      {
        name: "joinfield",
        label: "Join field",
        type: "String",
        required: true,
        attributes: {
          options: fields.map((v) => ({
            label: v.name,
            value: `${reftable.name}->${v.name}`,
          })),
        },
      },
    ];
  },
  run: (nm, v, attrs = {}, cls, required, field, state = {}) => {
    return input({
      type: "text",
      class: ["form-control", "blur-on-enter-keypress", cls],

      disabled: attrs.disabled,
      onBlur: `set_state_field('${nm}.${encodeURIComponent(
        attrs.joinfield
      )}', this.value, this)`,
      value: text_attr(state[`${nm}.${attrs.joinfield}`] || ""),
    });
  },
};

module.exports = {
  select,
  select_from_table,
  search_or_create,
  radio_select,
  two_level_select,
  search_join_field,
};
