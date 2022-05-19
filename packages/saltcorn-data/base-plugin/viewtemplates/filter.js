/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/filter
 * @subcategory base-plugin
 */
const User = require("../../models/user");
const View = require("../../models/view");
const Table = require("../../models/table");
const Field = require("../../models/field");
const Workflow = require("../../models/workflow");

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
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  readState,
  calcfldViewOptions,
  calcfldViewConfig,
} = require("../../plugin-helper");
const { search_bar } = require("@saltcorn/markup/helpers");
const {
  eachView,
  translateLayout,
  getStringsForI18n,
  traverse,
} = require("../../models/layout");
const { InvalidConfiguration } = require("../../utils");
const { jsexprToWhere } = require("../../models/expression");
const Library = require("../../models/library");
const { getState } = require("../../db/state");

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
          const own_link_views = await View.find_table_views_where(
            context.table_id || context.exttable_name,
            ({ viewrow }) => viewrow.name !== context.viewname
          );
          const views = own_link_views.map((v) => ({
            label: v.name,
            name: v.name,
          }));
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
          return {
            fields,
            tableName: table.name,
            roles,
            actions,
            views,
            library,
            field_view_options,
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

  const { distinct_values, role } = await distinctValuesQuery();
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
      field.fieldview = fieldview;
      Object.assign(field.attributes, configuration);
      await field.fill_fkey_options();
      segment.field = field;
    },
    view: async (segment) => {
      const view = await View.findOne({ name: segment.view });
      if (!view)
        throw new InvalidConfiguration(
          `View ${viewname} incorrectly configured: cannot find view ${segment.view}`
        );
      else segment.contents = await view.run(state, extra);
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
      return search_bar("_fts", state["_fts"], {
        stateField: "_fts",
        has_dropdown,
        contents: rendered_contents,
        badges: show_badges ? badges : null,
      });
    },
    dropdown_filter({ field_name, neutral_label, full_width }) {
      return select(
        {
          name: `ddfilter${field_name}`,
          class: "form-control form-select d-inline",
          style: full_width ? undefined : "width: unset;",
          onchange: `this.value=='' ? unset_state_field('${field_name}'): set_state_field('${field_name}', this.value)`,
        },
        (distinct_values[field_name] || []).map(({ label, value, jsvalue }) =>
          option(
            {
              value,
              selected: state[field_name] === or_if_undef(jsvalue, value),
              class: !value && !label ? "text-muted" : undefined,
            },
            !value && !label ? neutral_label : label
          )
        )
      );
    },
    action({
      block,
      action_label,
      action_style,
      action_size,
      action_icon,
      action_name,
    }) {
      const label = action_label || action_name;
      if (action_style === "btn-link")
        return a(
          { href: "javascript:clear_state()" },
          action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
          label
        );
      else
        return button(
          {
            onClick: "clear_state()",
            class: `btn ${action_style || "btn-primary"} ${action_size || ""}`,
          },
          action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
          label
        );
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
  queries: ({
    table_id,
    viewname,
    configuration: { columns, default_state },
    req,
  }) => ({
    async distinctValuesQuery() {
      const table = await Table.findOne(table_id);
      const fields = await table.getFields();
      let distinct_values = {};
      const role = req.user ? req.user.role_id : 10;
      for (const col of columns) {
        if (col.type === "DropDownFilter") {
          const field = fields.find((f) => f.name === col.field_name);
          if (table.external) {
            distinct_values[col.field_name] = (
              await table.distinctValues(col.field_name)
            ).map((x) => ({ label: x, value: x }));
          } else if (field)
            distinct_values[col.field_name] = await field.distinct_values(
              req,
              jsexprToWhere(col.where)
            );
          else if (col.field_name.includes(".")) {
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
