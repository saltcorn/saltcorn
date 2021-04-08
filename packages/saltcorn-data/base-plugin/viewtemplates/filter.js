const User = require("../../models/user");
const View = require("../../models/view");
const Table = require("../../models/table");
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
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const { readState } = require("../../plugin-helper");
const { search_bar } = require("@saltcorn/markup/helpers");
const { eachView } = require("../../models/layout");
const { InvalidConfiguration } = require("../../utils");

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
          const {
            child_field_list,
            child_relations,
          } = await table.get_child_relations();
          const roles = await User.get_roles();
          for (const cr of child_relations) {
            const cfields = await cr.table.getFields();
            cfields.forEach((cf) => {
              if (cf.name !== cr.key_field.name)
                fields.push({
                  ...cf,
                  label: `${cr.table.name}.${cr.key_field.name}→${cf.name}`,
                  name: `${cr.table.name}.${cr.key_field.name}.${cf.name}`,
                });
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
          return {
            fields,
            roles,
            actions,
            views,
            mode: "filter",
          };
        },
      },
    ],
  });
const get_state_fields = () => [];

const initial_config = async () => ({ layout: {}, columns: [] });

const run = async (table_id, viewname, { columns, layout }, state, extra) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const table = await Table.findOne(table_id);
  const fields = await table.getFields();
  readState(state, fields);
  const role = extra.req.user ? extra.req.user.role_id : 10;
  const distinct_values = {};
  for (const col of columns) {
    if (col.type === "DropDownFilter") {
      const field = fields.find((f) => f.name === col.field_name);
      if (table.external) {
        distinct_values[col.field_name] = (
          await table.distinctValues(col.field_name)
        ).map((x) => ({ label: x, value: x }));
      } else if (field)
        distinct_values[col.field_name] = await field.distinct_values(
          extra.req
        );
      else if (col.field_name.includes(".")) {
        const kpath = col.field_name.split(".");
        if (kpath.length === 3) {
          const [jtNm, jFieldNm, lblField] = kpath;
          const jtable = await Table.findOne({ name: jtNm });
          const jfields = await jtable.getFields();
          const jfield = jfields.find((f) => f.name === lblField);
          if (jfield)
            distinct_values[col.field_name] = await jfield.distinct_values();
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
  await eachView(layout, async (segment) => {
    const view = await View.findOne({ name: segment.view });
    if (!view)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${segment.view}`
      );
    else segment.contents = await view.run(state, extra);
  });

  const blockDispatch = {
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
          class: "form-control d-inline",
          style: full_width ? undefined : "width: unset;",
          onchange: `this.value=='' ? unset_state_field('${field_name}'): set_state_field('${field_name}', this.value)`,
        },
        distinct_values[field_name].map(({ label, value, jsvalue }) =>
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
    toggle_filter({ field_name, value, label, size, style }) {
      const field = fields.find((f) => f.name === field_name);
      const isBool = field && field.type.name === "Bool";

      const active = isBool
        ? {
            on: state[field_name],
            off: state[field_name] === false,
            "?": state[field_name] === null,
          }[value]
        : eq_string(state[field_name], value);
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
            active || value === undefined
              ? `unset_state_field('${field_name}')`
              : `set_state_field('${field_name}', encodeURIComponent('${
                  value || ""
                }'))`,
        },
        label || value
      );
    },
  };
  return renderLayout({ blockDispatch, layout, role });
};

const or_if_undef = (x, y) => (typeof x === "undefined" ? y : x);
const eq_string = (x, y) => `${x}` === `${y}`;
module.exports = {
  name: "Filter",
  description:
    "Elements that limit the rows shown in other views on the same page. Filter views do not show any rows on their own.",
  get_state_fields,
  configuration_workflow,
  run,
  initial_config,
  display_state_form: false,
};
