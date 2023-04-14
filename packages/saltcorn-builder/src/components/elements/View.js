/**
 * @category saltcorn-builder
 * @module components/elements/View
 * @subcategory components / elements
 */

import React, { Fragment, useContext, useEffect } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";

import {
  fetchViewPreview,
  ConfigForm,
  setAPropGen,
  FormulaTooltip,
} from "./utils";

import { RelationPicker } from "./RelationPicker";
import { RelationBadges } from "./RelationBadges";

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
  const options = useContext(optionsCtx);

  const views = options.views;
  const theview = views.find((v) => v.name === view);
  const label = theview ? theview.label : view;
  const { previews, setPreviews } = useContext(previewCtx);
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
 * @returns {div}
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
  const options = useContext(optionsCtx);
  const views = options.views;
  const fixed_state_fields =
    options.fixed_state_fields && options.fixed_state_fields[view];
  const { setPreviews } = useContext(previewCtx);

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

  const set_view_name = (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop.view_name = target_value));
      if (target_value !== viewname) {
        setProp((prop) => {
          if (options.view_relation_opts[target_value]) {
            prop.view = options.view_relation_opts[target_value][0].value;
            prop.relation = undefined;
          }
        });
      }
    }
  };

  return (
    <div>
      {options.view_name_opts ? (
        <Fragment>
          <div>
            <label>View to {options.mode === "show" ? "embed" : "show"}</label>
            <select
              value={viewname}
              className="form-control form-select"
              onChange={set_view_name}
              onBlur={set_view_name}
            >
              {options.view_name_opts.map((f, ix) => (
                <option key={ix} value={f.name}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <RelationPicker
            options={options}
            viewname={viewname}
            update={(relPath) => {
              if (relPath.startsWith(".")) {
                setProp((prop) => (prop.view = viewname));
                setProp((prop) => (prop.relation = relPath));
              } else {
                setProp((prop) => (prop.view = relPath));
                setProp((prop) => (prop.relation = undefined));
              }
            }}
          />
          <RelationBadges
            view={view}
            relation={relation}
            parentTbl={options.tableName}
            fk_options={options.fk_options}
          />
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
            {views.map((f, ix) => (
              <option key={ix} value={f.name}>
                {f.label || f.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {options.mode === "page" && (
        <Fragment>
          <div>
            <label>State</label>
            <select
              value={state}
              className="form-control form-select"
              onChange={setAProp("state")}
              onBlur={setAProp("state")}
            >
              <option value="shared">Shared</option>
              <option value="fixed">Fixed</option>
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
          {" "}
          <label>
            Extra state Formula <FormulaTooltip />
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
