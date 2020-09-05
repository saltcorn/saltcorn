import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting } from "./utils";

export const View = ({ name, view, state }) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className="builder-embed-view text-center"
    >
      {view} view
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
  //console.log(options)
  return (
    <div>
      <div>
        <label>View to {options.mode === "show" ? "embed" : "show"}</label>
        <select
          value={view}
          className="w-100"
          onChange={(e) => setProp((prop) => (prop.view = e.target.value))}
        >
          {options.views.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      {options.mode === "page" && (
        <div>
          <label>State</label>
          <select
            value={state}
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
