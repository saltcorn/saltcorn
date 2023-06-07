/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/filter
 * @subcategory base-plugin
 */
const User = require("../../models/user");
const Page = require("../../models/page");
const View = require("../../models/view");
const Table = require("../../models/table");
const Field = require("../../models/field");
const Workflow = require("../../models/workflow");
const Trigger = require("../../models/trigger");
const Crash = require("../../models/crash");

const {
  div,
  text,
  span,
  i,
  option,
  select,
  button,
  text_attr,
  script,
  a,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  readState,
  calcfldViewOptions,
  calcfldViewConfig,
  run_action_column,
} = require("../../plugin-helper");
const { action_link } = require("./viewable_fields");
const { search_bar } = require("@saltcorn/markup/helpers");
const {
  eachView,
  translateLayout,
  getStringsForI18n,
  traverse,
} = require("../../models/layout");
const { InvalidConfiguration, objectToQueryString } = require("../../utils");
const { jsexprToWhere } = require("../../models/expression");
const Library = require("../../models/library");
const { getState } = require("../../db/state");
const {
  get_expression_function,
  eval_expression,
} = require("../../models/expression");
/**
 * @returns {Workflow}
 */
const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Layout",
        builder: async (context) => {
          const table = await Table.findOne(
            context.table_id || context.exttable_name
          );
          const fields = await table.getFields();
          const { child_field_list, child_relations } =
            await table.get_child_relations();
          const { parent_field_list } = await table.get_parent_relations(true);
          const my_parent_field_list = parent_field_list
            .map((pfield) => {
              const kpath = pfield.split(".");
              if (kpath.length === 2) {
                const [jFieldNm, lblField] = kpath;
                const jfld = fields.find((f) => f.name === jFieldNm);
                if (jfld)
                  return `${jFieldNm}.${jfld.reftable_name}->${lblField}`;
              }
              if (kpath.length === 3) {
                const [jFieldNm, throughField, lblField] = kpath;
                const jfld = fields.find((f) => f.name === jFieldNm);
                if (!jfld) return;
                const throughTable = Table.findOne({
                  name: jfld.reftable_name,
                });
                const throughFld = throughTable.fields.find(
                  (f) => f.name === throughField
                );
                return `${jFieldNm}.${jfld.reftable_name}->${throughField}.${throughFld.reftable_name}->${lblField}`;
              }
            })
            .filter((f) => f);
          const roles = await User.get_roles();
          for (const cr of child_relations) {
            const cfields = await cr.table.getFields();
            cfields.forEach((cf) => {
              if (cf.name !== cr.key_field.name)
                fields.push(
                  new Field({
                    ...cf,
                    label: `${cr.table.name}.${cr.key_field.name}→${cf.name}`,
                    name: `${cr.table.name}.${cr.key_field.name}.${cf.name}`,
                  })
                );
            });
          }
          const actions = ["Clear"];
          (
            await Trigger.find({
              when_trigger: { or: ["API call", "Never"] },
            })
          ).forEach((tr) => {
            actions.push(tr.name);
          });
          const actionConfigForms = {
            Clear: [
              {
                name: "omit_fields",
                label: "Omit fields",
                sublabel: "Comma separated list of fields not to clear",
                type: "String",
              },
            ],
          };
          const own_link_views = await View.find_table_views_where(
            context.table_id || context.exttable_name,
            ({ viewrow }) => viewrow.name !== context.viewname
          );
          const own_view_names = new Set();
          const views = own_link_views.map((v) => {
            own_view_names.add(v.name);
            return {
              label: v.name,
              name: v.name,
              viewtemplate: v.viewtemplate,
            };
          });
          const all_views = await View.find();
          for (const v of all_views) {
            if (!own_view_names.has(v.name)) {
              views.push({
                label: v.name,
                name: v.name,
                viewtemplate: v.viewtemplate,
              });
            }
          }
          for (const field of fields) {
            const presets = field.presets;
            field.preset_options = presets ? Object.keys(presets) : [];
          }
          const library = (await Library.find({})).filter((l) =>
            l.suitableFor("filter")
          );
          const fieldViewConfigForms = await calcfldViewConfig(fields, false);

          const { field_view_options, handlesTextStyle } = calcfldViewOptions(
            fields,
            "filter"
          );
          const pages = await Page.find();

          return {
            fields,
            tableName: table.name,
            parent_field_list: my_parent_field_list,
            roles,
            actions,
            views,
            pages,
            images: [], //temp fix till we rebuild builder
            library,
            field_view_options,
            actionConfigForms,
            fieldViewConfigForms,
            mode: "filter",
          };
        },
      },
    ],
  });

/** @returns {object[]} */
const get_state_fields = () => [];

/**
 *
 * @returns {Promise<object>}
 */
const initial_config = async () => ({ layout: {}, columns: [] });

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} opts
 * @param {object[]} opts.columns
 * @param {object} opts.layout
 * @param {object} state
 * @param {object} extra
 * @returns {Promise<Layout>}
 */
const run = async (
  table_id,
  viewname,
  { columns, layout },
  state,
  extra,
  { distinctValuesQuery }
) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const table = await Table.findOne(table_id);
  const fields = await table.getFields();
  readState(state, fields);
  const formFieldNames = (columns || [])
    .map((c) => c.field_name)
    .filter((n) => n);
  const { distinct_values, role } = await distinctValuesQuery(state);
  const badges = [];
  Object.entries(state).forEach(([k, v]) => {
    if (typeof v === "undefined") return;
    if (k[0] !== "_") {
      let showv = v;
      if (distinct_values[k]) {
        const realv = distinct_values[k].find((dv) => dv.value === v);
        if (realv) showv = realv.label;
      }
      badges.push({
        text: `${text_attr(k)}:${text_attr(showv)}`,
        onclick: `unset_state_field('${text_attr(k)}')`,
      });
    }
  });
  await traverse(layout, {
    field: async (segment) => {
      const { field_name, fieldview, configuration } = segment;
      let field = fields.find((fld) => fld.name === field_name);
      if (!field) return;
      field.fieldview = fieldview;
      Object.assign(field.attributes, configuration);
      await field.fill_fkey_options(
        false,
        undefined,
        extra.req.user ? { ...state, user_id: extra.req.user } : state,
        undefined
      );
      segment.field = field;
    },
    view: async (segment) => {
      const view = await View.findOne({ name: segment.view });
      const extra_state = segment.extra_state_fml
        ? eval_expression(segment.extra_state_fml, {}, extra.req.user)
        : {};
      const state1 = { ...state, ...extra_state };
      if (!view)
        throw new InvalidConfiguration(
          `View ${viewname} incorrectly configured: cannot find view ${segment.view}`
        );
      else segment.contents = await view.run(state1, extra);
    },
    link: (segment) => {
      if (segment.transfer_state) {
        segment.url += `?` + objectToQueryString(state || {});
      }
      if (segment.view_state_fml) {
        const extra_state = segment.view_state_fml
          ? eval_expression(segment.view_state_fml, {}, extra.req.user)
          : {};
        segment.url +=
          (segment.transfer_state ? "" : `?`) +
          objectToQueryString(extra_state || {});
      }
    },
  });
  translateLayout(layout, extra.req.getLocale());
  const blockDispatch = {
    field(segment) {
      const { field_name, fieldview, configuration, field } = segment;

      if (!field) return "";
      //console.log({ fieldview, field });
      if (fieldview && field.type && field.type === "Key") {
        const fv = getState().keyFieldviews[fieldview];
        if (fv && (fv.isEdit || fv.isFilter)) {
          segment.options = distinct_values[field_name];
          return fv.run(
            field_name,
            state[field_name],
            {
              onChange: `set_state_field('${field_name}', this.value)`,
              ...field.attributes,
              isFilter: true,
              ...configuration,
            },
            "",
            false,
            field,
            state
          );
        }
      }
      if (
        fieldview &&
        field.type &&
        field.type.fieldviews &&
        field.type.fieldviews[fieldview]
      ) {
        const fv = field.type.fieldviews[fieldview];
        if (fv.isEdit || fv.isFilter)
          return fv.run(
            field_name,
            state[field_name],
            {
              onChange: `set_state_field('${field_name}', this.value)`,
              isFilter: true,
              ...field.attributes,
              ...configuration,
            },
            "",
            false,
            field,
            state
          );
      }
      return "";
    },
    search_bar({ has_dropdown, contents, show_badges }, go) {
      const rendered_contents = go(contents);
      const stVar = `_fts_${table.santized_name}`;
      return search_bar(stVar, state[stVar], {
        stateField: stVar,
        has_dropdown,
        contents: rendered_contents,
        badges: show_badges ? badges : null,
      });
    },
    dropdown_filter(segment) {
      const { field_name, neutral_label, full_width, label_formula } = segment;

      const dvs = distinct_values[field_name] || [];
      dvs.sort((a, b) =>
        (a.label?.toLowerCase?.() || a.label) >
        (b.label?.toLowerCase?.() || b.label)
          ? 1
          : -1
      );
      const options = dvs.map(({ label, value, jsvalue }) =>
        option(
          {
            value,
            selected:
              `${state[field_name]}` === `${or_if_undef(jsvalue, value)}` ||
              (!value && !state[field_name]) ||
              (jsvalue === true && state[field_name] === "on") ||
              (jsvalue === false && state[field_name] === "off"),
            class: !value && !label ? "text-muted" : undefined,
          },
          !value && !label
            ? neutral_label
            : label_formula
            ? eval_expression(
                label_formula,
                { [field_name]: value },
                extra.req.user || { role_id: 100 }
              )
            : label
        )
      );
      return select(
        {
          name: `ddfilter${field_name}`,
          class:
            "form-control form-select d-inline-maybe scfilter selectizable",
          style: full_width ? undefined : "width: unset;",
          required: true,
          onchange: `this.value=='' ? unset_state_field('${encodeURIComponent(
            field_name
          )}'): set_state_field('${encodeURIComponent(
            field_name
          )}', this.value)`,
        },
        options
      );
    },
    action(segment) {
      const {
        block,
        action_label,
        action_style,
        action_size,
        action_icon,
        action_name,
        configuration,
      } = segment;
      const label = action_label || action_name;
      if (segment.action_style === "on_page_load") {
        run_action_column({
          col: { ...segment },
          referrer: extra.req.get("Referrer"),
          req: extra.req,
        }).catch((e) => Crash.create(e, extra.req));
        return "";
      }

      if (action_name === "Clear") {
        if (action_style === "btn-link")
          return a(
            {
              href: `javascript:clear_state('${
                configuration?.omit_fields || ""
              }')`,
            },
            action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
            label
          );
        else
          return button(
            {
              onClick: `clear_state('${configuration?.omit_fields || ""}')`,
              class: `btn ${action_style || "btn-primary"} ${
                action_size || ""
              }`,
            },
            action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
            label
          );
      } else {
        const url = {
          javascript: `view_post('${viewname}', 'run_action', {rndid:'${segment.rndid}'});`,
        };

        return action_link(url, extra.req, segment);
      }
    },
    toggle_filter({ field_name, value, preset_value, label, size, style }) {
      const field = fields.find((f) => f.name === field_name);
      const isBool = field && field.type.name === "Bool";

      const use_value =
        preset_value && field.presets
          ? field.presets[preset_value]({
              user: extra.req.user,
              req: extra.req,
            })
          : value;

      const active = isBool
        ? {
            on: state[field_name],
            off: state[field_name] === false,
            "?": state[field_name] === null,
          }[use_value]
        : eq_string(state[field_name], use_value);
      return button(
        {
          class: [
            "btn",
            active
              ? `btn-${style || "primary"}`
              : `btn-outline-${style || "primary"}`,
            size && size,
          ],
          onClick:
            active || use_value === undefined
              ? `unset_state_field('${field_name}')`
              : `set_state_field('${field_name}', '${use_value || ""}')`,
        },
        label || value || preset_value
      );
    },
  };
  return div(
    { class: "form-namespace" },
    renderLayout({ blockDispatch, layout, role, req: extra.req })
  );
};

/**
 * @param {object|undefined} x
 * @param {object|undefined} y
 * @returns {object}
 */
const or_if_undef = (x, y) => (typeof x === "undefined" ? y : x);

/**
 * @param {string} x
 * @param {string} y
 * @returns {boolean}
 */
const eq_string = (x, y) => `${x}` === `${y}`;

const run_action = async (
  table_id,
  viewname,
  { columns, layout },
  body,
  { req, res },
  { actionQuery }
) => {
  const result = await actionQuery();
  if (result.json.error) {
    Crash.create({ message: result.json.error, stack: "" }, req);
  }
  return result;
};
module.exports = {
  /** @type {string} */
  name: "Filter",
  /** @type {string} */
  description:
    "Elements that limit the rows shown in other views on the same page. Filter views do not show any rows on their own.",
  get_state_fields,
  configuration_workflow,
  run,
  initial_config,
  /** @type {boolean} */
  display_state_form: false,
  /**
   * @param {object} opts
   * @param {*} opts.layout
   * @returns {string[]}
   */
  getStringsForI18n({ layout }) {
    return getStringsForI18n(layout);
  },
  routes: { run_action },
  queries: ({
    table_id,
    viewname,
    configuration: { columns, default_state },
    req,
    res,
    exttable_name,
  }) => ({
    async actionQuery() {
      const body = req.body;
      const col = columns.find(
        (c) => c.type === "Action" && c.rndid === body.rndid && body.rndid
      );
      const table = await Table.findOne({ id: table_id });
      try {
        const result = await run_action_column({
          col,
          req,
          table,
          res,
          referrer: req.get("Referrer"),
        });
        return { json: { success: "ok", ...(result || {}) } };
      } catch (e) {
        return { json: { error: e.message || e } };
      }
    },
    async distinctValuesQuery(state) {
      const table = await Table.findOne(table_id || exttable_name);
      const fields = await table.getFields();
      let distinct_values = {};
      const role = req.user ? req.user.role_id : 100;
      for (const col of columns) {
        if (col.type === "DropDownFilter") {
          const field = fields.find((f) => f.name === col.field_name);
          if (table.external) {
            distinct_values[col.field_name] = (
              await table.distinctValues(col.field_name)
            ).map((x) => ({ label: x, value: x }));
          } else if (field) {
            distinct_values[col.field_name] = await field.distinct_values(
              req,
              jsexprToWhere(
                col.where,
                {
                  ...state,
                  user_id: req.user ? req.user.id : undefined,
                  user: req.user,
                },
                fields
              )
            );
          } else if (col.field_name.split("->").length === 3) {
            //`${jFieldNm}.${jfld.reftable_name}->${throughField}.${throughFld.reftable_name}->${lblField}`;
            const [jFieldNm, throughPart, finalPart] =
              col.field_name.split(".");
            const [thoughTblNm, throughField] = throughPart.split("->");
            const [jtNm, lblField] = finalPart.split("->");
            const target = await table.getField(
              `${jFieldNm}.${throughField}.${lblField}`
            );
            if (target)
              distinct_values[col.field_name] = await target.distinct_values(
                req,
                jsexprToWhere(col.where)
              );
          } else if (col.field_name.includes("->")) {
            const [jFieldNm, krest] = col.field_name.split(".");
            const [jtNm, lblField] = krest.split("->");
            const jtable = await Table.findOne({ name: jtNm });
            if (!jtable)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find join table ${jtNm}`
              );
            const jfields = await jtable.getFields();
            const jfield = jfields.find((f) => f.name === lblField);
            if (jfield)
              distinct_values[col.field_name] = await jfield.distinct_values(
                req,
                jsexprToWhere(col.where)
              );
          } else if (col.field_name.includes(".")) {
            const kpath = col.field_name.split(".");
            if (kpath.length === 3) {
              const [jtNm, jFieldNm, lblField] = kpath;
              const jtable = await Table.findOne({ name: jtNm });
              if (!jtable)
                throw new InvalidConfiguration(
                  `View ${viewname} incorrectly configured: cannot find join table ${jtNm}`
                );
              const jfields = await jtable.getFields();
              const jfield = jfields.find((f) => f.name === lblField);
              if (jfield)
                distinct_values[col.field_name] = await jfield.distinct_values(
                  req,
                  jsexprToWhere(col.where)
                );
            } else if (kpath.length === 2) {
              const target = await table.getField(col.field_name);
              if (target)
                distinct_values[col.field_name] = await target.distinct_values(
                  req,
                  jsexprToWhere(col.where)
                );
            }
          }
          const dvs = distinct_values[col.field_name];
          if (dvs && dvs[0]) {
            if (dvs[0].value !== "") {
              dvs.unshift({ label: "", value: "" });
            }
          }
        }
      }
      return { distinct_values, role };
    },
  }),
};
