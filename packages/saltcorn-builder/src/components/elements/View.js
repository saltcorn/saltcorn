import React, { useContext, useEffect } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";

import {
  blockProps,
  BlockSetting,
  MinRoleSetting,
  fetchViewPreview,
} from "./utils";

export const View = ({ name, view, state }) => {
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

export const ViewSettings = () => {
  const {
    actions: { setProp },
    name,
    view,
    state,
    node_id,
  } = useNode((node) => ({
    name: node.data.props.name,
    view: node.data.props.view,
    state: node.data.props.state,
    node_id: node.id,
  }));
  const options = useContext(optionsCtx);
  const views = options.views;
  const { setPreviews } = useContext(previewCtx);
  const refetchPreview = fetchViewPreview({
    options,
    view,
    setPreviews,
    node_id,
  });
  //console.log(options)
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
        <div>
          <label>State</label>
          <select
            value={state}
            className="form-control"
            onChange={(e) => setProp((prop) => (prop.state = e.target.value))}
          >
            <option value="shared">Shared</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
      )}
    </div>
  );
};

View.craft = {
  displayName: "View",
  related: {
    settings: ViewSettings,
  },
};
