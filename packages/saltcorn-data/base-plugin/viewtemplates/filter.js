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
  domReady,
  script,
  a,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  readState,
  calcfldViewOptions,
  calcfldViewConfig,
  run_action_column,
  stateFieldsToWhere,
  getActionConfigFields,
  picked_fields_to_query,
  stateFieldsToQuery,
  stateToQueryString,
} = require("../../plugin-helper");
const { action_link } = require("./viewable_fields");
const { search_bar } = require("@saltcorn/markup/helpers");
const {
  eachView,
  translateLayout,
  getStringsForI18n,
  traverse,
} = require("../../models/layout");
const {
  InvalidConfiguration,
  objectToQueryString,
  removeEmptyStrings,
  asyncMap,
  getSessionId,
  mergeIntoWhere,
  isWeb,
} = require("../../utils");
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
const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: "Layout",
        builder: async (context) => {
          const table = Table.findOne(
            context.table_id || context.exttable_name
          );
          const fields = [...table.getFields()];
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
          const stateActions = Object.entries(getState().actions).filter(
            ([k, v]) => !v.disableInBuilder
          );
          const actions1 = ["Clear", ...stateActions.map(([k, v]) => k)];
          const actions = Trigger.action_options({
            tableTriggers: table.id,
            apiNeverTriggers: true,
            builtInLabel: "Filter Actions",
            builtIns: ["Clear"],
          });
          const actionConstraints = {};
          const stateActionsObj = getState().actions;
          for (const action of actions1) {
            if (stateActionsObj[action]?.requireRow)
              actionConstraints[action] = { requireRow: true };
          }
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
          for (const [name, action] of stateActions) {
            if (action.configFields) {
              actionConfigForms[name] = await getActionConfigFields(
                action,
                table,
                { mode: "filter", req }
              );
            }
          }
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
          const all_views = await View.find({}, { cached: true });
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
          //const fieldViewConfigForms = await calcfldViewConfig(fields, false);

          const { field_view_options, handlesTextStyle } = calcfldViewOptions(
            fields,
            "filter"
          );
          const pages = await Page.find();
          var agg_field_opts = {};

          agg_field_opts[table.name] = table.fields
            .filter((f) => !f.calculated || f.stored)
            .map((f) => ({
              name: f.name,
              label: f.label,
              ftype: f.type.name || f.type,
              table_name: table.name,
              table_id: table.id,
            }));

          const agg_fieldview_options = {};

          Object.values(getState().types).forEach((t) => {
            agg_fieldview_options[t.name] = Object.entries(t.fieldviews)
              .filter(([k, v]) => !v.isEdit && !v.isFilter)
              .map(([k, v]) => k);
          });

          return {
            fields: fields.map((f) => f.toBuilder),
            tableName: table.name,
            parent_field_list: my_parent_field_list,
            child_field_list: [table.name],
            agg_field_opts,
            agg_fieldview_options,
            roles,
            builtInActions: ["Clear"],
            actions,
            actionConstraints,
            views,
            pages,
            images: [], //temp fix till we rebuild builder
            library,
            field_view_options,
            actionConfigForms,
            //fieldViewConfigForms,
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
  { distinctValuesQuery, optionsQuery }
) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const table = Table.findOne(table_id);
  const fields = table.getFields();
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
        onclick: `unset_state_field('${text_attr(k)}', this)`,
      });
    }
  });
  const evalCtx = { ...state };
  fields.forEach((f) => {
    //so it will be in scope in formula
    if (typeof evalCtx[f.name] === "undefined") evalCtx[f.name] = undefined;
  });
  evalCtx.session_id = getSessionId(extra.req);
  await traverse(layout, {
    aggregation: async (segment) => {
      const { stat, agg_field, agg_fieldview, aggwhere } = segment;
      const where = stateFieldsToWhere({ fields, state, table, prefix: "a." });
      if (aggwhere) {
        const ctx = {
          ...state,
          user_id: extra.req.user?.id || null,
          user: extra.req.user,
        };
        let where1 = jsexprToWhere(aggwhere, ctx, fields);
        mergeIntoWhere(where, where1 || {});
      }
      const { val } = await table.aggregationQuery(
        {
          val: {
            field: agg_field,
            aggregate: stat,
          },
        },
        { where }
      );
      const fld = table.getField(agg_field);
      segment.type = "blank";
      if (stat.toLowerCase() === "array_agg" && Array.isArray(val))
        segment.contents = val.map((v) => text(v.toString())).join(", ");
      else if (agg_fieldview) {
        const outcomeType =
          stat === "Percent true" || stat === "Percent false"
            ? "Float"
            : stat === "Count" || stat === "CountUnique"
            ? "Integer"
            : fld.type?.name;
        const type = getState().types[outcomeType];
        if (type?.fieldviews[agg_fieldview]) {
          const readval = type.read(val);
          segment.contents = type.fieldviews[agg_fieldview].run(
            readval,
            extra.req,
            segment?.configuration || {}
          );
        }
      } else segment.contents = text(val);
    },
    field: async (segment) => {
      const { field_name, fieldview, configuration } = segment;
      let field = fields.find((fld) => fld.name === field_name);
      if (!field) {
        if (field_name.includes(".")) {
          const kpath = field_name.split(".");
          if (kpath.length === 3) {
            const [jtNm, jFieldNm, lblField] = kpath;
            const jtable = Table.findOne({ name: jtNm });
            if (!jtable)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find join table ${jtNm}`
              );
            const jfields = jtable.fields;
            field = jfields.find((f) => f.name === lblField);
          }
        }
        if (!field) return;
      }
      field.fieldview = fieldview;
      if (field.is_fkey && !field.fieldviewObj)
        field.fieldviewObj = getState().keyFieldviews[field.fieldview];
      Object.assign(field.attributes, configuration);
      await field.fill_fkey_options(
        false,
        undefined,
        extra.req.user ? { ...state, user_id: extra.req.user } : state,
        isWeb(extra.req) ? undefined : optionsQuery,
        undefined,
        undefined,
        extra.req.user || { role_id: 100 }
      );
      segment.field = field;
    },
    view: async (segment) => {
      const view = await View.findOne({ name: segment.view });
      if (!view)
        throw new InvalidConfiguration(
          `View ${viewname} incorrectly configured: cannot find view ${segment.view}`
        );
      const extra_state = segment.extra_state_fml
        ? eval_expression(
            segment.extra_state_fml,
            evalCtx,
            extra.req.user,
            `Extra state formula for view ${view.name}`
          )
        : {};
      if (segment.state === "local") {
        const state1 = { ...extra_state };
        const qs = stateToQueryString(state1, true);

        segment.contents = div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-sc-local-state": `/view/${view.name}${qs}`,
          },
          await view.run(state1, extra)
        );
      } else {
        const state1 = { ...state, ...extra_state };
        const qs = stateToQueryString(state1, true);

        segment.contents = div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-sc-view-source": `/view/${view.name}${qs}`,
          },
          await view.run(state1, extra)
        );
      }
    },
    link: (segment) => {
      //console.log("link:", segment, state);
      if (segment.transfer_state) {
        segment.url += `?` + objectToQueryString(state || {});
      }
      if (segment.view_state_fml) {
        const extra_state = segment.view_state_fml
          ? eval_expression(
              segment.view_state_fml,
              evalCtx,
              extra.req.user,
              `Extra state formula for link`
            )
          : {};
        segment.url +=
          (segment.transfer_state ? "" : `?`) +
          objectToQueryString(extra_state || {});
      }
    },
    container(segment) {
      if (segment.showIfFormula) {
        const f = get_expression_function(segment.showIfFormula, fields);

        if (!f(state, extra.req.user)) segment.hide = true;
        else segment.hide = false;
      }
    },
    tabs(segment) {
      const to_delete = new Set();

      (segment.showif || []).forEach((sif, ix) => {
        if (sif) {
          const showit = eval_expression(
            sif,
            evalCtx,
            extra.req.user,
            "Tabs show if formula"
          );
          if (!showit) to_delete.add(ix);
        }
      });

      segment.titles = segment.titles.filter((v, ix) => !to_delete.has(ix));
      segment.contents = segment.contents.filter((v, ix) => !to_delete.has(ix));
    },
    async action(segment) {
      if (segment.action_style === "on_page_load") {
        segment.type = "blank";
        segment.style = {};
        if (segment.minRole && segment.minRole != 100) {
          const minRole = +segment.minRole;
          const userRole = extra?.req?.user?.role_id || 100;
          if (minRole < userRole) return;
        }
        if (extra?.isPreview) return;
        try {
          const actionResult = await run_action_column({
            col: { ...segment },
            referrer: extra.req?.get?.("Referrer"),
            req: extra.req,
            row: state,
            table,
          });

          if (actionResult)
            segment.contents = script(
              domReady(
                `common_done(${JSON.stringify(actionResult)}, "${viewname}")`
              )
            );
          else segment.contents = "";
        } catch (e) {
          segment.contents = "";
          Crash.create(e, extra.req);
        }
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
              onChange: `set_state_field('${encodeURIComponent(
                field_name
              )}', this.value, this)`,
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
              onChange: `set_state_field('${encodeURIComponent(
                field_name
              )}', this.value, this)`,
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
    search_bar({ has_dropdown, contents, show_badges, autofocus }, go) {
      const rendered_contents = go(contents);
      const stVar = `_fts_${table.santized_name}`;
      return search_bar(stVar, state[stVar], {
        stateField: stVar,
        has_dropdown,
        autofocus,
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
      const options = dvs.map(({ label, value, jsvalue }, ix) =>
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
          !value && !label && ix === 0 && neutral_label
            ? neutral_label
            : label_formula
            ? eval_expression(
                label_formula,
                { [field_name]: value },
                extra.req.user || { role_id: 100 },
                "Dropdown label formula"
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
          )}', this): set_state_field('${encodeURIComponent(
            field_name
          )}', this.value, this)`,
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
        action_row_variable,
        configuration,
        confirm,
      } = segment;
      const label = action_label || action_name;

      const confirmStr = confirm ? `if(confirm('${"Are you sure?"}'))` : "";

      if (action_name === "Clear") {
        if (action_style === "btn-link")
          return a(
            {
              onclick: `${confirmStr}clear_state('${
                configuration?.omit_fields || ""
              }', this)`,
              href: "javascript:void(0)",
            },
            action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
            label
          );
        else
          return button(
            {
              onClick: `${confirmStr}clear_state('${
                configuration?.omit_fields || ""
              }', this)`,
              class: `btn ${action_style || "btn-primary"} ${
                action_size || ""
              }`,
            },
            action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
            label
          );
      } else {
        const withState =
          action_row_variable === "each_matching_row" ||
          action_row_variable === "state";
        const url = {
          javascript:
            `${confirmStr}view_post('${viewname}', 'run_action', {rndid:'${segment.rndid}'}, ` +
            `null, ${withState});`,
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
              ? `unset_state_field('${encodeURIComponent(field_name)}', this)`
              : `set_state_field('${encodeURIComponent(field_name)}', '${
                  use_value || ""
                }', this)`,
        },
        label || value || preset_value
      );
    },
  };
  return div(
    { class: "form-namespace" },
    renderLayout({
      blockDispatch,
      layout,
      role,
      req: extra.req,
      hints: getState().getLayout(extra.req.user).hints || {},
    })
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
  config,
  body,
  { req, res },
  { actionQuery }
) => {
  const table = Table.findOne(table_id);
  if (!table)
    throw new InvalidConfiguration(
      `View '${viewname}:run_action' incorrectly configured: ` +
        `Unable to find table with id '${table_id}'`
    );
  const state = req?.query
    ? readState(removeEmptyStrings(req.query), table.getFields(), req)
    : {};
  const result = await actionQuery(state, body?.rndid);
  if (result.json.error) {
    Crash.create({ message: result.json.error, stack: "" }, req);
  }
  return result;
};

/**
 * combine multiple action results into one object
 * for 'reload_page, goto, popup' take the first
 * all other types are combined into arrays
 * @param results array of action results
 */
const combineResults = (results) => {
  const messageLimit = 5;
  const downloadLimit = 5;
  let numMsgs = 0,
    suppressedMsgs = 0,
    suppressedErrors = 0;
  let numDownloads = 0,
    suppressedDownloads = 0;
  const result = { json: { success: "ok" } };
  const initOrPush = (newElement, memberName) => {
    if (result.json[memberName]) result.json[memberName].push(newElement);
    else result.json[memberName] = [newElement];
  };
  const initOnce = (newElement, memberName) => {
    if (typeof result[memberName] === "undefined")
      result.json[memberName] = newElement;
  };
  for (const result of results) {
    if (!result) continue;
    if (result.reload_page) initOnce(result.reload_page, "reload_page");
    if (result.goto) initOnce(result.goto, "goto");
    if (result.popup) initOnce(result.popup, "popup");
    if (result.notify) {
      if (numMsgs < messageLimit) {
        initOrPush(result.notify, "notify");
        ++numMsgs;
      } else ++suppressedMsgs;
    }
    if (result.error) {
      if (numMsgs < messageLimit) {
        initOrPush(result.error, "error");
        ++numMsgs;
      } else ++suppressedErrors;
    }
    if (result.download) {
      if (numDownloads < downloadLimit) {
        initOrPush(result.download, "download");
        ++numDownloads;
      } else suppressedDownloads++;
    }
    if (result.eval_js) initOrPush(result.eval_js, "eval_js");
  }
  let suppressedMsg = "";
  if (suppressedMsgs > 0) suppressedMsg = `${suppressedMsgs} messages`;
  if (suppressedErrors > 0)
    suppressedMsg += `${suppressedMsg ? ", " : ""}${suppressedErrors} errors`;
  if (suppressedMsg)
    result.json.suppressed = `And '${suppressedMsg}' were not shown`;
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
    configuration: { columns },
    req,
    res,
    exttable_name,
  }) => ({
    async optionsQuery(
      reftable_name,
      type,
      attributes,
      whereWithExisting,
      user
    ) {
      return await Field.select_options_query(
        reftable_name,
        type === "File" ? attributes.select_file_where : whereWithExisting,
        attributes,
        undefined,
        user
      );
    },
    async actionQuery(state, rndid) {
      const col = columns.find(
        (c) => c.type === "Action" && c.rndid === rndid && rndid
      );
      const table = Table.findOne(table_id);
      try {
        if (col.action_row_variable === "each_matching_row") {
          const fields = table.getFields();
          const { joinFields, aggregations } = picked_fields_to_query(
            columns,
            fields,
            undefined,
            req,
            table
          );
          const where = stateFieldsToWhere({
            fields,
            state,
            table,
            prefix: "a.",
          });
          const q = stateFieldsToQuery({
            state,
            prefix: "a.",
            noSortAndPaging: true,
          });
          if (col.action_row_limit) q.limit = col.action_row_limit;
          let rows = await table.getJoinedRows({
            where,
            joinFields,
            aggregations,
            ...q,
            forPublic: !req.user || req.user.role_id === 100,
            forUser: req.user,
          });
          const referrer = req?.get?.("Referrer");
          return combineResults(
            await asyncMap(rows, async (row) => {
              return await run_action_column({
                col,
                req,
                table,
                res,
                referrer,
                row,
              });
            })
          );
        } else {
          const row = col.action_row_variable === "state" ? { ...state } : null;
          const result = await run_action_column({
            col,
            req,
            table,
            res,
            referrer: req?.get?.("Referrer"),
            ...(row ? { row } : {}),
          });
          return { json: { success: "ok", ...(result || {}) } };
        }
      } catch (e) {
        console.error(e);
        return { json: { error: e.message || e } };
      }
    },
    async distinctValuesQuery(state) {
      const table = Table.findOne(table_id || exttable_name);
      const fields = table.getFields();
      let distinct_values = {};
      const role = req.user ? req.user.role_id : 100;
      for (const col of columns) {
        if (col.type === "DropDownFilter") {
          const field = fields.find((f) => f.name === col.field_name);
          if (table.external || table.provider_name) {
            distinct_values[col.field_name] = (
              await table.distinctValues(col.field_name, {
                forPublic: !req.user,
                forUser: req.user,
              })
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
              ),
              !col.all_options
            );
          } else if (col.field_name.split("->").length === 3) {
            //`${jFieldNm}.${jfld.reftable_name}->${throughField}.${throughFld.reftable_name}->${lblField}`;
            const [jFieldNm, throughPart, finalPart] =
              col.field_name.split(".");
            const [thoughTblNm, throughField] = throughPart.split("->");
            const [jtNm, lblField] = finalPart.split("->");
            const target = table.getField(
              `${jFieldNm}.${throughField}.${lblField}`
            );
            if (target)
              distinct_values[col.field_name] = await target.distinct_values(
                req,
                jsexprToWhere(col.where),
                !col.all_options
              );
          } else if (col.field_name.includes("->")) {
            const [jFieldNm, krest] = col.field_name.split(".");
            const [jtNm, lblField] = krest.split("->");
            const jtable = Table.findOne({ name: jtNm });
            if (!jtable)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find join table ${jtNm}`
              );
            const jfields = await jtable.getFields();
            const jfield = jfields.find((f) => f.name === lblField);
            if (jfield)
              distinct_values[col.field_name] = await jfield.distinct_values(
                req,
                jsexprToWhere(col.where),
                !col.all_options
              );
          } else if (col.field_name.includes(".")) {
            const kpath = col.field_name.split(".");
            if (kpath.length === 3) {
              const [jtNm, jFieldNm, lblField] = kpath;
              const jtable = Table.findOne({ name: jtNm });
              if (!jtable)
                throw new InvalidConfiguration(
                  `View ${viewname} incorrectly configured: cannot find join table ${jtNm}`
                );
              const jfields = jtable.fields;
              const jfield = jfields.find((f) => f.name === lblField);
              if (jfield)
                distinct_values[col.field_name] = await jfield.distinct_values(
                  req,
                  jsexprToWhere(col.where),
                  !col.all_options
                );
            } else if (kpath.length === 2) {
              const target = table.getField(col.field_name);
              if (target)
                distinct_values[col.field_name] = await target.distinct_values(
                  req,
                  jsexprToWhere(col.where),
                  !col.all_options
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
