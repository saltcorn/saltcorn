import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting } from "./utils";

export const View = ({ name, view, state }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const options = useContext(optionsCtx);

  const views = options.views;
  const theview = views.find(v=>v.name===view)
  const label = theview ? theview.label : view
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`builder-embed-view text-center ${
        selected ? "selected-node" : ""
      }`}
    >
      View: {label}
    </div>
  );
};

export const ViewSettings = () => {
  const {
    actions: { setProp },
    name,
    view,
    state,
  } = useNode((node) => ({
    name: node.data.props.name,
    view: node.data.props.view,
    state: node.data.props.state,
  }));
  const options = useContext(optionsCtx);
  const views = options.views;
  //console.log(options)
  return (
    <div>
      <div>
        <label>View to {options.mode === "show" ? "embed" : "show"}</label>
        <select
          value={view}
          className="form-control"
          onChange={(e) => setProp((prop) => (prop.view = e.target.value))}
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
