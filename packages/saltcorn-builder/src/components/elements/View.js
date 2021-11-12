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
  blockProps,
  BlockSetting,
  MinRoleSetting,
  fetchViewPreview,
  ConfigForm,
} from "./utils";

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
const View = ({ name, view, state }) => {
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
      node_id,
    })();
  }, []);
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`${myPreview ? "" : "builder-embed-view"} text-center ${
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
    name: node.data.props.name,
    view: node.data.props.view,
    state: node.data.props.state,
    configuration: node.data.props.configuration, // fixed states
    node_id: node.id,
  }));

  const {
    actions: { setProp },
    name,
    view,
    state,
    node_id,
    configuration,
  } = node;
  const options = useContext(optionsCtx);
  const views = options.views;
  const fixed_state_fields =
    options.fixed_state_fields && options.fixed_state_fields[view];
  const { setPreviews } = useContext(previewCtx);
  const refetchPreview = fetchViewPreview({
    options,
    view,
    setPreviews,
    node_id,
  });
  const setAProp = (key) => (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };
  return (
    <div>
      <div>
        <label>View to {options.mode === "show" ? "embed" : "show"}</label>
        <select
          value={view}
          className="form-control"
          onChange={(e) => {
            setProp((prop) => (prop.view = e.target.value));
            refetchPreview({ view: e.target.value });
          }}
        >
          {views.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.label || f.name}
            </option>
          ))}
        </select>
      </div>
      {options.mode === "page" && (
        <Fragment>
          <div>
            <label>State</label>
            <select
              value={state}
              className="form-control"
              onChange={setAProp("state")}
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
