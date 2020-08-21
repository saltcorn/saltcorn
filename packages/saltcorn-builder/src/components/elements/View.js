import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting } from "./utils";

export const View = ({ name, view, state, inView }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return <div ref={dom => connect(drag(dom))}>[{view}]</div>;
};

export const ViewSettings = () => {
  const { setProp, name, view, state, inView } = useNode(node => ({
    name: node.data.props.name,
    view: node.data.props.view,
    state: node.data.props.state,
    inView: node.data.props.inView
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>View to {inView ? 'embed' : 'show'}</label>
        <select
          value={view}
          onChange={e => setProp(prop => (prop.view = e.target.value))}
        >
          {options.views.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      {!inView && (
        <div>
          <label>State</label>
          <select
            value={state}
            onChange={e => setProp(prop => (prop.state = e.target.value))}
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
  related: {
    settings: ViewSettings
  }
};
