/**
 * @category saltcorn-builder
 * @module components/elements/View
 * @subcategory components / elements
 */

import React, { Fragment, useEffect, useMemo } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";
import relationsCtx from "../relations_context";

import {
  fetchViewPreview,
  ConfigForm,
  setAPropGen,
  buildOptions,
  HelpTopicLink,
  initialRelation,
  buildLayers,
} from "./utils";

import { RelationBadges } from "./RelationBadges";
import { RelationOnDemandPicker } from "./RelationOnDemandPicker";

import {
  RelationsFinder,
  Relation,
  buildTableCaches,
} from "@saltcorn/common-code";

export /**
 * @param {object} props
 * @param {*} props.name
 * @param {string} props.view
 * @param {*} props.state
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const View = ({ name, view, configuration, state }) => {
  const {
    selected,
    node_id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected, node_id: node.id }));
  const options = React.useContext(optionsCtx);

  let viewname = view;
  if (viewname && viewname.includes(":")) {
    const [prefix, rest] = viewname.split(":");
    if (rest.startsWith(".")) viewname = prefix;
    else viewname = rest;
  }
  const theview = options.views.find((v) => v.name === viewname);
  const label = theview ? theview.label : view;
  const { previews, setPreviews } = React.useContext(previewCtx);
  const myPreview = previews[node_id];
  useEffect(() => {
    fetchViewPreview({
      options,
      view,
      setPreviews,
      configuration,
      node_id,
    })();
  }, [view, configuration, state]);
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`${myPreview ? "" : "builder-embed-view"} ${
        selected ? "selected-node" : ""
      }`}
    >
      {myPreview ? (
        <div
          className="d-inline"
          dangerouslySetInnerHTML={{ __html: myPreview }}
        ></div>
      ) : (
        `View: ${label}`
      )}
    </div>
  );
};

export /**
 * @returns
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const ViewSettings = () => {
  const node = useNode((node) => ({
    name: node.data.props.name,
    view: node.data.props.view,
    relation: node.data.props.relation,
    state: node.data.props.state,
    extra_state_fml: node.data.props.extra_state_fml,
    configuration: node.data.props.configuration, // fixed states
    node_id: node.id,
  }));

  const {
    actions: { setProp },
    name,
    view,
    relation,
    state,
    node_id,
    configuration,
    extra_state_fml,
  } = node;
  const options = React.useContext(optionsCtx);
  const {
    tables,
    views,
    max_relations_layer_depth,
    tableName,
    excluded_subview_templates,
  } = options;
  // not needed in page editor
  let finder = null;
  let tableCaches = null;
  if (tables && views) {
    finder = useMemo(
      () => new RelationsFinder(tables, views, max_relations_layer_depth),
      [undefined]
    );
    tableCaches = useMemo(() => buildTableCaches(tables), [undefined]);
  }
  const fixed_state_fields =
    options.fixed_state_fields && options.fixed_state_fields[view];
  const { setPreviews } = React.useContext(previewCtx);
  const { relationsCache, setRelationsCache } = React.useContext(relationsCtx);

  const setAProp = setAPropGen(setProp);
  let errorString = false;
  try {
    Function("return " + extra_state_fml);
  } catch (error) {
    errorString = error.message;
  }

  let viewname = view;
  let hasLegacyRelation = false;
  if (viewname && viewname.includes(":")) {
    hasLegacyRelation = true;
    const [prefix, rest] = viewname.split(":");
    if (rest.startsWith(".")) viewname = prefix;
    else viewname = rest;
  }
  if (viewname.includes(".")) viewname = viewname.split(".")[0];

  if (
    finder &&
    !(relationsCache[tableName] && relationsCache[tableName][viewname])
  ) {
    const relations = finder.findRelations(
      tableName,
      viewname,
      excluded_subview_templates
    );
    const layers = buildLayers(
      relations,
      tableName,
      tableCaches.tableNameCache
    );
    relationsCache[tableName] = relationsCache[tableName] || {};
    relationsCache[tableName][viewname] = { relations, layers };
    setRelationsCache({ ...relationsCache });
  }
  const [relationsData, setRelationsData] = finder
    ? React.useState(relationsCache[tableName][viewname])
    : [undefined, undefined];
  let safeRelation = null;
  const subView = views.find((view) => view.name === viewname);
  if (relation) {
    const subTbl = tables.find((tbl) => tbl.id === subView.table_id);
    safeRelation = new Relation(
      relation,
      subTbl ? subTbl.name : "",
      subView.display_type
    );
  }
  if (
    options.mode !== "filter" &&
    subView.table_id &&
    !safeRelation &&
    !hasLegacyRelation &&
    relationsData?.relations.length > 0
  ) {
    safeRelation = initialRelation(relationsData.relations);
    setProp((prop) => {
      prop.relation = safeRelation.relationString;
    });
  }
  const helpContext = { view_name: viewname };
  if (options.tableName) helpContext.srcTable = options.tableName;
  const set_view_name = (e) => {
    if (e.target) {
      const target_value = e.target.value;
      if (target_value !== viewname) {
        if (options.mode === "filter") {
          setProp((prop) => {
            prop.view = target_value;
          });
        } else {
          const newRelations = finder.findRelations(
            tableName,
            target_value,
            excluded_subview_templates
          );
          const layers = buildLayers(
            newRelations,
            tableName,
            tableCaches.tableNameCache
          );
          relationsCache[tableName] = relationsCache[tableName] || {};
          relationsCache[tableName][target_value] = {
            relations: newRelations,
            layers,
          };
          if (newRelations.length > 0) {
            setProp((prop) => {
              prop.view = target_value;
              prop.relation = initialRelation(newRelations).relationString;
            });
            setRelationsData({ relations: newRelations, layers });
          } else
            window.notifyAlert({
              type: "warning",
              text: `${target_value} has no relations`,
            });
        }
      }
    }
  };

  return (
    <div>
      {relationsData ? (
        <Fragment>
          <div>
            <label>View to {options.mode === "show" ? "embed" : "show"}</label>
            <select
              value={viewname}
              className="form-control form-select"
              onChange={set_view_name}
              onBlur={set_view_name}
            >
              {options.views.map((v, ix) => (
                <option key={ix} value={v.name}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          {options.mode !== "filter" && (
            <div>
              <RelationOnDemandPicker
                relations={relationsData.layers}
                update={(relPath) => {
                  if (relPath.startsWith(".")) {
                    setProp((prop) => {
                      prop.view = viewname;
                      prop.relation = relPath;
                    });
                  } else {
                    setProp((prop) => {
                      prop.view = relPath;
                      prop.relation = undefined;
                    });
                  }
                }}
              />
              <RelationBadges
                view={view}
                relation={safeRelation}
                parentTbl={tableName}
                caches={tableCaches}
              />
            </div>
          )}
        </Fragment>
      ) : (
        <div>
          <label>View to {options.mode === "show" ? "embed" : "show"}</label>
          <select
            value={view}
            className="form-control form-select"
            onChange={setAProp("view")}
            onBlur={setAProp("view")}
          >
            {options.views.map((f, ix) => (
              <option key={ix} value={f.name}>
                {f.label || f.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {options.mode !== "edit" && (
        <Fragment>
          <div>
            <label>State</label>
            <select
              value={state}
              className="form-control form-select"
              onChange={setAProp("state")}
              onBlur={setAProp("state")}
            >
              {buildOptions(
                [
                  "shared",
                  ...(options.mode === "page" ? ["fixed"] : []),
                  "local",
                ],
                {
                  valAttr: true,
                  capitalize: true,
                }
              )}
            </select>
          </div>
          {state === "fixed" &&
            fixed_state_fields &&
            fixed_state_fields.length > 0 && (
              <Fragment>
                <h6>View state fields</h6>
                <ConfigForm
                  fields={fixed_state_fields}
                  configuration={configuration || {}}
                  setProp={setProp}
                  node={node}
                />
              </Fragment>
            )}
        </Fragment>
      )}
      {
        <Fragment>
          <label>
            Extra state Formula
            <HelpTopicLink topic="Extra state formula" {...helpContext} />
          </label>
          <input
            type="text"
            className="viewlink-label form-control"
            value={extra_state_fml}
            onChange={setAProp("extra_state_fml")}
          />
          {errorString ? (
            <small className="text-danger font-monospace d-block">
              {errorString}
            </small>
          ) : null}
        </Fragment>
      }
      {view ? (
        <a
          className="d-block mt-2"
          target="_blank"
          href={`/viewedit/config/${viewname}`}
        >
          Configure this view
        </a>
      ) : null}
    </div>
  );
};

/**
 * @type {object}
 */
View.craft = {
  displayName: "View",
  related: {
    settings: ViewSettings,
  },
};
