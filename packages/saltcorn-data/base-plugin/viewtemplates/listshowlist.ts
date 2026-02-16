/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/listshowlist
 * @subcategory base-plugin
 */
import Table from "../../models/table";
import Form from "../../models/form";
import View from "../../models/view";
import Workflow from "../../models/workflow";
const { text, div, h4, h6, a } = require("@saltcorn/markup/tags");
const { renderForm, tabs } = require("@saltcorn/markup");
import {
  get_child_views,
  get_parent_views,
  readState,
} from "../../plugin-helper";
import { splitUniques } from "../../viewable_fields";
import { GenObj } from "@saltcorn/types/common_types";
import { Req } from "@saltcorn/types/base_types";
import type { Where, Row } from "@saltcorn/db-common/internal";

import utils from "../../utils";
const { InvalidConfiguration, extractPagings } = utils;


const configuration_workflow = (req: Req) => 
  new Workflow({
    steps: [
      {
        name: req.__("Views"),
        form: async (context: GenObj) => {
          const list_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow, viewtemplate }: GenObj) =>
              viewtemplate.view_quantity === "Many" &&
              viewrow.name !== context.viewname &&
              state_fields.every((sf: GenObj) => !sf.required)
          );
          const list_view_opts = list_views.map((v) => v.name);
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }: GenObj) =>
              viewrow.name !== context.viewname &&
              state_fields.some((sf: GenObj) => sf.name === "id")
          );
          const show_view_opts = show_views.map((v) => v.name);

          return new Form({
            fields: [
              {
                name: "list_view",
                label: req.__("List View"),
                type: "String",
                sublabel:
                  req.__("A list view shown on the left, to select rows") +
                  ". " +
                  a(
                    {
                      "data-dyn-href": `\`/viewedit/config/\${list_view}\``,
                      target: "_blank",
                    },
                    req.__("Configure")
                  ),
                required: false,
                attributes: {
                  options: list_view_opts,
                },
              },
              {
                name: "show_view",
                label: req.__("Show View"),
                type: "String",
                sublabel:
                  req.__("The view to show the selected row") +
                  ". " +
                  a(
                    {
                      "data-dyn-href": `\`/viewedit/config/\${show_view}\``,
                      target: "_blank",
                    },
                    req.__("Configure")
                  ),
                required: false,
                attributes: {
                  options: show_view_opts,
                },
              },
              {
                name: "list_width",
                label: req.__("List width"),
                sublabel: req.__(
                  "Number of columns (1-12) allocated to the list view"
                ),
                type: "Integer",
                default: 6 as any,
                attributes: {
                  min: 1,
                  max: 12,
                },
              },
            ],
          });
        },
      },
      {
        name: req.__("Subtables"),
        contextField: "subtables",
        form: async (context: GenObj) => {
          const tbl = Table.findOne({ id: context.table_id });
          var fields: GenObj[] = [];
          const child_views = await get_child_views(tbl!, context.viewname);
          for (const { relation, related_table, views } of child_views) {
            for (const view of views) {
              fields.push({
                name: `ChildList:${view.name}.${related_table.name}.${relation.name}`,
                label: `${view.name} of ${relation.label} on ${related_table.name}`,
                type: "Bool",
              });
            }
          }
          const parent_views = await get_parent_views(tbl!, context.viewname);
          for (const { relation, related_table, views } of parent_views) {
            for (const view of views) {
              fields.push({
                name: `ParentShow:${view.name}.${related_table.name}.${relation.name}`,
                label: `${view.name} of ${relation.name} on ${related_table.name}`,
                type: "Bool",
              });
            }
          }
          return new Form({
            fields: fields as any,
            blurb: req.__(
              "Which related tables would you like to show in sub-lists below the selected item?"
            ),
          });
        },
      },
    ],
  });

const get_state_fields = async (
  table_id: number,
  viewname: string,
  { list_view, show_view }: GenObj
) => {
  const id = {
    name: "id",
    type: "Integer",
    required: false,
  };
  if (list_view) {
    const lview = await View.findOne({ name: list_view });
    if (lview) {
      const lview_sfs = await lview.get_state_fields();
      return [id, ...lview_sfs];
    } else return [id];
  } else return [id];
};

const run = async (
  table_id: number,
  viewname: string,
  { list_view, show_view, list_width, subtables }: GenObj,
  state: GenObj,
  extraArgs: GenObj,
  { getRowQuery }: { getRowQuery: (where: Where) => Promise<Row | null> }
) => {
  const table = Table.findOne({ id: table_id })!;
  const fields = table.getFields();
  readState(state, fields);

  var lresp: string | undefined;
  if (list_view) {
    const lview = await View.findOne({ name: list_view });
    if (!lview)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${list_view}`
      );
    const state1 = lview.combine_state_and_default_state(state);
    lresp = await lview.run(state1, {
      ...extraArgs,
      onRowSelect: (v: Row) => `select_id('${v.id}', this)`,
      removeIdFromstate: true,
      req: extraArgs.req,
    });
  }

  var sresp = "";
  if (show_view) {
    const sview = await View.findOne({ name: show_view });
    if (!sview)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${show_view}`
      );
    sresp = await sview.run(state, extraArgs as any);
  }
  var reltbls: GenObj = {};
  var myrow: Row | null | undefined;
  const { uniques } = splitUniques(fields, state, true);

  if (Object.keys(uniques).length > 0) {
    var id: any;
    if (state.id) id = state.id;
    else {
      myrow = getRowQuery(uniques);
      if (!myrow) return `Not found`;
      id = myrow.id;
    }
    for (const relspec of Object.keys(subtables || {})) {
      if (subtables[relspec]) {
        const [reltype, rel] = relspec.split(":");
        switch (reltype) {
          case "ChildList":
          case "OneToOneShow":
            const [vname, reltblnm, relfld] = rel.split(".");
            const tab_name = reltblnm;
            const subview = await View.findOne({ name: vname });
            if (!subview)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find view ${vname}`
              );
            else {
              const allPagings = extractPagings(state);
              const subresp = await subview.run(
                { [relfld]: id, ...allPagings },
                extraArgs as any
              );
              reltbls[tab_name] = subresp;
            }
            break;
          case "ParentShow":
            const [pvname, preltblnm, prelfld] = rel.split(".");
            if (!myrow) myrow = await getRowQuery({ id });
            if (!myrow) continue;
            const ptab_name = prelfld;
            const psubview = await View.findOne({ name: pvname });
            if (!psubview)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find view ${pvname}`
              );
            else {
              const psubresp = await psubview.run(
                { id: myrow[prelfld] },
                extraArgs as any
              );

              reltbls[ptab_name] = psubresp;
            }
            break;
          default:
            break;
        }
      }
    }
  }
  const relTblResp =
    Object.keys(reltbls).length === 1
      ? [h6(Object.keys(reltbls)[0]), reltbls[Object.keys(reltbls)[0]]]
      : tabs(reltbls);
  if (lresp) {
    if (list_width === 12) return lresp;
    return div(
      { class: "row" },
      div({ class: `col-sm-${list_width || 6}` }, lresp),
      div(
        { class: `col-sm-${12 - (list_width || 6)}` },
        div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": show_view,
          },
          sresp
        ),
        relTblResp
      )
    );
  } else {
    return div(
      div(
        {
          class: "d-inline",
          "data-sc-embed-viewname": show_view,
        },
        sresp
      ),
      relTblResp
    );
  }
};

export = {
  /** @type {string} */
  name: "ListShowList",
  /** @type {string} */
  description:
    "Combine an optional list view on the left with displays on the right of a single selected row, with views of related rows from different tables underneath",
  configuration_workflow,
  run,
  get_state_fields,
  queries: ({
    table_id,
    viewname,
    configuration: { columns, default_state },
    req,
  }: GenObj) => ({
    async getRowQuery(uniques: Where) {
      const table = Table.findOne({ id: table_id })!;
      return await table.getJoinedRow({
        where: uniques,
        forUser: req.user,
        forPublic: !req.user,
      });
    },
  }),
  connectedObjects: async ({ list_view, subtables }: GenObj) => {
    const subViews: View[] = [];
    for (const relspec of Object.keys(subtables || {})) {
      if (subtables[relspec]) {
        const [reltype, rel] = relspec.split(":");
        switch (reltype) {
          case "ChildList":
          case "OneToOneShow":
            const [vname, reltblnm, relfld] = rel.split(".");
            const view = View.findOne({ name: vname });
            if (view) subViews.push(view);
            break;
          case "ParentShow":
            const [pvname, preltblnm, prelfld] = rel.split(".");
            const pView = View.findOne({ name: pvname });
            if (pView) subViews.push(pView);
            break;
          default:
            break;
        }
      }
    }
    const listView = View.findOne({ name: list_view });
    if (listView) subViews.push(listView);
    return {
      embeddedViews: subViews,
    };
  },
};
