/**
 * @category saltcorn-builder
 * @module components/elements/View
 * @subcategory components / elements
 */

import React, { Fragment, useEffect, useMemo } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";

import {
  fetchViewPreview,
  ConfigForm,
  setAPropGen,
  buildOptions,
  HelpTopicLink,
  buildTableCaches,
} from "./utils";

import { RelationBadges } from "./RelationBadges";
import { RelationOnDemandPicker } from "./RelationOnDemandPicker";

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
    view_name: node.data.props.view_name,
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
    view_name,
  } = node;
  const options = React.useContext(optionsCtx);
  const caches = useMemo(() => buildTableCaches(options.tables), [undefined]);
  const finder = useMemo(
    () =>
      new relationHelpers.RelationsFinder(
        caches,
        options.views,
        options.max_relations_layer_depth || 6
      ),
    [undefined]
  );

  const fixed_state_fields =
    options.fixed_state_fields && options.fixed_state_fields[view];
  const { setPreviews } = React.useContext(previewCtx);

  const setAProp = setAPropGen(setProp);
  let errorString = false;
  try {
    Function("return " + extra_state_fml);
  } catch (error) {
    errorString = error.message;
  }

  let viewname = view_name || view;
  if (viewname && viewname.includes(":")) {
    const [prefix, rest] = viewname.split(":");
    if (rest.startsWith(".")) viewname = prefix;
    else viewname = rest;
  }
  if (viewname.includes(".")) viewname = viewname.split(".")[0];
  const [relations, setRelations] = React.useState(
    finder.findRelations(options.tableName, viewname)
  );
  if (!relation && relations.paths.length > 0) {
    setProp((prop) => {
      prop.relation = relations.paths[0];
    });
  }
  const helpContext = { view_name: viewname };
  if (options.tableName) helpContext.srcTable = options.tableName;
  const set_view_name = (e) => {
    if (e.target) {
      const target_value = e.target.value;
      if (target_value !== viewname) {
        const newRelations = finder.findRelations(
          options.tableName,
          target_value
        );
        if (newRelations.paths.length > 0) {
          setProp((prop) => (prop.view_name = target_value));
          setProp((prop) => {
            prop.view = target_value;
            prop.relation = newRelations.paths[0];
          });
          setRelations(newRelations);
        }
      }
    }
  };

  return (
    <div>
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
        {
          <div>
            <RelationOnDemandPicker
              relations={relations.layers}
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
              relation={relation}
              parentTbl={options.tableName}
              tableNameCache={caches.tableNameCache}
            />
          </div>
        }
      </Fragment>
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
      {(state === "shared" || options.mode === "page") && (
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
      )}
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
