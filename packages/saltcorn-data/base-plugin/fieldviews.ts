/**
 * @category saltcorn-data
 * @module base-plugin/fieldviews
 * @subcategory base-plugin
 */

import View from "../models/view";
import Table from "../models/table";
import Field from "../models/field";
const {
  eval_expression,
  jsexprToWhere,
  eval_statements,
} = require("../models/expression");
const {
  option,
  a,
  h5,
  span,
  text_attr,
  script,
  input,
  domReady,
  div,
} = require("@saltcorn/markup/tags");
const tags = require("@saltcorn/markup/tags");
const { select_options, radio_group } = require("@saltcorn/markup/helpers");
const { isNode, nubBy, objectToQueryString } = require("../utils");
const { mockReqRes } = require("../tests/mocks");
import db from "../db";
import { GenObj } from "@saltcorn/types/common_types";

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
  description:
    "Select relation by a dropdown. Labels can be customised and the options restricted",
  blockDisplay: true,

  /**
   * @type {object[]}
   */
  configFields: () => [
    {
      name: "neutral_label",
      label: "Neutral label",
      type: "String",
      sublabel: "Show when no value is selected",
    },
    {
      name: "where",
      label: "Where",
      type: "String",
      help: {
        topic: "Where formula",
      },
      attributes: { placeholder: "Example: x === $x" },
      sublabel: "Limit selectable options",
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
      name: "placeholder",
      label: "Placeholder",
      type: "String",
    },
    {
      name: "disable",
      label: "Disable",
      type: "Bool",
    },
    {
      name: "readonly",
      label: "Read-only",
      type: "Bool",
    },
  ],

  run: (nm: string, v: any, attrs: GenObj, cls: string, reqd: boolean, field: GenObj) => {
    if (attrs.disabled) {
      const value =
        (field.options || []).find((lv: GenObj) => lv?.value === v)?.label ||
        v ||
        attrs.neutral_label;
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
    if (attrs.readonly) {
      const placeholder =
        (field.options || []).find((lv: GenObj) => lv?.value == v)?.label ||
        v ||
        attrs.neutral_label;
      return (
        input({
          class: `${cls} ${field.class || ""} form-control form-select`,
          readonly: true,
          value: placeholder,
          "data-readonly-select-options": encodeURIComponent(
            JSON.stringify(field.options)
          ),
        }) +
        input({
          type: "hidden",
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          value: v,
        }) +
        script(
          domReady(
            `$('input[name="${text_attr(
              nm
            )}"]').on("set_form_field", set_readonly_select)`
          )
        )
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
          select_options(
            v,
            { ...field, options: field.options.filter((o: GenObj) => o.value == v) },
            (attrs || {}).force_required,
            (attrs || {}).neutral_label
          )
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
        autocomplete: "off",
        required: attrs.placeholder && (field.required || attrs.force_required),
        ...(attrs?.dynamic_where
          ? {
              "data-selected": v,
              "data-fetch-options": encodeURIComponent(
                JSON.stringify(attrs?.dynamic_where)
              ),
            }
          : {}),
        ...(field.in_auto_save
          ? {
              "previous-val": v,
              onFocus: "this.setAttribute('sc-received-focus', true);",
            }
          : {}),
      },
      attrs.placeholder &&
        (field.required || attrs.force_required) &&
        option({ value: "", disabled: true, selected: !v }, attrs.placeholder),
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
  description:
    "Select by drop-down. Available options are sourced from another table.",
  /**
   * @type {object[]}
   */
  configFields: async (fld: GenObj) => {
    //find tables with required key
    const fields = await Field.find(
      { reftable_name: fld.reftable_name },
      { cached: true }
    );
    const fldOption = fields.map(
      (f: Field) => `${Table.findOne(f.table_id!)!.name}.${f.name}`
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
    ];
  },

  async fill_options(
    field: GenObj,
    force_allow_none: boolean,
    where0: GenObj,
    extraCtx: GenObj,
    optionsQuery: any,
    formFieldNames: string[]
  ) {
    const [tableNm, fieldNm] = field.attributes.source_field.split(".");
    const srcTable = Table.findOne(tableNm)!;
    const srcField = srcTable.getField(fieldNm)!;
    const where: GenObj = { ...where0 };
    const srcFields = new Set(srcTable.fields.map((f: Field) => f.name));
    Object.keys(where).forEach((k) => {
      if (!srcFields.has(k)) delete where[k];
    });

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
        : {},
      typeof extraCtx?.user_id === "object"
        ? extraCtx?.user_id //TODO why is this ever an object??
        : extraCtx?.user || null
    );
    const get_label = field.attributes?.label_formula
      ? (r: GenObj) =>
          eval_expression(
            field.attributes?.label_formula,
            r,
            undefined,
            "Select label formula"
          )
      : srcField.attributes.summary_field
        ? (r: GenObj) => r.summary_field
        : (r: GenObj) => r[fieldNm];

    const isDynamic = (formFieldNames || []).some((nm: string) =>
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
      const fakeEnv: GenObj = {};
      formFieldNames.forEach((nm: string) => {
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
    field.options = nubBy(fieldNm, rows).map((r: GenObj) => ({
      label: get_label(r),
      value: r[fieldNm],
    }));
    if (!field.required || force_allow_none)
      field.options.unshift({ label: "", value: "" });
  },

  run: (nm: string, v: any, attrs: GenObj, cls: string, reqd: boolean, field: GenObj) => {
    if (attrs.disabled) {
      const value =
        (field.options || []).find((lv: GenObj) => lv?.value === v)?.label || v;
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
        autocomplete: "off",
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

const select_by_code = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  blockDisplay: true,
  description: "Select by drop-down. Available options are set by code.",
  /**
   * @type {object[]}
   */
  configFields: (field: GenObj) => [
    {
      name: "code",
      label: "Code",
      input_type: "code",
      attributes: { mode: "application/javascript" },
      class: "validate-statements",
      sublabel: `Return array of: strings or <code>{ label: string, value: ${field.is_fkey ? "key-value" : field.type?.js_type || "any"} }</code>`,
      validator(s: string) {
        try {
          let AsyncFunction = Object.getPrototypeOf(
            async function () {}
          ).constructor;
          AsyncFunction(s);
          return true;
        } catch (e: any) {
          return e.message;
        }
      },
    },
  ],

  async fill_options(
    field: GenObj,
    force_allow_none: boolean,
    where0: GenObj,
    extraCtx: GenObj,
    optionsQuery: any,
    formFieldNames: string[],
    user: any
  ) {
    field.options = await eval_statements(field.attributes.code, {
      ...extraCtx,
      user,
      Table,
    });
  },

  run: (nm: string, v: any, attrs: GenObj, cls: string, reqd: boolean, field: GenObj) => {
    const selOptions = select_options(
      v,
      field,
      (attrs || {}).force_required,
      (attrs || {}).neutral_label,
      false
    );

    return tags.select(
      {
        class: `form-control form-select ${cls} ${field.class || ""}`,
        "data-fieldname": field.form_name,
        name: text_attr(nm),
        id: `input${text_attr(nm)}`,
        disabled: attrs.disabled || attrs.disable,
        readonly: attrs.readonly,
        onChange: attrs.onChange,
        autocomplete: "off",
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
  description:
    "Two related dropdowns, the first determines values in the second.",

  /**
   * @type {object[]}
   */
  configFields: async ({ table, name }: { table: any; name: string }) => {
    if (!table) return [];
    const fields = table.getFields();
    const relOpts: string[] = [""];
    const field = fields.find((f: Field) => f.name === name);
    if (!field) return [];

    if (field.is_fkey && field.reftable_name) {
      const relTable = Table.findOne(field.reftable_name);
      if (!relTable) return [];

      const relFields = relTable.getFields();
      relFields.forEach((relField: Field) => {
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

  run: (nm: string, v: any, attrs: GenObj, cls: string, reqd: boolean, field: GenObj) => {
    const options2: GenObj = {};

    Object.entries(field.options || {}).forEach(([label, { id, options }]: [string, any]) => {
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
          autocomplete: "off",
        },
        select_options_first_level(v, field, attrs || {})
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
          autocomplete: "off",
          "data-calc-options": encodeURIComponent(JSON.stringify(calcOptions)),
        },
        option({ value: "" }, "")
      )
    );
  },
};
const select_options_first_level = (
  v: any,
  hdr: GenObj,
  { force_required, neutral_label, isFilter }: GenObj
) => {
  const os = Object.entries(hdr.options || {}).map(([label, { id, options }]: [string, any]) =>
    option(
      {
        value: id,
        selected: (options || []).find((o: GenObj) => o.value == v) !== undefined,
      },
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
  description: "Select from a radio group",
  run: (nm: string, v: any, attrs: GenObj, cls: string, reqd: boolean, field: GenObj) =>
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
  description:
    "Select from dropdown, or give user the option of creating a new relation in a popup",

  configFields: async (field: GenObj) => {
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
        name: "values_formula",
        label: "Create with values",
        type: "String",
        class: "validate-expression",
        sublabel:
          "Send these value to the view to create. Javascript object expression, for example <code>{manager: user.id}</code>",
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

  run: (nm: string, v: any, attrs: GenObj, cls: string, reqd: boolean, field: GenObj, row?: GenObj) => {
    const user = (db.getRequestContext()?.req as any)?.user;
    const use_row: GenObj = { ...(row || {}) };
    let table: Table | null | undefined;
    if (field?.table_id) {
      table = Table.findOne({ id: field.table_id });
      if (
        table &&
        (!Object.keys(use_row).length ||
          Object.keys(use_row).every((k) => k.startsWith("_") || k === "user"))
      )
        table.fields.forEach((f: Field) => (use_row[f.name] = undefined));
    }
    const qs = attrs.values_formula
      ? `?${objectToQueryString(eval_expression(attrs.values_formula, use_row, user, "search_or_create values formula"))}`
      : "";
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
          autocomplete: "off",

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
          onclick: `${isNode() ? "ajax_modal" : "mobile_modal"}('/view/${
            attrs.viewname
          }${qs}',{submitReload: false,onClose: soc_process_${nm}(this)})`,
          href: `javascript:void(0)`,
        },
        attrs.label || "Or create new"
      ) +
      script(`
      window.soc_process_${nm} = (elem) => ()=> {
        $.ajax('/api/${field.reftable_name}?sortBy=${table?.pk_name || "id"}', {
          success: function (res, textStatus, request) {
            var opts = res.success.map(x=>'<option value="'+x.id+'">'+x.${
              attrs.summary_field
            }+'</option>').join("")
            ${reqd ? "" : `opts = '<option></option>'+opts`}
            const sel = $(elem).prev().html(opts);
            sel.html(opts).prop('selectedIndex', res.success.length${
              reqd ? "-1" : ""
            });
            // https://stackoverflow.com/a/26232541
            var selected = sel.val(); // cache selected value, before reordering
            var opts_list = sel.find('option');
            opts_list.sort(function(a, b) { return $(a).text().toLowerCase() > $(b).text().toLowerCase() ? 1 : -1; });
            sel.html('').append(opts_list);
            sel.val(selected);
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
  configFields: async (field: GenObj) => {
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
          options: fields.map((v: Field) => ({
            label: v.name,
            value: `${reftable.name}->${v.name}`,
          })),
        },
      },
    ];
  },
  run: (nm: string, v: any, attrs: GenObj = {}, cls: string, required: boolean, field: GenObj, state: GenObj = {}) => {
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

const select_by_view = {
  /** @type {string} */
  type: "Key",
  /** @type {boolean} */
  isEdit: true,
  description:
    "Select relation by a dropdown. Labels can be customised and the options restricted",
  blockDisplay: true,

  /**
   * @type {object[]}
   */
  configFields: async (field: GenObj, modeetc?: GenObj) => {
    const refTable = Table.findOne({ name: field.reftable_name });
    const views = await View.find_possible_links_to_table(refTable!);
    const mode = modeetc?.mode;

    return [
      {
        name: "view",
        label: "View",
        type: "String",
        required: true,
        attributes: { options: views.map((v: View) => v.name) },
      },
      {
        name: "where",
        label: "Where",
        type: "String",
        help: {
          topic: "Where formula",
        },
        sublabel: "Limit selectable options",
      },
      {
        name: "justify",
        label: "Justify",
        sublabel: "Controls the vertical placement of items in the container",
        type: "String",
        required: true,
        attributes: {
          options: ["start", "end", "center", "between", "around", "evenly"],
        },
      },
      {
        name: "in_card",
        label: "In card",
        type: "Bool",
      },
      ...(mode === "filter"
        ? [
            {
              name: "multiple",
              label: "Allow multiple",
              type: "Bool",
            },
          ]
        : []),
    ];
  },

  async fill_options(
    field: GenObj,
    force_allow_none: boolean,
    where0: GenObj,
    extraCtx: GenObj,
    optionsQuery: any,
    formFieldNames: string[],
    user: any
  ) {
    const view = View.findOne({ name: field.attributes.view })!;
    const { req, res } = mockReqRes;
    field.options = await view.runMany(where0 || {}, {
      req: { ...req, user },
      res,
    });
  },

  run: (nm: string, v: any, attrs: GenObj, cls: string, reqd: boolean, field: GenObj) => {
    return div(
      {
        class: [
          "select-by-view-container",
          attrs?.justify && `justify-${attrs.justify}`,
        ],
      },
      !attrs?.multiple &&
        input({
          type: "hidden",
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          onChange: attrs.onChange,
          value: v || "",
        }),
      (field.options || []).map(({ row, html }: { row: GenObj; html: string }) =>
        div(
          {
            class: [
              "select-by-view-option",
              (Array.isArray(v) ? v.includes(row.id) : row.id == v) &&
                "selected",
              attrs.in_card ? "card" : "no-card",
            ],
            onclick: attrs?.multiple
              ? `$('input.selbyviewmulti-${row.id}').prop('checked', !$('input.selbyviewmulti-${row.id}').prop('checked')).trigger('change')`
              : `select_by_view_click(this, event, ${JSON.stringify(
                  !!reqd
                )}, ${JSON.stringify(!!attrs?.multiple)})`,

            "data-id": row.id,
          },
          attrs?.multiple &&
            input({
              class: `d-none selbyviewmulti-${row.id}`,
              type: "checkbox",
              name: text_attr(nm),
              onChange: `check_state_field(this, event)`,
              value: row.id,
              checked: Array.isArray(v) ? v.includes(row.id) : row.id == v,
            }),
          attrs.in_card ? div({ class: "card-body" }, html) : html
        )
      )
    );
  },
};

export = {
  select,
  select_from_table,
  search_or_create,
  radio_select,
  two_level_select,
  search_join_field,
  select_by_view,
  select_by_code,
};
